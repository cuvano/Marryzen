/**
 * Shared logic for match-related counts so Dashboard and My Matches show the same numbers.
 * Potential Matches = approved profiles the user hasn't interacted with, matching preferred gender (excluding self, interactions, blocked).
 */

/**
 * @param {import('@supabase/supabase-js').SupabaseClient} supabase
 * @param {string} userId
 * @returns {Promise<number>}
 */
export async function getPotentialMatchesCount(supabase, userId) {
  const { data: profile } = await supabase
    .from('profiles')
    .select('looking_for_gender')
    .eq('id', userId)
    .maybeSingle();

  const preferredGender = profile?.looking_for_gender?.trim();
  const genderValues = !preferredGender ? [] : preferredGender === 'Man' ? ['Man', 'Male'] : preferredGender === 'Woman' ? ['Woman', 'Female'] : [preferredGender];

  const { data: interactions } = await supabase
    .from('user_interactions')
    .select('target_user_id')
    .eq('user_id', userId);

  const { data: blocked } = await supabase
    .from('user_blocks')
    .select('blocked_user_id')
    .eq('blocker_id', userId);

  const excludeIds = new Set([
    userId,
    ...(interactions?.map((i) => i.target_user_id) || []),
    ...(blocked?.map((b) => b.blocked_user_id) || []),
  ]);

  let query = supabase.from('profiles').select('id').eq('status', 'approved');
  if (genderValues.length > 0) {
    query = query.in('identify_as', genderValues);
  }
  const { data: allApproved, error } = await query;

  if (error) throw error;

  return (allApproved || []).filter((p) => !excludeIds.has(p.id)).length;
}
