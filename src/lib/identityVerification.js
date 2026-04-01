/**
 * Public “ID verified” (Discovery filter, profile cards). Uses `profiles.is_verified` only.
 * `identity_verification_status` is workflow state; it must not override an admin turning Verified off.
 */
export function isIdVerifiedPublic(p) {
  return p?.is_verified === true;
}
