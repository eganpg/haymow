// Milking session queries — the heart of the dairy side of the app.
// Handles logging, editing, and deleting milking sessions, plus aggregations for
// the Today and Trends screens. Sessions are linked to feed entries via
// feed_entries.milking_session_id (added in migration 003), so edits and deletes
// here also need to manage the associated inventory bookkeeping.

import { supabase } from '../supabase';
import {
  restoreFeedUsage,
  getFeedEntriesForSession,
  logFeedUsage,
} from './feedInventory';

// Shape returned by all the read functions below. yield_lbs is always in pounds —
// the gallon/lbs conversion happens in the UI layer based on user preference.
export type MilkingSession = {
  id: string;
  animal_id: string;
  session_time: string;
  session_type: 'AM' | 'PM' | 'single';
  yield_lbs: number;
  notes: string | null;
  health_tags: string[] | null;
  // True when the user backfilled a forgotten session from memory rather than
  // measuring it. Stored as its own column (migration 006) so feed→yield
  // correlation can exclude or down-weight these without parsing tag arrays.
  is_estimated: boolean;
};

// Average density of Jersey whole milk. Used everywhere we convert between gallons
// and lbs. Storage is always in lbs (more precise for partial measurements with
// a kitchen scale); display flips based on user preference.
export const LBS_PER_GALLON = 8.6;
export const toGallons = (lbs: number) => lbs / LBS_PER_GALLON;
export const toLbs = (gallons: number) => gallons * LBS_PER_GALLON;

export type YieldUnit = 'gal' | 'lbs';

// Convert a stored lbs value into the user's preferred display unit. If they're
// already on lbs, this is a no-op; gal flips through the conversion.
export const yieldInUnit = (lbs: number, unit: YieldUnit): number =>
  unit === 'lbs' ? lbs : toGallons(lbs);

// Inverse of yieldInUnit — take a value the user typed in their preferred unit
// and convert to lbs for storage. Used by every place that writes a yield.
export const yieldToLbs = (value: number, unit: YieldUnit): number =>
  unit === 'lbs' ? value : toLbs(value);

// Today's milking sessions for an animal, in chronological order.
// Used by the Today screen to compute daily totals and AM/PM checkmarks.
// Day boundaries are local time (setHours(0,0,0,0)) so a 5am session today
// doesn't accidentally show up under "yesterday."
export async function getTodaysSessions(animalId: string): Promise<MilkingSession[]> {
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const tomorrow = new Date(today);
  tomorrow.setDate(tomorrow.getDate() + 1);

  const { data, error } = await supabase
    .from('milking_sessions')
    .select('*')
    .eq('animal_id', animalId)
    .gte('session_time', today.toISOString())
    .lt('session_time', tomorrow.toISOString())
    .order('session_time', { ascending: true });

  if (error) throw error;
  return data ?? [];
}

// Insert a new milking session row. yieldValue can be in either gallons or lbs;
// we always normalize to lbs for storage. Doesn't touch feed entries — the caller
// (log-milking.tsx) handles those separately via logFeedUsage().
export async function logMilkingSession(params: {
  animalId: string;
  userId: string;
  sessionType: 'AM' | 'PM' | 'single';
  yieldValue: number;
  yieldUnit: YieldUnit;
  sessionTime?: string; // ISO; defaults to now
  notes?: string;
  healthTags?: string[];
  isEstimated?: boolean;
}) {
  const { data, error } = await supabase
    .from('milking_sessions')
    .insert({
      animal_id: params.animalId,
      user_id: params.userId,
      session_time: params.sessionTime ?? new Date().toISOString(),
      session_type: params.sessionType,
      yield_lbs: yieldToLbs(params.yieldValue, params.yieldUnit),
      notes: params.notes ?? null,
      health_tags: params.healthTags ?? [],
      is_estimated: params.isEstimated ?? false,
      created_via: 'app',
    })
    .select()
    .single();

  if (error) throw error;
  return data;
}

