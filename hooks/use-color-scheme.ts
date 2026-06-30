import { useEffect, useState } from 'react';
import { useColorScheme as useSystemColorScheme } from 'react-native';

import {
  getThemePreference,
  loadThemePreference,
  subscribeTheme,
  type ThemePreference,
} from '@/lib/theme-preference';

export function useColorScheme(): 'light' | 'dark' {
  const system = useSystemColorScheme() ?? 'light';
  const [pref, setPref] = useState<ThemePreference>(getThemePreference());

  useEffect(() => {
    loadThemePreference().then(setPref);
    return subscribeTheme(setPref);
  }, []);

  if (pref === 'system') return system;
  return pref;
}
