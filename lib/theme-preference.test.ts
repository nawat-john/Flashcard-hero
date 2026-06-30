/**
 * Unit tests for lib/theme-preference.ts.
 *
 * AsyncStorage is backed by the in-memory mock (test/mocks/async-storage.ts)
 * so tests are fully offline. The module-level `current` variable is reset
 * before each test by calling setThemePreference('system').
 */

import {
  getThemePreference,
  loadThemePreference,
  setThemePreference,
  subscribeTheme,
  type ThemePreference,
} from '@/lib/theme-preference';

beforeEach(async () => {
  // Reset in-memory state and AsyncStorage to the default.
  await setThemePreference('system');
});

// ---------------------------------------------------------------------------
// getThemePreference (synchronous read of current value)
// ---------------------------------------------------------------------------

describe('getThemePreference', () => {
  it('returns the current preference synchronously', async () => {
    await setThemePreference('dark');
    expect(getThemePreference()).toBe('dark');
  });

  it('returns "system" after being reset to system', () => {
    expect(getThemePreference()).toBe('system');
  });
});

// ---------------------------------------------------------------------------
// setThemePreference
// ---------------------------------------------------------------------------

describe('setThemePreference', () => {
  it('updates the in-memory value immediately', async () => {
    await setThemePreference('light');
    expect(getThemePreference()).toBe('light');
  });

  it('persists to AsyncStorage so loadThemePreference reads it back', async () => {
    await setThemePreference('dark');
    // Simulate reading back from storage (as if the preference module just loaded).
    const loaded = await loadThemePreference();
    expect(loaded).toBe('dark');
  });

  it('accepts all three valid values', async () => {
    for (const pref of ['system', 'light', 'dark'] as ThemePreference[]) {
      await setThemePreference(pref);
      expect(getThemePreference()).toBe(pref);
    }
  });
});

// ---------------------------------------------------------------------------
// loadThemePreference
// ---------------------------------------------------------------------------

describe('loadThemePreference', () => {
  it('returns the current value (reads from storage if already set)', async () => {
    await setThemePreference('light');
    const result = await loadThemePreference();
    expect(result).toBe('light');
  });

  it('returns "system" when storage has not been set', async () => {
    // beforeEach already reset to 'system' and saved it.
    const result = await loadThemePreference();
    expect(result).toBe('system');
  });
});

// ---------------------------------------------------------------------------
// subscribeTheme
// ---------------------------------------------------------------------------

describe('subscribeTheme', () => {
  it('calls the subscriber when the preference changes', async () => {
    const received: ThemePreference[] = [];
    subscribeTheme((pref) => received.push(pref));

    await setThemePreference('dark');
    await setThemePreference('light');

    expect(received).toEqual(['dark', 'light']);
  });

  it('stops calling the subscriber after unsubscribe', async () => {
    const received: ThemePreference[] = [];
    const unsub = subscribeTheme((pref) => received.push(pref));

    await setThemePreference('dark');
    unsub();
    await setThemePreference('light'); // should not reach subscriber

    expect(received).toEqual(['dark']);
  });

  it('supports multiple concurrent subscribers', async () => {
    const a: ThemePreference[] = [];
    const b: ThemePreference[] = [];
    subscribeTheme((p) => a.push(p));
    subscribeTheme((p) => b.push(p));

    await setThemePreference('dark');

    expect(a).toEqual(['dark']);
    expect(b).toEqual(['dark']);
  });
});
