/**
 * Unit tests for lib/study-preference.ts.
 *
 * AsyncStorage is the in-memory mock so tests are fully offline.
 * The module's in-memory state is reset before each test by calling
 * setStudyPrefs back to defaults.
 */

import {
  getStudyPrefs,
  loadStudyPrefs,
  setStudyPrefs,
  subscribeStudyPrefs,
  type StudyPrefs,
} from '@/lib/study-preference';

const DEFAULTS: StudyPrefs = { defaultStudyOrder: 'sequential', cardFontSize: 'normal' };

beforeEach(async () => {
  // Reset to defaults before each test.
  await setStudyPrefs(DEFAULTS);
});

// ---------------------------------------------------------------------------
// getStudyPrefs (synchronous)
// ---------------------------------------------------------------------------

describe('getStudyPrefs', () => {
  it('returns the default values after reset', () => {
    expect(getStudyPrefs()).toEqual(DEFAULTS);
  });

  it('reflects changes made by setStudyPrefs immediately', async () => {
    await setStudyPrefs({ cardFontSize: 'large' });
    expect(getStudyPrefs().cardFontSize).toBe('large');
  });
});

// ---------------------------------------------------------------------------
// setStudyPrefs (partial patch)
// ---------------------------------------------------------------------------

describe('setStudyPrefs', () => {
  it('applies a partial patch without clobbering other fields', async () => {
    await setStudyPrefs({ cardFontSize: 'large' });
    // defaultStudyOrder should be untouched
    expect(getStudyPrefs().defaultStudyOrder).toBe('sequential');
  });

  it('applies another partial patch that only changes defaultStudyOrder', async () => {
    await setStudyPrefs({ defaultStudyOrder: 'random' });
    expect(getStudyPrefs().cardFontSize).toBe('normal');
    expect(getStudyPrefs().defaultStudyOrder).toBe('random');
  });

  it('persists to AsyncStorage so loadStudyPrefs reads it back', async () => {
    await setStudyPrefs({ cardFontSize: 'large', defaultStudyOrder: 'random' });
    const loaded = await loadStudyPrefs();
    expect(loaded).toEqual({ cardFontSize: 'large', defaultStudyOrder: 'random' });
  });

  it('multiple patches compose correctly', async () => {
    await setStudyPrefs({ cardFontSize: 'large' });
    await setStudyPrefs({ defaultStudyOrder: 'random' });
    expect(getStudyPrefs()).toEqual({ cardFontSize: 'large', defaultStudyOrder: 'random' });
  });
});

// ---------------------------------------------------------------------------
// loadStudyPrefs
// ---------------------------------------------------------------------------

describe('loadStudyPrefs', () => {
  it('returns current prefs (reads from storage after a save)', async () => {
    await setStudyPrefs({ cardFontSize: 'large' });
    const loaded = await loadStudyPrefs();
    expect(loaded.cardFontSize).toBe('large');
  });

  it('returns defaults when nothing has been explicitly changed', async () => {
    const loaded = await loadStudyPrefs();
    expect(loaded).toEqual(DEFAULTS);
  });
});

// ---------------------------------------------------------------------------
// subscribeStudyPrefs
// ---------------------------------------------------------------------------

describe('subscribeStudyPrefs', () => {
  it('calls the subscriber when prefs change', async () => {
    const received: StudyPrefs[] = [];
    subscribeStudyPrefs((p) => received.push(p));

    await setStudyPrefs({ cardFontSize: 'large' });
    await setStudyPrefs({ defaultStudyOrder: 'random' });

    expect(received).toHaveLength(2);
    expect(received[0].cardFontSize).toBe('large');
    expect(received[1].defaultStudyOrder).toBe('random');
  });

  it('stops calling subscriber after unsubscribe', async () => {
    const received: StudyPrefs[] = [];
    const unsub = subscribeStudyPrefs((p) => received.push(p));

    await setStudyPrefs({ cardFontSize: 'large' });
    unsub();
    await setStudyPrefs({ defaultStudyOrder: 'random' }); // should not reach subscriber

    expect(received).toHaveLength(1);
  });

  it('supports multiple simultaneous subscribers', async () => {
    const a: StudyPrefs[] = [];
    const b: StudyPrefs[] = [];
    subscribeStudyPrefs((p) => a.push(p));
    subscribeStudyPrefs((p) => b.push(p));

    await setStudyPrefs({ cardFontSize: 'large' });

    expect(a).toHaveLength(1);
    expect(b).toHaveLength(1);
  });
});
