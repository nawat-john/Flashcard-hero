import AsyncStorage from '@react-native-async-storage/async-storage';

export type ThemePreference = 'system' | 'light' | 'dark';

const KEY = 'flashcard.theme';

let current: ThemePreference = 'system';
const listeners = new Set<(pref: ThemePreference) => void>();

export function getThemePreference(): ThemePreference {
  return current;
}

export async function loadThemePreference(): Promise<ThemePreference> {
  try {
    const raw = await AsyncStorage.getItem(KEY);
    if (raw === 'light' || raw === 'dark' || raw === 'system') {
      current = raw;
    }
  } catch {
    // ignore, keep default
  }
  return current;
}

export async function setThemePreference(pref: ThemePreference): Promise<void> {
  current = pref;
  listeners.forEach((cb) => cb(pref));
  try {
    await AsyncStorage.setItem(KEY, pref);
  } catch {
    // ignore
  }
}

export function subscribeTheme(cb: (pref: ThemePreference) => void): () => void {
  listeners.add(cb);
  return () => listeners.delete(cb);
}
