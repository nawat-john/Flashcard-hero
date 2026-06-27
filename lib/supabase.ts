import 'react-native-url-polyfill/auto';

import AsyncStorage from '@react-native-async-storage/async-storage';
import { createClient } from '@supabase/supabase-js';

const url = process.env.EXPO_PUBLIC_SUPABASE_URL;
const anonKey = process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY;

/**
 * True once real Supabase credentials are present in `.env`. The placeholder
 * values shipped in `.env.example` (containing "YOUR-") count as unconfigured,
 * which is what makes the app show its setup screen until the key is pasted.
 */
export const isSupabaseConfigured =
  !!url && !!anonKey && !url.includes('YOUR-') && !anonKey.includes('YOUR-');

// Fall back to harmless placeholders so `createClient` never throws at import
// time when the app is still unconfigured; the UI gates real usage on
// `isSupabaseConfigured` instead.
export const supabase = createClient(
  url || 'https://placeholder.supabase.co',
  anonKey || 'placeholder-anon-key',
  {
    auth: {
      storage: AsyncStorage,
      autoRefreshToken: true,
      persistSession: true,
      // No URL-based session detection in a native app.
      detectSessionInUrl: false,
    },
  }
);

/** Throws on a Supabase error, otherwise returns the data (typed by the caller). */
export function unwrap<T>(response: { data: T; error: { message: string } | null }): T {
  if (response.error) {
    throw new Error(response.error.message);
  }
  return response.data;
}
