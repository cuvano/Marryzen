// src/lib/sanctionedJurisdictions.js
//
// Single source of truth for jurisdictions where Marryzen cannot accept
// Country of Residence - either due to US sanctions (OFAC), Stripe
// payment-processor restrictions, or other compliance gates.
//
// Country of Origin (heritage) is NOT affected by this list. A Syrian
// refugee living in Germany can absolutely sign up.
//
// When you change this list:
// 1. Update the comment with date + reason
// 2. Confirm Step1.jsx dropdown filter uses SANCTIONED_RESIDENCE
// 3. Confirm OnboardingPage.validateStep1 uses SANCTIONED_RESIDENCE

export const SANCTIONED_RESIDENCE = [
  // OFAC comprehensive sanctions programs:
  "Cuba",
  "Iran",
  "North Korea",
  "Syria",
  // Stripe-blocked / sanctions-impacted:
  "Russia",
  "Belarus",
  // Tier 3 TIP + payment-processor restrictions:
  "Venezuela",
];

/**
 * Filter a country list, optionally allowing one grandfathered country
 * (the user's existing saved value, so we don't silently drop their data).
 *
 * Returns a new array with sanctioned countries removed, except the one
 * country passed as `grandfatherCountry` (typically the user's current
 * saved locationCountry). Caller should set `disabled={true}` on the
 * grandfathered option so it can't be re-selected once changed.
 */
export const filterResidenceCountries = (allCountries, grandfatherCountry) =>
  allCountries.filter((c) => !SANCTIONED_RESIDENCE.includes(c) || c === grandfatherCountry);
