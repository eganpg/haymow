// AppContext — the global "who is logged in and where should they be?" state.
// Wraps the entire app (see app/_layout.tsx) so any screen can read the current session
// and react to sign-in / sign-out / onboarding completion. The router uses `appState`
// to redirect: unauthenticated → /login, onboarding → /pick-type, ready → /(tabs).

import { createContext, useContext, useState, useEffect, ReactNode } from 'react';
import { Session } from '@supabase/supabase-js';
import { supabase } from './supabase';
import { hasCompletedOnboarding } from './queries/user';

// The four states the app can be in. Ordering matches the user journey:
//   loading       → still checking with Supabase whether there's a session
//   unauthenticated → no session, show the login screen
//   onboarding    → signed in but hasn't set up an animal/flock/batch yet
//   ready         → signed in and onboarded, show the main tabs
export type AppState = 'loading' | 'unauthenticated' | 'onboarding' | 'ready';

type AppContextValue = {
  session: Session | null;
  appState: AppState;
  refreshAppState: () => Promise<void>;
};

const AppContext = createContext<AppContextValue>({
  session: null,
  appState: 'loading',
  refreshAppState: async () => {},
});

// Wrap the app in this provider once (in app/_layout.tsx) so children can read
// the auth state via useApp().
export function AppProvider({ children }: { children: ReactNode }) {
  const [session, setSession] = useState<Session | null>(null);
  const [appState, setAppState] = useState<AppState>('loading');

  // Translate a Supabase session into our app's AppState.
  // No session → unauthenticated. Has a session → check onboarding status to decide
  // between 'onboarding' and 'ready'.
  async function resolveState(s: Session | null) {
    if (!s) {
      setSession(null);
      setAppState('unauthenticated');
      return;
    }
    setSession(s);
    const done = await hasCompletedOnboarding(s.user.id);
    setAppState(done ? 'ready' : 'onboarding');
  }

  // Manually re-check state — called after onboarding finishes so the app
  // transitions from 'onboarding' to 'ready' without waiting for an auth event.
  async function refreshAppState() {
    const { data: { session: s } } = await supabase.auth.getSession();
    await resolveState(s);
  }

  useEffect(() => {
    // On mount: read whatever session is already cached locally (instant if signed in,
    // null on first launch). Then subscribe to future changes — sign-in, sign-out,
    // token refresh — so the app reacts in real time.
    supabase.auth.getSession().then(({ data: { session: s } }) => resolveState(s));

    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, s) => {
      resolveState(s);
    });

    return () => subscription.unsubscribe();
  }, []);

  return (
    <AppContext.Provider value={{ session, appState, refreshAppState }}>
      {children}
    </AppContext.Provider>
  );
}

// Convenience hook: any screen can call useApp() to get { session, appState, refreshAppState }.
export function useApp() {
  return useContext(AppContext);
}
