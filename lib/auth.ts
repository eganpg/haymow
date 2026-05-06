// Google Sign In — the only auth method in v1 (no email/password, no Apple).
// The flow differs between web and native because mobile apps can't just redirect
// the whole browser; they have to pop an in-app browser window and catch the result.

import { supabase } from './supabase';
import { makeRedirectUri } from 'expo-auth-session';
import * as WebBrowser from 'expo-web-browser';
import { Platform } from 'react-native';

// Required by expo-web-browser to finish the auth session if the app was reopened
// from the OAuth redirect on iOS/Android. No-op on web.
WebBrowser.maybeCompleteAuthSession();

// Kick off the Google sign-in flow. On success, Supabase fires onAuthStateChange,
// which AppContext is listening to, which transitions the app out of 'unauthenticated'.
export async function signInWithGoogle() {
  if (Platform.OS === 'web') {
    // Web: Supabase handles the entire OAuth dance via redirect. The user goes to
    // Google, signs in, gets redirected back to our origin, and Supabase picks up
    // the code from the URL (detectSessionInUrl: true in supabase.ts).
    const { error } = await supabase.auth.signInWithOAuth({
      provider: 'google',
      options: {
        redirectTo: window.location.origin,
      },
    });
    if (error) throw error;
  } else {
    // Native: we need to open Google's auth page in an in-app browser, then catch
    // the redirect back to our custom URL scheme (haymow://) and manually exchange
    // the auth code for a session.
    const redirectUri = makeRedirectUri({ scheme: 'haymow' });

    // Ask Supabase for the Google OAuth URL but DON'T let it redirect the page —
    // we'll open it ourselves so we can intercept the response.
    const { data, error } = await supabase.auth.signInWithOAuth({
      provider: 'google',
      options: {
        redirectTo: redirectUri,
        skipBrowserRedirect: true,
      },
    });

    if (error) throw error;
    if (!data.url) throw new Error('No OAuth URL returned');

    // Pop the in-app browser. This blocks until the user signs in (or cancels)
    // and Google redirects back to haymow:// with a `code` query param.
    const result = await WebBrowser.openAuthSessionAsync(data.url, redirectUri);

    if (result.type === 'success' && result.url) {
      // Pull the auth code out of the redirect URL and trade it for a real session.
      // After this, the auth.onAuthStateChange listener in AppContext fires.
      const url = new URL(result.url);
      const code = url.searchParams.get('code');
      if (code) {
        await supabase.auth.exchangeCodeForSession(code);
      }
    }
  }
}

// Sign out and clear the session from storage.
// AppContext's onAuthStateChange listener picks this up and routes to /login.
export async function signOut() {
  await supabase.auth.signOut();
}
