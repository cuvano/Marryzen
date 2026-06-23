/**
 * /api/geo — Vercel Edge function returning the visitor's city + country derived
 * from Vercel's edge-network IP-geolocation headers. Used by the GeoContext
 * provider in the React app to drive geo-aware copy ("matching members in [city]").
 *
 * Privacy: this endpoint never persists the IP, never logs the IP, and never
 * returns anything beyond a coarse city + country string. The geolocation
 * itself is already produced by Vercel at the edge as part of normal request
 * routing — this endpoint simply exposes the headers to the client.
 *
 * Wired into the existing geo-block processing activity in ROPA §3.1 (IP-derived
 * inference for service personalisation). No new processing activity introduced.
 *
 * Returns: { city, country, region, ok: true }
 *   - city:    string or null   (e.g., "Atlanta" or null if unknown)
 *   - country: string or null   (ISO 3166-1 alpha-2, e.g., "US")
 *   - region:  string or null   (Vercel region code, e.g., "iad1" — coarse continent hint)
 *   - ok:      true
 *
 * Falls back to null fields (never throws) so the React provider can always
 * render — the Hero / Welcome / Discovery copy gracefully degrades to the
 * neutral, density-agnostic version when geo is unknown.
 */

export const config = {
  runtime: 'edge',
};

export default function handler(request) {
  // Vercel populates these headers on every request at the edge.
  // See: https://vercel.com/docs/edge-network/headers/request-headers
  const h = request.headers;

  const city = decodeIfNeeded(h.get('x-vercel-ip-city'));
  const country = (h.get('x-vercel-ip-country') || '').toUpperCase() || null;
  const region = h.get('x-vercel-id')?.split('::')?.[0] || null;

  // Don't leak the IP itself even if a future Vercel header carries it.
  // CRITICAL: cache MUST be private (browser-only) because Vercel's shared CDN
  // does NOT include the visitor's IP-geo headers in its cache key. Public
  // caching would serve the first visitor's city to every subsequent visitor
  // hitting the same edge POP — a geo-leakage bug.
  return new Response(
    JSON.stringify({
      ok: true,
      city: city || null,
      country: country || null,
      region: region || null,
    }),
    {
      status: 200,
      headers: {
        'content-type': 'application/json; charset=utf-8',
        // Browser-only cache for 10 minutes — IP geo rarely changes within a
        // session, so the same client can reuse its own response. `private`
        // explicitly forbids shared/CDN caching. `s-maxage=0` belt-and-braces
        // ensures Vercel's edge never caches this response across visitors.
        'cache-control': 'private, max-age=600, s-maxage=0',
        // No CORS header needed — this endpoint is only called same-origin
        // from the React app at marryzen.com via a relative fetch.
      },
    }
  );
}

/**
 * Vercel sometimes URL-encodes city names with non-ASCII characters
 * (e.g., "Z%C3%BCrich" for Zürich). Decode safely; fall back to the
 * raw value if decoding fails.
 */
function decodeIfNeeded(value) {
  if (!value) return null;
  try {
    return decodeURIComponent(value);
  } catch (_) {
    return value;
  }
}
