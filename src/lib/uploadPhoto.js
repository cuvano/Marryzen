import { supabase } from '@/lib/customSupabaseClient';

/**
 * Upload a base64-encoded image (data URL) to Supabase Storage and return its
 * public URL. If anything fails (network, RLS, no userId), returns the original
 * input unchanged so the caller still has a working base64 string to fall back on.
 *
 * Path: <user_id>/<kind>-<timestamp>-<rand>.<ext>
 */
export async function uploadPhotoToStorage(dataUrl, userId, kind = 'photo') {
  try {
    if (!dataUrl || typeof dataUrl !== 'string') return dataUrl;
    if (!dataUrl.startsWith('data:')) return dataUrl; // already a URL
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
    console.error('[uploadPhoto] unexpected error, falling back to base64:', e);
    return dataUrl;
  }
}
