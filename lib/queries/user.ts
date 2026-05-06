// User-account level queries: onboarding completion check and subscription setup.
// Called from AppContext (to decide what state to enter) and from the onboarding flow
// (to create a subscription row when a new user finishes setup).

import { supabase } from '../supabase';

// Returns true if the user has finished onboarding, defined as "has at least one
// animal, flock, or batch in the database." We use this instead of a separate
// "onboarded" flag because the existence of an animal IS the proof that they finished.
// Runs three count queries in parallel — { count: 'exact', head: true } is the
// Supabase pattern for "just give me the count, don't return any rows."
export async function hasCompletedOnboarding(userId: string): Promise<boolean> {
  const [animals, flocks, batches] = await Promise.all([
    supabase.from('animals').select('id', { count: 'exact', head: true }).eq('user_id', userId),
    supabase.from('flocks').select('id', { count: 'exact', head: true }).eq('user_id', userId),
    supabase.from('meat_bird_batches').select('id', { count: 'exact', head: true }).eq('user_id', userId),
  ]);

  return (
    (animals.count ?? 0) > 0 ||
    (flocks.count ?? 0) > 0 ||
    (batches.count ?? 0) > 0
  );
}

// Create the user's subscription row. Founding members (first 500 signups) get
// 'homestead' tier free for life — everyone else starts on 'free'.
// Uses upsert so re-running this for an existing user is safe (won't duplicate).
export async function createSubscription(userId: string, isFoundingMember: boolean) {
  await supabase.from('subscriptions').upsert({
    user_id: userId,
    tier: isFoundingMember ? 'homestead' : 'free',
    is_founding_member: isFoundingMember,
  });
}

// Total signups so far. Used during onboarding to decide if the new user is
// inside the first-500 founding-member window.
export async function getTotalUserCount(): Promise<number> {
  const { count } = await supabase
    .from('subscriptions')
    .select('id', { count: 'exact', head: true });
  return count ?? 0;
}
