/**
 * True if lastActiveAt falls on the same local calendar day as `reference` (browser timezone).
 * Used for “Active today” on Discovery — not a rolling 30-day window.
 */
export function isProfileActiveLocalToday(lastActiveAt, reference = new Date()) {
  if (lastActiveAt == null || lastActiveAt === '') return false;
  const last = new Date(lastActiveAt);
  if (Number.isNaN(last.getTime())) return false;
  return (
    last.getFullYear() === reference.getFullYear() &&
    last.getMonth() === reference.getMonth() &&
    last.getDate() === reference.getDate()
  );
}

const PULSE_STORAGE_KEY = 'mz_last_active_pulse_v1';
const PULSE_MIN_MS = 5 * 60 * 1000; // at most one write per 5 minutes per tab

/** Updates profiles.last_active_at for the signed-in user (throttled). */
export async function touchLastActiveIfDue(supabase) {
  if (!supabase) return;
  const now = Date.now();
  const prev = parseInt(sessionStorage.getItem(PULSE_STORAGE_KEY) || '0', 10);
  if (now - prev < PULSE_MIN_MS) return;

  const { data: { user } } = await supabase.auth.getUser();
  if (!user?.id) return;

  sessionStorage.setItem(PULSE_STORAGE_KEY, String(now));
  const { error } = await supabase
    .from('profiles')
    .update({ last_active_at: new Date().toISOString() })
    .eq('id', user.id);

  if (error) {
    console.warn('touchLastActiveIfDue:', error.message);
  }
}
