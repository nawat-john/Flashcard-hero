import AsyncStorage from '@react-native-async-storage/async-storage';

export type StudyPrefs = {
  defaultStudyOrder: 'sequential' | 'random';
  cardFontSize: 'normal' | 'large';
};

const KEY = 'flashcard.studyprefs';
const DEFAULTS: StudyPrefs = { defaultStudyOrder: 'sequential', cardFontSize: 'normal' };

let current: StudyPrefs = { ...DEFAULTS };
const listeners = new Set<(prefs: StudyPrefs) => void>();

export function getStudyPrefs(): StudyPrefs {
  return current;
}

export async function loadStudyPrefs(): Promise<StudyPrefs> {
  try {
    const raw = await AsyncStorage.getItem(KEY);
    if (raw) current = { ...DEFAULTS, ...(JSON.parse(raw) as Partial<StudyPrefs>) };
  } catch {
    // keep defaults
  }
  return current;
}

export async function setStudyPrefs(patch: Partial<StudyPrefs>): Promise<void> {
  current = { ...current, ...patch };
  listeners.forEach((cb) => cb(current));
  try {
    await AsyncStorage.setItem(KEY, JSON.stringify(current));
  } catch {
    // ignore
  }
}

export function subscribeStudyPrefs(cb: (prefs: StudyPrefs) => void): () => void {
  listeners.add(cb);
  return () => listeners.delete(cb);
}
