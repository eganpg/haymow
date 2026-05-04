import { supabase } from '../supabase';

export type DairyFeedType = 'grain' | 'hay' | 'mineral' | 'pasture' | 'other';
export type LayerFeedType = 'layer-pellet' | 'scratch' | 'oyster-shell' | 'other';
export type MeatBirdFeedType = 'chick-starter' | 'grower' | 'finisher' | 'other';

export type FeedUnit = 'lbs' | 'flakes' | 'hours' | 'bags' | 'oz';

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
