import React, { useEffect, useMemo, useRef, useState } from 'react';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';

// ============================================================================
// CitySelect — searchable city picker with country filter + free-text escape.
// ============================================================================
//
// Strategy: HTML5 <datalist> for native browser-driven autocomplete. Zero
// new deps, native keyboard nav, fast on all browsers. The dataset
// (`/cities.json`, ~310KB gzipped) is fetched once on first mount and
// cached for the session — subsequent country changes are instant.
//
// On selection (exact match in dataset), the parent receives a city object
// with geoname_id + lat + lng + admin_name. On non-match (small town not in
// dataset), the parent receives an unverified-flagged city object with just
// the name string — `city_unverified=true` lets admin review the entry later.
//
// Diacritic-insensitive matching: the dataset uses ASCII names (Sao Paulo,
// Istanbul, Sevilla, etc.). Users typing native scripts (São Paulo, İstanbul,
// Sevilla) match because we normalize both sides via String.prototype.normalize
// + diacritic strip before comparing.
//
// Props:
//   country         — string, REQUIRED. Filters which cities show.
//   stateFilter     — optional, US-only. If set, further filter cities to
//                     those in the matching admin1 (state) code.
//   value           — current city object { name, geoname_id?, lat?, lng?,
//                     admin?, unverified? } or empty string for "no selection".
//   onChange        — (cityObj) => void. cityObj is null when input is empty.
//   id              — DOM id (for label-htmlFor binding)
//   className       — passthrough for the input wrapper
//   placeholder     — input placeholder, defaults to a country-aware prompt
//
// Cache: cities.json is fetched once and memoized in module-level `cityCache`.
// SSR-safe: fetch only fires on the client (window check).
// ============================================================================

let cityCache = null;
let cityCachePromise = null;

const stripDiacritics = (s) =>
  s.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().trim();

const fetchCities = async () => {
  if (cityCache) return cityCache;
  if (cityCachePromise) return cityCachePromise;
  cityCachePromise = fetch('/cities.json')
    .then((r) => {
      if (!r.ok) throw new Error(`HTTP ${r.status}`);
      return r.json();
    })
    .then((data) => {
      cityCache = data;
      cityCachePromise = null;
      return data;
    })
    .catch((err) => {
      cityCachePromise = null;
      console.warn('[CitySelect] cities.json load failed:', err);
      cityCache = [];
      return [];
    });
  return cityCachePromise;
};

const CitySelect = ({
  country,
  stateFilter,
  value,
  onChange,
  id = 'city',
  className = '',
  placeholder,
}) => {
  const [allCities, setAllCities] = useState(cityCache || null);
  const [inputValue, setInputValue] = useState('');
  const listId = useRef(`cities-list-${Math.random().toString(36).slice(2, 8)}`).current;

  // Hydrate input from controlled value on first render or country change
  useEffect(() => {
    if (typeof value === 'string') {
      setInputValue(value);
    } else if (value && typeof value === 'object' && value.name) {
      setInputValue(value.name);
    } else {
      setInputValue('');
    }
  }, [value, country]);

  // Lazy-load cities.json (once, then cached)
  useEffect(() => {
    if (typeof window === 'undefined' || allCities) return;
    let alive = true;
    fetchCities().then((data) => {
      if (alive) setAllCities(data);
    });
    return () => {
      alive = false;
    };
  }, [allCities]);

  // Filter visible city options to the selected country (+state, if US).
  // Datalist renders maybe 10-15 visible options per browser — we sort by
  // population (already sorted in cities.json) and let the browser handle
  // search-as-you-type filtering.
  const visibleCities = useMemo(() => {
    if (!allCities || !country) return [];
    let filtered = allCities.filter((c) => c.c === country);
    if (country === 'United States' && stateFilter) {
      // GeoNames admin1 for US is the full state name (matches Step1b US_STATES).
      filtered = filtered.filter((c) => c.a === stateFilter);
    }
    return filtered.slice(0, 1000); // cap at 1000 datalist options (US largest at ~976)
  }, [allCities, country, stateFilter]);

  const handleChange = (e) => {
    const text = e.target.value;
    setInputValue(text);

    if (!text.trim()) {
      onChange(null);
      return;
    }

    if (!allCities || allCities.length === 0) {
      // Dataset not loaded yet — accept as unverified for now; reconciles
      // on next render once data loads
      onChange({ name: text, unverified: true });
      return;
    }

    // Exact match (diacritic-insensitive) against the visible cities for the
    // current country. The label format we emit in <option value="..."> is
    // "City, State, Country" — we try matches against several forms.
    const norm = stripDiacritics(text);
    const exact = visibleCities.find((c) => {
      const candidates = [
        c.n,
        c.a ? `${c.n}, ${c.a}` : null,
        c.a ? `${c.n}, ${c.a}, ${c.c}` : `${c.n}, ${c.c}`,
      ].filter(Boolean);
      return candidates.some((label) => stripDiacritics(label) === norm);
    });

    if (exact) {
      onChange({
        name: exact.n,
        geoname_id: exact.id,
        lat: exact.lat,
        lng: exact.lng,
        admin: exact.a || null,
        unverified: false,
      });
    } else {
      onChange({ name: text, unverified: true });
    }
  };

  const helperText = !country
    ? 'Pick a country first.'
    : !allCities
    ? 'Loading cities...'
    : visibleCities.length === 0
    ? "Don't see your city? Just type it — we'll add it to the list."
    : `${visibleCities.length} cities available. Start typing to search.`;

  return (
    <div className={`space-y-2 ${className}`}>
      <Label htmlFor={id} className="text-[#333333] font-bold text-base">
        City
      </Label>
      <Input
        id={id}
        type="text"
        list={country ? listId : undefined}
        value={inputValue}
        onChange={handleChange}
        placeholder={placeholder || (country ? 'Start typing your city...' : 'Pick a country first')}
        disabled={!country}
        autoComplete="off"
        className="flex h-12 w-full rounded-xl border border-[#CFC6BA] bg-white px-3 py-2 text-base text-[#1F1F1F] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#E6B450] disabled:bg-gray-100 disabled:cursor-not-allowed"
      />
      {country && (
        <datalist id={listId}>
          {visibleCities.map((c) => {
            const label = c.a ? `${c.n}, ${c.a}` : c.n;
            return <option key={c.id} value={label} />;
          })}
        </datalist>
      )}
      <p className="text-brand-muted text-xs mt-1 font-medium">{helperText}</p>
    </div>
  );
};

export default CitySelect;
