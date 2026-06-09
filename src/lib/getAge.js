// src/lib/getAge.js
//
// Single source of truth for age calculation from date_of_birth.
//
// LEVEL-3 AUDIT 2026-06-08:
// Six different files (DiscoveryPage, ProfilePage, MatchesPage, plus
// internal helpers) all computed age as:
//   new Date().getFullYear() - new Date(dob).getFullYear()
// That's wrong: it returns age+1 for any user whose birthday hasn't
// occurred yet in the current year. Combined with strict age filter
// boundaries on /discovery, profiles within 12 months of either side
// of the slider boundary silently disappeared/reappeared.
//
// This util is the only correct implementation. All consumers should
// import from here. Defensive against null/undefined/invalid dates.

/**
 * Calculate a person's age in years from their date of birth.
 *
 * @param {string|Date|null|undefined} dob — ISO date string, Date object, or null
 * @returns {number|null} — age in completed years, or null if dob is invalid
 *
 * Examples:
 *   getAge('1990-06-15')   on 2026-06-08 → 35  (birthday hasn't passed yet)
 *   getAge('1990-06-15')   on 2026-06-16 → 36  (birthday passed)
 *   getAge('1990-02-29')   on 2026-02-28 → 35  (leap-year edge case)
 *   getAge(null)                          → null
 *   getAge('not a date')                  → null
 */
export function getAge(dob) {
  if (!dob) return null;
  const birth = new Date(dob);
  if (isNaN(birth.getTime())) return null;
  const now = new Date();
  let age = now.getFullYear() - birth.getFullYear();
  const monthDiff = now.getMonth() - birth.getMonth();
  // If we haven't reached the birth month yet this year, subtract 1.
  // If we're in the birth month but before the birth day, subtract 1.
  if (monthDiff < 0 || (monthDiff === 0 && now.getDate() < birth.getDate())) {
    age -= 1;
  }
  return age;
}

/**
 * Convenience: render '' instead of null for view-only contexts.
 * Use this in JSX where '' is the safer fallback than null/undefined.
 */
export function getAgeString(dob) {
  const a = getAge(dob);
  return a == null ? '' : String(a);
}
