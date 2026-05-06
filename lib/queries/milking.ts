import { supabase } from '../supabase';
import {
  restoreFeedUsage,
  getFeedEntriesForSession,
  logFeedUsage,
} from './feedInventory';

export type MilkingSession = {
  id: string;
  animal_id: string;
  session_time: string;
  session_type: 'AM' | 'PM' | 'single';
  yield_lbs: number;
  notes: string | null;
  health_tags: string[] | null;
};

export const LBS_PER_GALLON = 8.6;
export const toGallons = (lbs: number) => lbs / LBS_PER_GALLON;
export const toLbs = (gallons: number) => gallons * LBS_PER_GALLON;

export type YieldUnit = 'gal' | 'lbs';

export const yieldInUnit = (lbs: number, unit: YieldUnit): number =>
  unit === 'lbs' ? lbs : toGallons(lbs);

export const yieldToLbs = (value: number, unit: YieldUnit): number =>
  unit === 'lbs' ? value : toLbs(value);

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

export async function logMilkingSession(params: {
  animalId: string;
  userId: string;
  sessionType: 'AM' | 'PM' | 'single';
  yieldValue: number;
  yieldUnit: YieldUnit;
  sessionTime?: string; // ISO; defaults to now
  notes?: string;
  healthTags?: string[];
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
      created_via: 'app',
    })
    .select()
    .single();

  if (error) throw error;
  return data;
}

export async function getMilkingSession(sessionId: string): Promise<MilkingSession | null> {
  const { data, error } = await supabase
    .from('milking_sessions')
    .select('*')
    .eq('id', sessionId)
    .maybeSingle();
  if (error) throw error;
  return data;
}

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

export async function deleteMilkingSession(sessionId: string) {
  // Restore inventory for any linked feed entries before removing them.
  const linkedFeed = await getFeedEntriesForSession(sessionId);
  for (const entry of linkedFeed) {
    if (entry.feed_inventory_id) {
      await restoreFeedUsage(entry.feed_inventory_id, entry.amount);
    }
  }

  if (linkedFeed.length > 0) {
    const { error: feedDeleteError } = await supabase
      .from('feed_entries')
      .delete()
      .eq('milking_session_id', sessionId);
    if (feedDeleteError) throw feedDeleteError;
  }

  const { error } = await supabase
    .from('milking_sessions')
    .delete()
    .eq('id', sessionId);
  if (error) throw error;
}

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

export type DailyYield = {
  date: string;       // YYYY-MM-DD, local time
  totalLbs: number;
  sessionCount: number;
};

function localDateKey(d: Date): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

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

export function getDIM(fresheningDate: string): number {
  const freshening = new Date(fresheningDate);
  const today = new Date();
  const diff = today.getTime() - freshening.getTime();
  return Math.floor(diff / (1000 * 60 * 60 * 24));
}
