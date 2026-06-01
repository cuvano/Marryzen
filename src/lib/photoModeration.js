// src/lib/photoModeration.js
//
// B6 - Client-side wrapper for the scan-photo Edge Function.
//
// Sends a base64 data URL to the scan-photo Edge Function (which proxies to
// Hive Moderation). Returns a decision object:
//
//   { safe: true,  decision: 'pass'|'flag', flag?, score?, scan_id? }
//   { safe: false, decision: 'block',       reason, flag, score, scan_id }
//
// USAGE
// -----
//   import { scanPhotoForNSFW } from '@/lib/photoModeration';
//
//   const result = await scanPhotoForNSFW(croppedBase64DataUrl, 'onboarding');
//   if (!result.safe) {
//     toast({ title: 'Photo not allowed', description: result.reason, variant: 'destructive' });
//     return;
//   }
//   // proceed with upload
//
// NOTE: this is also called automatically inside uploadPhotoToStorage so most
// callers do not need to invoke it directly. Use it directly only when you
// want to surface the rejection UX before the upload attempt.

import { supabase } from '@/lib/customSupabaseClient';

export async function scanPhotoForNSFW(dataUrl, context = 'profile') {
  if (!dataUrl || typeof dataUrl !== 'string' || !dataUrl.startsWith('data:')) {
    return { safe: true, decision: 'pass', reason: 'not a data URL; skipping scan' };
  }

  try {
    const { data, error } = await supabase.functions.invoke('scan-photo', {
      body: { dataUrl, context },
    });

    if (error) {
      // Reviewer-corrected fail mode:
      //   - HTTP error from Edge Function (4xx/5xx): fail-CLOSED. This catches
      //     attacks where a malicious client strips/forges auth headers to
      //     trigger a 401 and bypass the scan.
      //   - Network outage (could not reach Supabase): fail-OPEN. Otherwise
      //     a platform outage would lock everyone out of profile creation.
      console.error('[photoModeration] scan-photo invocation failed:', error);
      const isHttpError =
        error.name === 'FunctionsHttpError' ||
        (typeof error.status === 'number' && error.status >= 400);
      if (isHttpError) {
        return {
          safe: false,
          decision: 'block',
          reason:
            error.message ||
            'Photo could not be verified by moderation service. Please try again.',
        };
      }
      return {
        safe: true,
        decision: 'error',
        reason: 'Moderation service is unreachable; upload allowed.',
      };
    }

    return data;
  } catch (e) {
    console.error('[photoModeration] unexpected error scanning photo:', e);
    return {
      safe: false,
      decision: 'block',
      reason: 'Photo could not be verified by moderation service. Please try again.',
    };
  }
}

export class PhotoBlockedError extends Error {
  constructor(message, { flag, score, scanId } = {}) {
    super(message);
    this.name = 'PhotoBlockedError';
    this.code = 'PHOTO_BLOCKED';
    this.flag = flag;
    this.score = score;
    this.scanId = scanId;
  }
}
