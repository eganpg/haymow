// Create-side queries for the three animal types.
// Despite the filename, this file handles all three — dairy animals, layer flocks,
// and meat bird batches each get their own create function because their schemas
// (and therefore the input shape) are different.
// Read-side queries for these tables live in queries/flocks.ts (also misnamed, but
// it holds the shared "list everything for a user" fetches).

import { supabase } from '../supabase';

// What the rest of the app calls each animal category. Matches the type-counting
// rules in the subscription tier limits (1 type free, 3 on homestead, ∞ on full_farm).
export type AnimalType = 'dairy' | 'layers' | 'meat_birds';

// Species under the "dairy" umbrella. The animals table already accepts all
// three (see migration 001 check constraint), so this is purely a TS guard for
// the UI picker. Opened up for MVP: dairy is no longer cow-only — anyone with
// a milking animal can use the app.
export type DairySpecies = 'cow' | 'goat' | 'sheep';

// Create a dairy animal. Freshening date = the date she last gave birth and
// started lactating (calving for cows, kidding for goats, lambing for sheep) —
// stored on the animal so we can compute Days In Milk (DIM). Species defaults
// to cow for callers that haven't been updated yet.
export async function createDairyAnimal(userId: string, data: {
  name: string;
  species?: DairySpecies;
  breed: string;
  fresheningDate: string; // ISO date string
}) {
  const { data: animal, error } = await supabase
    .from('animals')
    .insert({
      user_id: userId,
      name: data.name,
      breed: data.breed,
      species: data.species ?? 'cow',
      freshening_date: data.fresheningDate,
    })
    .select()
    .single();

  if (error) throw error;
  return animal;
}

// Create a layer-hen flock. hen_count is "how many laying hens are in this group" —
// used as the denominator when calculating lay rate %. Intake date is when this cohort
// arrived or hatched (used for cohort-level history).
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

// Create a meat bird batch (Cornish Cross typically). chick_count is the starting
// count — current flock size is derived as chick_count - sum(meat_bird_mortality.count).
// Intake date drives "day of batch" calculations for weight samples and processing.
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
