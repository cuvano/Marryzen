// src/lib/faceDetection.js
//
// Client-side face detection for profile-photo uploads.
//
// LOADS: face-api.js + tiny_face_detector model (~190 KB) from CDN at FIRST USE.
// Nothing is loaded at app startup, so users who never upload a photo pay zero
// cost. Once loaded, the model + weights are cached for the rest of the session.
//
// FAIL MODE: fail-OPEN. If the model can't load (older browser, network issue,
// CDN outage, etc.), we allow the upload through. Trade-off: a determined attacker
// can disable JS to bypass; that's fine because this is one layer of defense and
// the SafetyPanel + report-user flow catches what slips through. Locking legit
// users out of profile creation because of a CDN hiccup is a much worse outcome.
//
// USAGE
// -----
//   import { detectFacesInImage } from '@/lib/faceDetection';
//
//   const result = await detectFacesInImage(croppedBase64DataUrl);
//   if (result.faces === 0) {
//     toast({ title: 'No face detected', description: '...', variant: 'destructive' });
//     return;
//   }
//   if (result.faces > 1) {
//     toast({ title: 'Multiple people detected', description: '...', variant: 'destructive' });
//     return;
//   }
//   // proceed with upload
//
// Returns { faces, confidence, error?, failOpen? }.
//   - faces:      number of faces detected (0, 1, 2, ...)
//   - confidence: highest face's confidence score (0..1)
//   - failOpen:   true when detection couldn't run; caller should treat as "allow"
//   - error:      explanation string when failOpen is true

const CDN_BASE = 'https://cdn.jsdelivr.net/npm/face-api.js@0.22.2';
const MODEL_BASE = 'https://cdn.jsdelivr.net/gh/justadudewhohacks/face-api.js@master/weights';

let _modelPromise = null;

async function loadDetector() {
  if (_modelPromise) return _modelPromise;
  _modelPromise = (async () => {
    // Vite leaves dynamic `import('https://...')` as a runtime URL import.
    // The @vite-ignore comment guarantees no build-time resolution attempt.
    const mod = await import(/* @vite-ignore */ `${CDN_BASE}/+esm`);
    const faceapi = mod.default ?? mod;
    if (!faceapi?.nets?.tinyFaceDetector) {
      throw new Error('face-api.js loaded but tinyFaceDetector net is missing');
    }
    await faceapi.nets.tinyFaceDetector.loadFromUri(MODEL_BASE);
    return faceapi;
  })();
  // If loading fails, blow away the cache so the next call can retry.
  _modelPromise.catch(() => { _modelPromise = null; });
  return _modelPromise;
}

// Convert a data URL or URL to an HTMLImageElement.
function loadImage(src) {
  return new Promise((resolve, reject) => {
    const img = new Image();
    // crossOrigin only matters if we ever feed a remote URL; harmless for data URLs.
    img.crossOrigin = 'anonymous';
    img.onload = () => resolve(img);
    img.onerror = () => reject(new Error('Failed to decode image for face detection'));
    img.src = src;
  });
}

/**
 * Detect faces in an image. Accepts a base64 data URL (typical from cropper)
 * or a regular URL.
 *
 * Returns { faces, confidence, failOpen?, error? }.
 *
 * Score threshold of 0.5 keeps casual selfies in while filtering out
 * background-blur artifacts. The tiny_face_detector model is sensitive enough
 * to catch partial faces (sunglasses, hats) at this threshold.
 */
export async function detectFacesInImage(imageSrc) {
  if (!imageSrc || typeof imageSrc !== 'string') {
    return { faces: 0, confidence: 0, failOpen: true, error: 'invalid input' };
  }

  let faceapi;
  try {
    faceapi = await loadDetector();
  } catch (e) {
    console.warn('[faceDetection] model load failed (fail-open):', e);
    return { faces: 0, confidence: 0, failOpen: true, error: 'model load failed' };
  }

  let img;
  try {
    img = await loadImage(imageSrc);
  } catch (e) {
    console.warn('[faceDetection] image decode failed (fail-open):', e);
    return { faces: 0, confidence: 0, failOpen: true, error: 'image decode failed' };
  }

  try {
    const options = new faceapi.TinyFaceDetectorOptions({
      inputSize: 416,       // accuracy/speed sweet spot for portrait uploads
      scoreThreshold: 0.5,  // 0.5 catches partial faces; 0.7+ misses sunglasses
    });
    const detections = await faceapi.detectAllFaces(img, options);
    const count = detections.length;
    const top = detections.reduce(
      (max, d) => Math.max(max, d.score ?? d._score ?? 0),
      0,
    );
    return { faces: count, confidence: top };
  } catch (e) {
    console.warn('[faceDetection] detection threw (fail-open):', e);
    return { faces: 0, confidence: 0, failOpen: true, error: 'detection threw' };
  }
}

// Eager-load the model in idle time AFTER the user has reached the photo
// upload step. Callers should fire this when the user lands on Step 2 so the
// detection feels instant when they actually crop a photo. Safe to call multiple
// times — it's a no-op after the first run.
export function warmUpFaceDetector() {
  loadDetector().catch(() => { /* swallowed — handled in detectFacesInImage */ });
}
