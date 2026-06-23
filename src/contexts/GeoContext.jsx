import React, { createContext, useContext, useEffect, useState, useMemo } from 'react';

/**
 * GeoContext — exposes the visitor's IP-derived city/country to the React tree,
 * fetched once on mount from the Vercel edge function at /api/geo and cached
 * in sessionStorage for the rest of the session.
 *
 * Powers geo-aware copy variants on LandingPage, DashboardPage, DiscoveryPage
 * empty state, etc. ("Welcome to Marryzen — connecting members in Atlanta").
 *
 * Honest density policy: this context only provides the visitor's location.
 * Copy that uses it should be density-aware where applicable — see
 * shouldShowCityLevel() helper. Pre-launch we deliberately keep claims modest:
 * - Always show neutral acknowledgment ("Welcome to Marryzen, [city] members")
 * - Never claim density ("Marryzen is now in [city]") without backing membership
 *
 * Usage:
 *   import { useGeo } from '@/contexts/GeoContext';
 *   const { city, country, isLoading } = useGeo();
 *
 * Safe to call even if GeoProvider isn't mounted (returns the default shape
 * with all fields null + isLoading false) — so existing pages that haven't
 * been instrumented continue to render normally.
 */

const SESSION_CACHE_KEY = 'mz_geo_v1';

const defaultValue = {
  city: null,
  country: null,
  region: null,
  isLoading: false,
  error: null,
};

const GeoContext = createContext(defaultValue);

export function GeoProvider({ children }) {
  const [state, setState] = useState(() => {
    // Hydrate from sessionStorage if we already fetched this session.
    try {
      const cached = sessionStorage.getItem(SESSION_CACHE_KEY);
      if (cached) {
        const parsed = JSON.parse(cached);
        if (parsed && typeof parsed === 'object') {
          return { ...defaultValue, ...parsed, isLoading: false };
        }
      }
    } catch (_) {
      // sessionStorage can throw in private-browsing modes — ignore.
    }
    return { ...defaultValue, isLoading: true };
  });

  useEffect(() => {
    // Skip the fetch if we already hydrated from the session cache.
    if (!state.isLoading) return;

    let cancelled = false;
    const controller = new AbortController();
    // 4-second timeout so a slow edge fetch never blocks page render forever.
    const timeoutId = setTimeout(() => controller.abort(), 4000);

    fetch('/api/geo', {
      signal: controller.signal,
      credentials: 'omit',
      headers: { accept: 'application/json' },
    })
      .then((r) => {
        if (!r.ok) throw new Error(`geo fetch ${r.status}`);
        return r.json();
      })
      .then((data) => {
        clearTimeout(timeoutId);
        if (cancelled) return;
        const next = {
          city: data?.city || null,
          country: data?.country || null,
          region: data?.region || null,
          isLoading: false,
          error: null,
        };
        try {
          sessionStorage.setItem(SESSION_CACHE_KEY, JSON.stringify(next));
        } catch (_) {
          // ignore
        }
        setState(next);
      })
      .catch((err) => {
        clearTimeout(timeoutId);
        if (cancelled) return;
        // Silent failure — UI degrades to the neutral copy variant.
        setState({
          city: null,
          country: null,
          region: null,
          isLoading: false,
          error: err?.name === 'AbortError' ? 'timeout' : (err?.message || 'unknown'),
        });
      });

    return () => {
      cancelled = true;
      controller.abort();
      clearTimeout(timeoutId);
    };
  }, [state.isLoading]);

  const value = useMemo(() => state, [state]);

  return <GeoContext.Provider value={value}>{children}</GeoContext.Provider>;
}

export function useGeo() {
  return useContext(GeoContext);
}

/**
 * Country-code → display name helper for the small set of countries we expect
 * to see early. Extends gracefully — falls back to the ISO code itself if a
 * pretty name isn't defined here. (Avoids shipping a 250-entry table client-side.)
 */
const COUNTRY_NAMES = {
  US: 'the United States',
  CA: 'Canada',
  GB: 'the United Kingdom',
  FR: 'France',
  DE: 'Germany',
  BE: 'Belgium',
  NL: 'the Netherlands',
  ES: 'Spain',
  IT: 'Italy',
  PT: 'Portugal',
  IE: 'Ireland',
  AU: 'Australia',
  NZ: 'New Zealand',
  AE: 'the UAE',
  SA: 'Saudi Arabia',
  MA: 'Morocco',
  DZ: 'Algeria',
  TN: 'Tunisia',
  EG: 'Egypt',
  TR: 'Turkey',
  IN: 'India',
  PK: 'Pakistan',
  BD: 'Bangladesh',
  MY: 'Malaysia',
  ID: 'Indonesia',
  SG: 'Singapore',
};

export function formatCountry(code) {
  if (!code) return null;
  return COUNTRY_NAMES[code] || code;
}

/**
 * Density gate. Returns true when we have enough verified members in a city
 * for a city-level claim to feel real, false otherwise. Caller decides which
 * copy variant to render.
 *
 * For pre-launch we accept the simple default of `false` for city-level when
 * count is unknown — copy degrades to country-level or neutral. As the DB
 * counter matures we'll wire the actual count in via an RPC.
 *
 * Future: pass a Supabase RPC result here. For v1 callers can pass a known
 * member-count integer if available; otherwise the gate stays closed.
 */
export function shouldShowCityLevel(memberCountInCity) {
  if (typeof memberCountInCity !== 'number') return false;
  return memberCountInCity >= 50;
}

export default GeoContext;
