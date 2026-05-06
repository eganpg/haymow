// User preferences stored on the device (not in Supabase).
// Currently just one preference: whether to display milk yield in gallons or pounds.
// Stored in SecureStore on native and localStorage on web. We keep an in-memory cache
// + a listener set so that any screen using useYieldUnit() updates instantly when the
// user flips the toggle in Settings — no need to refetch from storage.

import * as SecureStore from 'expo-secure-store';
import { Platform } from 'react-native';
import { useEffect, useState } from 'react';

export type YieldUnit = 'gal' | 'lbs';

const UNIT_KEY = 'haymow_yield_unit';

// Module-level cache. Read once on first use, kept in sync with storage on writes.
// Defaults to 'gal' since that's the more common homesteader unit.
let cachedUnit: YieldUnit = 'gal';
let initialized = false;
// Subscribers — every component using useYieldUnit() registers here so it can re-render
// when the preference changes (without each one having to re-read from storage).
const listeners = new Set<(u: YieldUnit) => void>();

// Pull the saved preference off disk. Returns 'gal' as a safe default if anything goes wrong.
async function readFromStorage(): Promise<YieldUnit> {
  try {
    const val = Platform.OS === 'web'
      ? (typeof localStorage !== 'undefined' ? localStorage.getItem(UNIT_KEY) : null)
      : await SecureStore.getItemAsync(UNIT_KEY);
    return val === 'lbs' ? 'lbs' : 'gal';
  } catch {
    return 'gal';
  }
}

// Persist the preference to disk. Failures are swallowed — preference loss isn't fatal.
async function writeToStorage(unit: YieldUnit) {
  try {
    if (Platform.OS === 'web') {
      if (typeof localStorage !== 'undefined') localStorage.setItem(UNIT_KEY, unit);
    } else {
      await SecureStore.setItemAsync(UNIT_KEY, unit);
    }
  } catch {}
}

// Eager initializer — call once at app startup so the cache is warm before any
// screen tries to read the preference. Subsequent calls are no-ops.
export async function initYieldUnit(): Promise<YieldUnit> {
  if (initialized) return cachedUnit;
  cachedUnit = await readFromStorage();
  initialized = true;
  listeners.forEach(l => l(cachedUnit));
  return cachedUnit;
}

// Synchronous reader — useful inside non-React code (queries, helpers) where you
// can't use a hook. Returns the cached value, which may be stale on first call
// if initYieldUnit() hasn't completed yet.
export function getYieldUnit(): YieldUnit {
  return cachedUnit;
}

// Update the preference. Writes to storage and notifies all listening components
// so the UI updates everywhere at once.
export async function setYieldUnitPref(unit: YieldUnit) {
  cachedUnit = unit;
  initialized = true;
  await writeToStorage(unit);
  listeners.forEach(l => l(unit));
}

// React hook — use in any component that needs to display a unit-aware value.
// Subscribes to changes so the component re-renders when the user flips the toggle.
export function useYieldUnit(): YieldUnit {
  const [unit, setUnit] = useState<YieldUnit>(cachedUnit);
  useEffect(() => {
    if (!initialized) initYieldUnit().then(setUnit);
    listeners.add(setUnit);
    return () => { listeners.delete(setUnit); };
  }, []);
  return unit;
}
