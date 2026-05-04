import { createContext, useContext, useState, useEffect, ReactNode } from 'react';
import { Session } from '@supabase/supabase-js';
import { supabase } from './supabase';
import { hasCompletedOnboarding } from './queries/user';

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

export function AppProvider({ children }: { children: ReactNode }) {
  const [session, setSession] = useState<Session | null>(null);
  const [appState, setAppState] = useState<AppState>('loading');

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

  async function refreshAppState() {
    const { data: { session: s } } = await supabase.auth.getSession();
    await resolveState(s);
  }

  useEffect(() => {
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

export function useApp() {
  return useContext(AppContext);
}
