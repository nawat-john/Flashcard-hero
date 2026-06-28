const tintColorLight = '#0a7ea4';
const tintColorDark = '#fff';

export const Colors = {
  light: {
    text: '#11181C',
    background: '#fff',
    tint: tintColorLight,
    icon: '#687076',
    tabIconDefault: '#687076',
    tabIconSelected: tintColorLight,
  },
  dark: {
    text: '#ECEDEE',
    background: '#151718',
    tint: tintColorDark,
    icon: '#9BA1A6',
    tabIconDefault: '#9BA1A6',
    tabIconSelected: tintColorDark,
  },
};

/** Extra palette used by the app's own screens (not part of the navigation theme). */
export const Palette = {
  light: {
    card: '#ffffff',
    surface: '#f2f4f7',
    border: '#e3e7ec',
    muted: '#687076',
    danger: '#d7263d',
    success: '#1f9d55',
  },
  dark: {
    card: '#1e2022',
    surface: '#1b1d1e',
    border: '#2c3032',
    muted: '#9BA1A6',
    danger: '#ff6b81',
    success: '#3ddc84',
  },
};

/** 4pt spacing scale. */
export const Spacing = {
  xs: 4,
  sm: 8,
  md: 12,
  lg: 16,
  xl: 24,
  xxl: 32,
};

export const Radius = {
  sm: 8,
  md: 12,
  lg: 16,
  pill: 999,
};
