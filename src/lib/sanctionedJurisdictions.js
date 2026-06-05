// src/lib/sanctionedJurisdictions.js
//
// Single source of truth for jurisdictions where Marryzen cannot accept
// Country of Residence. Three categories:
//
//   1. OFAC sanctions (US Treasury) — hard block, non-negotiable.
//   2. Secondary sanctions + data localization — blocked for compliance
//      and operational reasons (e.g., Russia 152-FZ data localization).
//   3. Data-protection rep designation required, not yet purchased —
//      blocked until Marryzen appoints a representative under the local
//      law. Lift conditions documented in
//      C:\Marryzen\handoff\geo_block\BLOCKED_COUNTRIES.md.
//
// Country of Origin (heritage) is NOT affected by this list. A Syrian
// refugee living in Germany can absolutely sign up.
//
// MUST-MATCH SPELLING: every string here must exactly match an entry in
// the COUNTRIES array in src/components/onboarding/Step1b.jsx (case +
// diacritics). If a string here doesn't match a dropdown option, the
// block silently fails for that country.
//
// MIRROR REQUIRED: the supabase/migrations trigger function
// public._block_sanctioned_residence() must mirror this list at the DB
// layer for defense-in-depth. When you change this list, update both.
//
// When you change this list:
//   1. Update the comment block above with date + reason
//   2. Mirror the change in C:\Marryzen\handoff\geo_block\BLOCKED_COUNTRIES.md
//   3. Mirror the change in supabase/migrations/<date>_block_sanctioned_residence_trigger.sql
//   4. Confirm Step1b.jsx dropdown rendering still uses SANCTIONED_RESIDENCE
//   5. Confirm OnboardingPage.validateStep1 still uses SANCTIONED_RESIDENCE

export const SANCTIONED_RESIDENCE = [
  // === OFAC comprehensive sanctions (5) ===
  "Cuba",
  "Iran",
  "North Korea",
  "Syria",
  "Venezuela",

  // === US/EU sanctions + data localization (2) ===
  "Russia",   // Federal Law 152-FZ data localization + sanctions
  "Belarus",  // Secondary sanctions, restricted business operations

  // === Data-protection rep designation required (14) ===
  // Lift block by: (a) purchasing the local rep designation, (b) removing
  // the country here, (c) updating BLOCKED_COUNTRIES.md to mark as ALLOW,
  // (d) removing from supabase trigger migration.
  "China",                // PIPL (2021) — gov-registered rep + cross-border data transfer cert required
  "Türkiye",              // KVKK Art. 16 (2016) — rep required, active enforcement (Amazon $1M 2023)
  "Brazil",               // LGPD Art. 5(VIII) — rep required, ANPD active
  "Switzerland",          // FADP (revised 2023) — rep required for most processing
  "Saudi Arabia",         // PDPL (2023) — rep required, enforcement rolling out
  "United Arab Emirates", // PDPL (2021) — conditional rep, blocked conservatively
  "South Korea",          // PIPA — rep required, active enforcement (Meta, Google fines)
  "Japan",                // APPI (revised 2022) — rep required for foreign businesses
  "India",                // DPDP Act (2023) — rep required, DPB enforcement ramping
  "Kazakhstan",           // PDP Law — local rep + data localization (similar to Russia 152-FZ)
  "Indonesia",            // UU PDP (2022) — rep required, post-2024 enforcement (TikTok Shop ban etc.)
  "Vietnam",              // Decree 13/2023 — data localization + local rep
  "Qatar",                // PDPPL (Law No. 13/2016) — rep required, special-category data restrictions for religion
  "Nigeria",              // NDPA (2023) — Data Protection Compliance Organisation rep required, NDPC actively fining
];

/**
 * Filter a country list, optionally allowing one grandfathered country
 * (the user's existing saved value, so we don't silently drop their data).
 *
 * Returns a new array with sanctioned countries removed, except the one
 * country passed as `grandfatherCountry` (typically the user's current
 * saved locationCountry). Caller should set `disabled={true}` on the
 * grandfathered option so it can't be re-selected once changed.
 *
 * NOTE: as of June 2026 the Step1b dropdown switched to the grey-out
 * pattern (all countries visible, blocked ones rendered as disabled
 * options with a "coming soon" suffix). This helper is preserved for
 * backward compat with any other call site that still wants the filter.
 */
export const filterResidenceCountries = (allCountries, grandfatherCountry) =>
  allCountries.filter((c) => !SANCTIONED_RESIDENCE.includes(c) || c === grandfatherCountry);
