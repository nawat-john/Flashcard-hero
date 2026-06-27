import { DarkTheme, DefaultTheme, ThemeProvider } from '@react-navigation/native';
import { Stack, useRouter, useSegments } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { useEffect } from 'react';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import 'react-native-reanimated';

import { LoadingScreen } from '@/components/loading-screen';
import { OfflineBanner } from '@/components/offline-banner';
import { useColorScheme } from '@/hooks/use-color-scheme';
import { AuthProvider, useAuth } from '@/lib/auth';
import { hydrate, clear, initSync, setUser } from '@/lib/store';

export const unstable_settings = {
  anchor: '(tabs)',
};

function RootNavigator() {
  const { session, initializing } = useAuth();
  const segments = useSegments();
  const router = useRouter();

  // Wire offline store to connectivity and session lifecycle.
  useEffect(() => {
    const unsubscribe = initSync();
    return unsubscribe;
  }, []);

  useEffect(() => {
    if (initializing) return;
    if (session?.user) {
      setUser(session.user.id);
      void hydrate();
    } else {
      void clear();
    }
  }, [session, initializing]);

  // Keep the user on the right side of the auth boundary.
  useEffect(() => {
    if (initializing) return;
    const inAuthGroup = segments[0] === '(auth)';
    if (!session && !inAuthGroup) {
      router.replace('/(auth)/login');
    } else if (session && inAuthGroup) {
      router.replace('/');
    }
  }, [session, initializing, segments, router]);

  if (initializing) {
    return <LoadingScreen />;
  }

  return (
    <Stack>
      <Stack.Screen name="(tabs)" options={{ headerShown: false }} />
      <Stack.Screen name="(auth)" options={{ headerShown: false }} />
      <Stack.Screen name="folder/[id]" options={{ title: 'Folder' }} />
      <Stack.Screen name="folder-preview/[id]" options={{ title: 'Folder preview' }} />
      <Stack.Screen name="deck/[id]" options={{ title: 'Deck' }} />
      <Stack.Screen name="deck-preview/[id]" options={{ title: 'Deck preview' }} />
      <Stack.Screen name="study/[deckId]" options={{ title: 'Study' }} />
    </Stack>
  );
}

export default function RootLayout() {
  const colorScheme = useColorScheme();

  return (
    <GestureHandlerRootView style={{ flex: 1 }}>
      <ThemeProvider value={colorScheme === 'dark' ? DarkTheme : DefaultTheme}>
        <AuthProvider>
          <OfflineBanner />
          <RootNavigator />
        </AuthProvider>
        <StatusBar style="auto" />
      </ThemeProvider>
    </GestureHandlerRootView>
  );
}
