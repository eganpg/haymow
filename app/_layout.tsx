import FontAwesome from '@expo/vector-icons/FontAwesome';
import { useFonts } from 'expo-font';
import { Stack, useRouter, useSegments } from 'expo-router';
import * as SplashScreen from 'expo-splash-screen';
import { useEffect } from 'react';
import 'react-native-reanimated';
import { AppProvider, useApp } from '@/lib/AppContext';

export { ErrorBoundary } from 'expo-router';

SplashScreen.preventAutoHideAsync();

export default function RootLayout() {
  const [loaded, fontError] = useFonts({
    SpaceMono: require('../assets/fonts/SpaceMono-Regular.ttf'),
    ...FontAwesome.font,
  });

  useEffect(() => {
    if (fontError) throw fontError;
  }, [fontError]);

  return (
    <AppProvider>
      <RootLayoutNav fontsLoaded={loaded} />
    </AppProvider>
  );
}

function RootLayoutNav({ fontsLoaded }: { fontsLoaded: boolean }) {
  const { appState } = useApp();
  const router = useRouter();
  const segments = useSegments();

  useEffect(() => {
    if (!fontsLoaded || appState === 'loading') return;
    SplashScreen.hideAsync();
  }, [fontsLoaded, appState]);

  useEffect(() => {
    if (!fontsLoaded || appState === 'loading') return;

    const inAuth = segments[0] === '(auth)';
    const inOnboarding = segments[0] === '(onboarding)';
    const inTabs = segments[0] === '(tabs)';

    if (appState === 'unauthenticated' && !inAuth) {
      router.replace('/(auth)/login');
    } else if (appState === 'onboarding' && !inOnboarding) {
      router.replace('/(onboarding)/pick-type');
    } else if (appState === 'ready' && (inAuth || inOnboarding)) {
      // Only redirect to tabs if stuck on auth/onboarding screens — not other app screens
      router.replace('/(tabs)');
    }
  }, [appState, segments, fontsLoaded]);

  return (
    <Stack>
      <Stack.Screen name="(tabs)" options={{ headerShown: false }} />
      <Stack.Screen name="(auth)/login" options={{ headerShown: false }} />
      <Stack.Screen name="(onboarding)/pick-type" options={{ headerShown: false }} />
      <Stack.Screen name="(onboarding)/setup-animal" options={{ headerShown: false }} />
      <Stack.Screen name="(onboarding)/ready" options={{ headerShown: false }} />
      <Stack.Screen name="log-milking" options={{ presentation: 'modal', headerShown: false }} />
      <Stack.Screen name="log-eggs" options={{ presentation: 'modal', headerShown: false }} />
      <Stack.Screen name="add-animal" options={{ presentation: 'modal', headerShown: false }} />
      <Stack.Screen name="animal-profile" options={{ headerShown: false }} />
      <Stack.Screen name="flock-profile" options={{ headerShown: false }} />
      <Stack.Screen name="batch-profile" options={{ headerShown: false }} />
      <Stack.Screen name="feed-management" options={{ headerShown: false }} />
      <Stack.Screen name="add-feed-item" options={{ presentation: 'modal', headerShown: false }} />
      <Stack.Screen name="feed-item" options={{ headerShown: false }} />
      <Stack.Screen name="modal" options={{ presentation: 'modal' }} />
    </Stack>
  );
}
