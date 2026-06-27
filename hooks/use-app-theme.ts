import { Colors, Palette } from '@/constants/theme';
import { useColorScheme } from '@/hooks/use-color-scheme';

/**
 * Merged color set for the app's own screens: the navigation palette
 * (`text`, `background`, `tint`, `icon`...) plus the extra `Palette`
 * (`card`, `surface`, `border`, `muted`, `danger`, `success`).
 */
export function useAppTheme() {
  const scheme = useColorScheme() ?? 'light';
  return { scheme, ...Colors[scheme], ...Palette[scheme] };
}
