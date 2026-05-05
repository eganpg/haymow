import { supabase } from '../supabase';

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
  notes?: string;
  healthTags?: string[];
}) {
  const { data, error } = await supabase
    .from('milking_sessions')
    .insert({
      animal_id: params.animalId,
      user_id: params.userId,
      session_time: new Date().toISOString(),
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

export function getDIM(fresheningDate: string): number {
  const freshening = new Date(fresheningDate);
  const today = new Date();
  const diff = today.getTime() - freshening.getTime();
  return Math.floor(diff / (1000 * 60 * 60 * 24));
}
