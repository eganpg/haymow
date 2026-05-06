// Egg collection queries.
// Each row in egg_collections represents ONE collection event — a single trip to
// the coop. A single day can have multiple events (morning + afternoon trips),
// and today's total is computed by summing them in getTodaysEggSummary().
// This matches how Pete actually collects eggs and preserves per-trip history
// (rather than collapsing the day into one mutable row).

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

// Aggregated view of "what got collected today" for a flock.
// totalCount sums every collection row from today; hasAny lets the UI decide
// between "Log first collection" and "Log more" copy.
export type EggDailySummary = {
  totalCount: number;
  brokenCount: number;
  softShellCount: number;
  hasAny: boolean;
};

// Today's running totals for a flock — sums every collection row for the day.
// Used by the Today screen's LayerCard.
// `today` is a YYYY-MM-DD string from a UTC ISO conversion. A log made just
// before midnight local time may bucket into the next UTC day; acceptable for v1.
export async function getTodaysEggSummary(flockId: string): Promise<EggDailySummary> {
  const today = new Date().toISOString().split('T')[0];

  const { data, error } = await supabase
    .from('egg_collections')
    .select('egg_count, broken_count, soft_shell_count')
    .eq('flock_id', flockId)
    .eq('collection_date', today);

  if (error) throw error;

  const rows = data ?? [];
  return {
    totalCount: rows.reduce((s, r) => s + (r.egg_count ?? 0), 0),
    brokenCount: rows.reduce((s, r) => s + (r.broken_count ?? 0), 0),
    softShellCount: rows.reduce((s, r) => s + (r.soft_shell_count ?? 0), 0),
    hasAny: rows.length > 0,
  };
}

// Log a single collection event. Each call inserts a new row — multiple calls
// for the same flock on the same day are intentional (they represent separate
// trips to the coop) and add to the daily total via getTodaysEggSummary.
// Optional fields default to 0/null — the only required input is egg count.
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
