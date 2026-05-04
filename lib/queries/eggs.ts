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

export function getLayRate(eggCount: number, henCount: number): number {
  return Math.round((eggCount / henCount) * 100);
}
