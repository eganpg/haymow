import * as SecureStore from 'expo-secure-store';
import { Platform } from 'react-native';
import { useEffect, useState } from 'react';

export type YieldUnit = 'gal' | 'lbs';

const UNIT_KEY = 'haymow_yield_unit';

let cachedUnit: YieldUnit = 'gal';
let initialized = false;
const listeners = new Set<(u: YieldUnit) => void>();

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

async function writeToStorage(unit: YieldUnit) {
  try {
    if (Platform.OS === 'web') {
      if (typeof localStorage !== 'undefined') localStorage.setItem(UNIT_KEY, unit);
    } else {
      await SecureStore.setItemAsync(UNIT_KEY, unit);
    }
  } catch {}
}

export async function initYieldUnit(): Promise<YieldUnit> {
  if (initialized) return cachedUnit;
  cachedUnit = await readFromStorage();
  initialized = true;
  listeners.forEach(l => l(cachedUnit));
  return cachedUnit;
}

export function getYieldUnit(): YieldUnit {
  return cachedUnit;
}

export async function setYieldUnitPref(unit: YieldUnit) {
  cachedUnit = unit;
  initialized = true;
  await writeToStorage(unit);
  listeners.forEach(l => l(unit));
}

export function useYieldUnit(): YieldUnit {
  const [unit, setUnit] = useState<YieldUnit>(cachedUnit);
  useEffect(() => {
    if (!initialized) initYieldUnit().then(setUnit);
    listeners.add(setUnit);
    return () => { listeners.delete(setUnit); };
  }, []);
  return unit;
}
