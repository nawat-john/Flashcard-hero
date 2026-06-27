import { DarkTheme, DefaultTheme, ThemeProvider } from '@react-navigation/native';
import { Stack } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import 'react-native-reanimated';

import { useColorScheme } from '@/hooks/use-color-scheme';

export const unstable_settings = {
  anchor: '(tabs)',
};

export default function RootLayout() {
  const colorScheme = useColorScheme();

  return (
    <ThemeProvider value={colorScheme === 'dark' ? DarkTheme : DefaultTheme}>
      <Stack>
        <Stack.Screen name="(tabs)" options={{ headerShown: false }} />
        <Stack.Screen name="folder/[id]" options={{ title: 'โฟลเดอร์' }} />
        <Stack.Screen name="deck/[id]" options={{ title: 'เด็ค' }} />
        <Stack.Screen name="study/[deckId]" options={{ title: 'เรียน' }} />
      </Stack>
      <StatusBar style="auto" />
    </ThemeProvider>
  );
}