// Fetch a single session by id. Used by the edit-session screen to populate the form.
// maybeSingle() returns null (instead of erroring) if the row is gone — defensive
// for the case where someone deletes a session in another tab while you're editing.
export async function getMilkingSession(sessionId: string): Promise<MilkingSession | null> {
  const { data, error } = await supabase
    .from('milking_sessions')
    .select('*')
    .eq('id', sessionId)
    .maybeSingle();
  if (error) throw error;
  return data;
}

// Update an existing milking session, including reconciling its feed entries.
// The reconciliation strategy is "lazy diff": revert all old feed deductions, delete
// the old feed_entries rows, then re-log the new feed list. This is simpler than
// trying to compute a delta, and inventory ends up in the same final state.
// session_time is updatable too — the user can correct a wrong AM/PM timestamp.
export async function updateMilkingSession(params: {
  sessionId: string;
  userId: string;
  animalId: string;
  sessionType: 'AM' | 'PM' | 'single';
  yieldValue: number;
  yieldUnit: YieldUnit;
  sessionTime: string; // ISO
  notes?: string;
  healthTags?: string[];
  isEstimated?: boolean;
  feedEntries: Array<{ feedInventoryId: string; amount: number }>;
}) {
  // 1. Update the session row, including session_time so the user can correct it.
  const { error: updateError } = await supabase
    .from('milking_sessions')
    .update({
      session_time: params.sessionTime,
      session_type: params.sessionType,
      yield_lbs: yieldToLbs(params.yieldValue, params.yieldUnit),
      notes: params.notes ?? null,
      health_tags: params.healthTags ?? [],
      is_estimated: params.isEstimated ?? false,
    })
    .eq('id', params.sessionId);
  if (updateError) throw updateError;

  // 2. Reconcile feed entries: revert old deductions, delete old rows, then re-log.
  //    Lazy approach — simpler than diffing. Inventory ends in the right place.
  const existing = await getFeedEntriesForSession(params.sessionId);

  for (const entry of existing) {
    if (entry.feed_inventory_id) {
      await restoreFeedUsage(entry.feed_inventory_id, entry.amount);
    }
  }

  if (existing.length > 0) {
    const { error: deleteError } = await supabase
      .from('feed_entries')
      .delete()
      .eq('milking_session_id', params.sessionId);
    if (deleteError) throw deleteError;
  }

  // 3. Re-log new feed entries with entry_time matching the session — keeps
  //    the feed→yield correlation join (12h window) consistent.
  for (const e of params.feedEntries) {
    await logFeedUsage({
      userId: params.userId,
      feedInventoryId: e.feedInventoryId,
      animalId: params.animalId,
      milkingSessionId: params.sessionId,
      amount: e.amount,
      entryTime: params.sessionTime,
    });
  }
}

// Delete a milking session and undo its feed-inventory side effects.
// We do this in app code (not via DB cascade) because we need to RESTORE inventory
// for each linked feed entry before deleting it — a cascade would just drop the rows
// and leave inventory understated forever.
// The migration's ON DELETE SET NULL on feed_entries.milking_session_id is the
// safety net for cases where a session somehow gets deleted through another path.
export async function deleteMilkingSession(sessionId: string) {
  // Step 1: revert each linked feed deduction so inventory matches reality.
  const linkedFeed = await getFeedEntriesForSession(sessionId);
  for (const entry of linkedFeed) {
    if (entry.feed_inventory_id) {
      await restoreFeedUsage(entry.feed_inventory_id, entry.amount);
    }
  }

  // Step 2: delete the feed_entries rows themselves (no longer needed).
  if (linkedFeed.length > 0) {
    const { error: feedDeleteError } = await supabase
      .from('feed_entries')
      .delete()
      .eq('milking_session_id', sessionId);
    if (feedDeleteError) throw feedDeleteError;
  }

  // Step 3: delete the session.
  const { error } = await supabase
    .from('milking_sessions')
    .delete()
    .eq('id', sessionId);
  if (error) throw error;
}

