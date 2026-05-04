import { supabase } from '../supabase';

export type AnimalType = 'dairy' | 'layers' | 'meat_birds';

export async function createDairyAnimal(userId: string, data: {
  name: string;
  breed: string;
  fresheningDate: string; // ISO date string
}) {
  const { data: animal, error } = await supabase
    .from('animals')
    .insert({
      user_id: userId,
      name: data.name,
      breed: data.breed,
      species: 'cow',
      freshening_date: data.fresheningDate,
    })
    .select()
    .single();

  if (error) throw error;
  return animal;
}

export async function createFlock(userId: string, data: {
  name: string;
  henCount: number;
  intakeDate: string; // ISO date string
}) {
  const { data: flock, error } = await supabase
    .from('flocks')
    .insert({
      user_id: userId,
      name: data.name,
      hen_count: data.henCount,
      intake_date: data.intakeDate,
      status: 'active',
    })
    .select()
    .single();

  if (error) throw error;
  return flock;
}

export async function createMeatBirdBatch(userId: string, data: {
  breed: string;
  chickCount: number;
  intakeDate: string; // ISO date string
}) {
  const { data: batch, error } = await supabase
    .from('meat_bird_batches')
    .insert({
      user_id: userId,
      breed: data.breed,
      chick_count: data.chickCount,
      intake_date: data.intakeDate,
      status: 'active',
    })
    .select()
    .single();

  if (error) throw error;
  return batch;
}
