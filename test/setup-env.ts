// Load `.env` (the same EXPO_PUBLIC_* keys the app uses) so lib/supabase.ts is
// configured during tests. Runs before any module is imported.
import { config } from 'dotenv';

config();
