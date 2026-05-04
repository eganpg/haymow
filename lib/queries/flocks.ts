import { supabase } from '../supabase';

export async function getUserAnimals(userId: string) {
  const { data, error } = await supabase
    .from('animals')
    .select('*')
    .eq('user_id', userId)
    .order('created_at', { ascending: true });
  if (error) throw error;
  return data ?? [];
}

export async function getUserFlocks(userId: string) {
  const { data, error } = await supabase
    .from('flocks')
    .select('*')
    .eq('user_id', userId)
    .order('created_at', { ascending: true });
  if (error) throw error;
  return data ?? [];
}

export async function getUserBatches(userId: string) {
  const { data, error } = await supabase
    .from('meat_bird_batches')
    .select('*')
    .eq('user_id', userId)
    .order('created_at', { ascending: true });
  if (error) throw error;
  return data ?? [];
}
