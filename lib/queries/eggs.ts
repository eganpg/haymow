// Egg collection queries — daily egg counts logged against a flock.
// One row per (flock, collection_date) — there's a unique constraint at the DB level,
// so re-logging for the same day overwrites rather than duplicates (handled at the
// app layer by checking getTodaysCollection first).

import { supabase } from '../supabase';

export type EggCollection = {
  id: string;
  flock_id: string;
  collection_date: string;
  egg_count: number;
  broken_count: number;
  soft_shell_count: number;
  notes: string | null;
};

// Today's egg log for a given flock, or null if nothing's been logged yet.
// Used by the Today screen to show the daily count and decide whether to render
// "Log egg collection" vs. "Update today's count".
// `today` is a YYYY-MM-DD date — derived from UTC ISO string. This means a log
// made just before midnight local time may bucket into the next UTC day; acceptable
// trade-off for v1 since the user only sees their own data.
export async function getTodaysCollection(flockId: string): Promise<EggCollection | null> {
  const today = new Date().toISOString().split('T')[0];

  const { data, error } = await supabase
    .from('egg_collections')
    .select('*')
    .eq('flock_id', flockId)
    .eq('collection_date', today)
    .maybeSingle();

  if (error) throw error;
  return data;
}

// Insert today's egg collection. Optional fields default to 0/null — the only
// truly required input is the egg count.
export async function logEggCollection(params: {
  flockId: string;
  userId: string;
  eggCount: number;
  brokenCount?: number;
  softShellCount?: number;
  notes?: string;
}) {
  const today = new Date().toISOString().split('T')[0];

  const { data, error } = await supabase
    .from('egg_collections')
    .insert({
      flock_id: params.flockId,
      user_id: params.userId,
      collection_date: today,
      egg_count: params.eggCount,
      broken_count: params.brokenCount ?? 0,
      soft_shell_count: params.softShellCount ?? 0,
      notes: params.notes ?? null,
      created_via: 'app',
    })
    .select()
    .single();

  if (error) throw error;
  return data;
}

// Lay rate = eggs / hens, expressed as a percent. A healthy flock runs 70–90%.
// Below 50% sustained for 3+ days is a flag (flock health, season, predator stress).
// Pure function — pulled out so screens can show it without re-querying.
export function getLayRate(eggCount: number, henCount: number): number {
  return Math.round((eggCount / henCount) * 100);
}