// Last N days of milking sessions for an animal, newest first.
// Used by the dairy animal profile screen to render the "recent sessions" list.
export async function getRecentSessions(animalId: string, days = 7): Promise<MilkingSession[]> {
  const cutoff = new Date();
  cutoff.setDate(cutoff.getDate() - days);

  const { data, error } = await supabase
    .from('milking_sessions')
    .select('*')
    .eq('animal_id', animalId)
    .gte('session_time', cutoff.toISOString())
    .order('session_time', { ascending: false });

  if (error) throw error;
  return data ?? [];
}

// One day's aggregated yield. The Trends chart consumes an array of these.
// sessionCount is included so we can compute a per-day average that ignores days
// with no sessions logged — important because a missed log shouldn't drag the
// average down.
export type DailyYield = {
  date: string;       // YYYY-MM-DD, local time
  totalLbs: number;
  sessionCount: number;
};

// Local-time date key. See the same helper in feed.ts for the full rationale —
// short version: avoid UTC bucketing so 11pm sessions don't bleed into tomorrow.
function localDateKey(d: Date): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

// Daily yield totals for an animal over the last `days` days.
// Returns one entry per day in the window (including zeros) so the Trends chart
// renders a continuous timeline. Aggregation is done in JS rather than SQL because
// the dataset is small (≤ ~180 rows for 90 days) and the date-bucketing-in-local-time
// logic is awkward to express portably in a Supabase query.
export async function getDailyYields(animalId: string, days: number): Promise<DailyYield[]> {
  const start = new Date();
  start.setHours(0, 0, 0, 0);
  start.setDate(start.getDate() - (days - 1));

  const { data, error } = await supabase
    .from('milking_sessions')
    .select('session_time, yield_lbs')
    .eq('animal_id', animalId)
    .gte('session_time', start.toISOString())
    .order('session_time', { ascending: true });
  if (error) throw error;

  const buckets = new Map<string, { totalLbs: number; sessionCount: number }>();
  for (let i = 0; i < days; i++) {
    const d = new Date(start);
    d.setDate(d.getDate() + i);
    buckets.set(localDateKey(d), { totalLbs: 0, sessionCount: 0 });
  }
  for (const row of data ?? []) {
    const key = localDateKey(new Date(row.session_time));
    const bucket = buckets.get(key);
    if (bucket) {
      bucket.totalLbs += Number(row.yield_lbs ?? 0);
      bucket.sessionCount += 1;
    }
  }
  return Array.from(buckets, ([date, b]) => ({ date, ...b }));
}

// All sessions for an animal over the last `days` days, oldest first.
// Used by the Trends screen's tap-a-bar detail panel — we want the raw rows
// (with yields, session_type, notes, health tags) so we can group them by day
// on the client and render a per-day breakdown without an extra query per tap.
// Oldest-first ordering matches how the chart renders left-to-right; the screen
// re-bucketizes by local date and within a day sessions render AM then PM.
export async function getSessionsInRange(animalId: string, days: number): Promise<MilkingSession[]> {
  const start = new Date();
  start.setHours(0, 0, 0, 0);
  start.setDate(start.getDate() - (days - 1));

  const { data, error } = await supabase
    .from('milking_sessions')
    .select('*')
    .eq('animal_id', animalId)
    .gte('session_time', start.toISOString())
    .order('session_time', { ascending: true });
  if (error) throw error;
  return data ?? [];
}

// Days In Milk — how many days a dairy cow has been lactating.
// Calculated from her freshening (calving) date. Drives the lactation curve view
// and shows up as "Day N" on her profile and the Today card. Pure math; no DB hit.
export function getDIM(fresheningDate: string): number {
  const freshening = new Date(fresheningDate);
  const today = new Date();
  const diff = today.getTime() - freshening.getTime();
  return Math.floor(diff / (1000 * 60 * 60 * 24));
}
