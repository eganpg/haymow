// Feed entry queries — direct reads/writes against the feed_entries table.
// This is the lower-level companion to feedInventory.ts: where feedInventory.ts
// handles the "stock + cost" lifecycle, this file handles the raw entry rows
// (the audit log of what was fed, when, and to whom).

import { supabase } from '../supabase';

// Feed type vocabularies, scoped per animal type. The DB column is just `text`,
// but these unions document what values the app actually uses on each side so
// queries (and the upcoming feed→yield correlation) can filter consistently.
export type DairyFeedType = 'grain' | 'hay' | 'mineral' | 'pasture' | 'other';
export type LayerFeedType = 'layer-pellet' | 'scratch' | 'oyster-shell' | 'other';
export type MeatBirdFeedType = 'chick-starter' | 'grower' | 'finisher' | 'other';

// Units a feed amount can be expressed in. 'hours' is for pasture grazing.
export type FeedUnit = 'lbs' | 'flakes' | 'hours' | 'bags' | 'oz';

// Manually log a feed entry without going through the inventory system.
// Most feed logging happens via logFeedUsage() in feedInventory.ts (which deducts
// stock); this function is for free-form entries that don't draw from inventory —
// e.g. pasture hours where there's no "stock" to deduct.
export async function logFeedEntry(params: {
  userId: string;
  animalId?: string;
  flockId?: string;
  batchId?: string;
  feedType: string;
  amount: number;
  unit: FeedUnit;
  costPerUnit?: number;
  notes?: string;
}) {
  const { data, error } = await supabase
    .from('feed_entries')
    .insert({
      user_id: params.userId,
      animal_id: params.animalId ?? null,
      flock_id: params.flockId ?? null,
      batch_id: params.batchId ?? null,
      entry_time: new Date().toISOString(),
      feed_type: params.feedType,
      amount: params.amount,
      unit: params.unit,
      cost_per_unit: params.costPerUnit ?? null,
      notes: params.notes ?? null,
    })
    .select()
    .single();

  if (error) throw error;
  return data;
}

// One day's grain total, in lbs. Used by the Trends screen's feed-overlay chart.
// We deliberately only track grain-in-lbs here (not hay, not pasture hours) because
// summing across mixed units is meaningless and grain is what most directly
// correlates with milk yield.
export type DailyFeedTotal = {
  date: string;       // YYYY-MM-DD, local time
  grainLbs: number;   // sum of grain entries logged in lbs that day
};

// Build a YYYY-MM-DD key from a Date in the user's local timezone.
// We don't use toISOString() because that forces UTC, which would put a feed entry
// logged at 11pm local time into the next day's bucket. Local-time bucketing
// matches how the user thinks about days.
function localDateKey(d: Date): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

// Daily grain totals (in lbs) for an animal over the last `days` days.
// Returns one entry per day in the window, including zeros for days with no feed
// logged — that way the Trends chart can render a complete timeline without gaps.
// Filters strictly to feed_type='grain' AND unit='lbs' so the sum is meaningful.
export async function getDailyGrainLbs(animalId: string, days: number): Promise<DailyFeedTotal[]> {
  const start = new Date();
  start.setHours(0, 0, 0, 0);
  start.setDate(start.getDate() - (days - 1));

  const { data, error } = await supabase
    .from('feed_entries')
    .select('entry_time, feed_type, amount, unit')
    .eq('animal_id', animalId)
    .eq('feed_type', 'grain')
    .eq('unit', 'lbs')
    .gte('entry_time', start.toISOString())
    .order('entry_time', { ascending: true });
  if (error) throw error;

  const buckets = new Map<string, number>();
  for (let i = 0; i < days; i++) {
    const d = new Date(start);
    d.setDate(d.getDate() + i);
    buckets.set(localDateKey(d), 0);
  }
  for (const row of data ?? []) {
    const key = localDateKey(new Date(row.entry_time));
    if (buckets.has(key)) {
      buckets.set(key, buckets.get(key)! + Number(row.amount ?? 0));
    }
  }
  return Array.from(buckets, ([date, grainLbs]) => ({ date, grainLbs }));
}

// Recent raw feed entries for an animal or flock. Returns full rows (not aggregated).
// Used by profile screens to show "what did I feed lately" lists. Defaults to 7 days.
export async function getRecentFeedEntries(params: {
  animalId?: string;
  flockId?: string;
  days?: number;
}) {
  const cutoff = new Date();
  cutoff.setDate(cutoff.getDate() - (params.days ?? 7));

  let query = supabase
    .from('feed_entries')
    .select('*')
    .gte('entry_time', cutoff.toISOString())
    .order('entry_time', { ascending: false });

  if (params.animalId) query = query.eq('animal_id', params.animalId);
  if (params.flockId) query = query.eq('flock_id', params.flockId);

  const { data, error } = await query;
  if (error) throw error;
  return data ?? [];
}
