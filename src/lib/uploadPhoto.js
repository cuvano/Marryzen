import { supabase } from '@/lib/customSupabaseClient';
import { scanPhotoForNSFW, PhotoBlockedError } from '@/lib/photoModeration';

/**
 * Upload a base64-encoded image (data URL) to Supabase Storage and return its
 * public URL.
 *
 * B6 update: scans the image via Hive Moderation BEFORE uploading. If the scan
 * blocks the photo (NSFW, CSAM, violence, weapons), throws a PhotoBlockedError
 * the caller can catch to show an appropriate toast. CSAM detections also
 * trigger an auto-ban + admin notification email (handled server-side in the
 * scan-photo Edge Function).
 *
 * Fail-OPEN behavior is preserved for non-scan failures (network, RLS, missing
 * userId) so a Hive outage or storage hiccup doesn't lock users out of profile
 * creation — they just get the original base64 back, same as before.
 *
 * Path: <user_id>/<kind>-<timestamp>-<rand>.<ext>
 */
export async function uploadPhotoToStorage(dataUrl, userId, kind = 'photo') {
  // Pre-check: nothing to do for non-data-URL inputs.
  if (!dataUrl || typeof dataUrl !== 'string') return dataUrl;
  if (!dataUrl.startsWith('data:')) return dataUrl; // already a URL

  // B6 — scan BEFORE upload. If blocked, throw outside the try/catch below
  // so the caller sees the rejection (not the fallback dataUrl).
  // 'kind' maps cleanly to the audit context: 'photo' (onboarding step 2 +
  // ProfilePage profile photo) / 'cover' (ProfilePage cover photo).
  const scanContext =
    kind === 'cover' ? 'cover' : kind === 'photo' ? 'profile_or_onboarding' : kind;
  const scan = await scanPhotoForNSFW(dataUrl, scanContext);
  if (scan && scan.safe === false) {
    throw new PhotoBlockedError(
      scan.reason || 'This photo violates our Community Guidelines.',
      {
        flag: scan.flag,
        score: scan.score,
        scanId: scan.scan_id,
      },
    );
  }

  // Original upload path, unchanged.
  try {
    if (!userId) {
      console.warn('[uploadPhoto] missing userId, falling back to base64');
      return dataUrl;
    }
    const response = await fetch(dataUrl);
    const blob = await response.blob();
    const mime = blob.type || 'image/jpeg';
    const ext = (mime.split('/')[1] || 'jpg').replace('jpeg', 'jpg');
    const path = `${userId}/${kind}-${Date.now()}-${Math.random().toString(36).slice(2, 8)}.${ext}`;
    const { error: upErr } = await supabase.storage
      .from('profile-photos')
      .upload(path, blob, { contentType: mime, upsert: false });
    if (upErr) {
      console.error('[uploadPhoto] upload failed, falling back to base64:', upErr);
      return dataUrl;
    }
    const { data: urlData } = supabase.storage.from('profile-photos').getPublicUrl(path);
    return urlData?.publicUrl || dataUrl;
  } catch (e) {
    // Don't swallow PhotoBlockedError — it was thrown above, before this try.
    // Anything caught here is a true network/storage failure → fail-OPEN.
    console.error('[uploadPhoto] unexpected error, falling back to base64:', e);
    return dataUrl;
  }
}
