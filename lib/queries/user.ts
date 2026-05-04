import { supabase } from '../supabase';

// Returns true if the user has completed onboarding (has at least one animal, flock, or batch)
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

// Create a free-tier subscription for new users
export async function createSubscription(userId: string, isFoundingMember: boolean) {
  await supabase.from('subscriptions').upsert({
    user_id: userId,
    tier: isFoundingMember ? 'homestead' : 'free',
    is_founding_member: isFoundingMember,
  });
}

// Get total user count (for founding member logic — first 500 get homestead free)
export async function getTotalUserCount(): Promise<number> {
  const { count } = await supabase
    .from('subscriptions')
    .select('id', { count: 'exact', head: true });
  return count ?? 0;
}
