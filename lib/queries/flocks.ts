// Read-side "list everything for a user" queries.
// (File is named flocks.ts for historical reasons — it actually holds list queries
// for all three animal types. Companion to animals.ts which has the create-side.)
// All three list functions sort by created_at ascending so the user's first-added
// animal/flock/batch shows first — gives a stable, predictable order in lists.

import { supabase } from '../supabase';

// All dairy animals belonging to this user. Used by the Animals tab and the
// Today screen to render dairy cards.
export async function getUserAnimals(userId: string) {
  const { data, error } = await supabase
    .from('animals')
    .select('*')
    .eq('user_id', userId)
    .order('created_at', { ascending: true });
  if (error) throw error;
  return data ?? [];
}

// All layer-hen flocks belonging to this user. The Today screen filters this to
// status='active' on its own; this function returns all of them so the Animals
// tab can show retired/molting flocks too.
export async function getUserFlocks(userId: string) {
  const { data, error } = await supabase
    .from('flocks')
    .select('*')
    .eq('user_id', userId)
    .order('created_at', { ascending: true });
  if (error) throw error;
  return data ?? [];
}

// All meat-bird batches (active and processed) for this user.
// "Processed" batches stay in the list so historical cost-per-lb stays visible.
export async function getUserBatches(userId: string) {
  const { data, error } = await supabase
    .from('meat_bird_batches')
    .select('*')
    .eq('user_id', userId)
    .order('created_at', { ascending: true });
  if (error) throw error;
  return data ?? [];
}
