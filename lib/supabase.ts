// Supabase client — single source of truth for talking to our database and auth.
// Every query in lib/queries/* imports the `supabase` export from this file.
// On native (iOS/Android) we use Expo SecureStore for the auth session token;
// on web we fall back to localStorage because SecureStore isn't available there.

import 'react-native-url-polyfill/auto';
import { createClient } from '@supabase/supabase-js';
import * as SecureStore from 'expo-secure-store';
import { Platform } from 'react-native';

// Storage adapter that Supabase uses to persist the auth session.
// SecureStore is encrypted at rest on iOS/Android; localStorage is the best we can do on web.
// The `typeof localStorage` check protects against SSR (server-side rendering),
// where neither `window` nor `localStorage` exist and would otherwise crash on import.
const ExpoSecureStoreAdapter = {
  getItem: (key: string) => {
    if (Platform.OS === 'web') {
      if (typeof localStorage === 'undefined') return Promise.resolve(null);
      return Promise.resolve(localStorage.getItem(key));
    }
    return SecureStore.getItemAsync(key);
  },
  setItem: (key: string, value: string) => {
    if (Platform.OS === 'web') {
      if (typeof localStorage !== 'undefined') localStorage.setItem(key, value);
      return Promise.resolve();
    }
    return SecureStore.setItemAsync(key, value);
  },
  removeItem: (key: string) => {
    if (Platform.OS === 'web') {
      if (typeof localStorage !== 'undefined') localStorage.removeItem(key);
      return Promise.resolve();
    }
    return SecureStore.deleteItemAsync(key);
  },
};

// EXPO_PUBLIC_ prefix means these get bundled into the app at build time and are
// safe to ship to clients. The anon key is the public key; it's RLS (Row Level Security)
// in Postgres that actually keeps users' data private, not key secrecy.
const supabaseUrl = process.env.EXPO_PUBLIC_SUPABASE_URL!;
const supabaseAnonKey = process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY!;

export const supabase = createClient(supabaseUrl, supabaseAnonKey, {
  auth: {
    storage: ExpoSecureStoreAdapter,
    autoRefreshToken: true,         // refresh the JWT before it expires so the user stays signed in
    persistSession: true,           // keep the session across app restarts
    detectSessionInUrl: Platform.OS === 'web', // OAuth callback comes back as a URL on web; native uses the deep link flow
  },
});
