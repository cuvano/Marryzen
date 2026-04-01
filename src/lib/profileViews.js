/**
 * Record that viewerId opened viewedProfileId's profile (for "Who viewed you").
 * Uses profile_views UNIQUE(viewer_id, viewed_profile_id); duplicates are ignored.
 */
export async function recordProfileView(supabase, viewerId, viewedProfileId) {
  if (!supabase || !viewerId || !viewedProfileId || viewerId === viewedProfileId) return;

  const { error } = await supabase.from('profile_views').insert({
    viewer_id: viewerId,
    viewed_profile_id: viewedProfileId,
  });

  if (error && error.code !== '23505') {
    console.warn('recordProfileView:', error.message);
  }
}
