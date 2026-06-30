import { supabase, unwrap } from '@/lib/supabase';

export type Profile = {
  id: string;
  displayName: string | null;
  createdAt: string;
};

type ProfileRow = {
  id: string;
  display_name: string | null;
  created_at: string;
};

function toProfile(row: ProfileRow): Profile {
  return { id: row.id, displayName: row.display_name, createdAt: row.created_at };
}

export async function getProfile(id: string): Promise<Profile | null> {
  const row = unwrap(await supabase.from('profiles').select('*').eq('id', id).maybeSingle());
  return row ? toProfile(row) : null;
}

export async function updateDisplayName(id: string, displayName: string): Promise<void> {
  unwrap(await supabase.from('profiles').update({ display_name: displayName.trim() }).eq('id', id));
}

export async function sendPasswordReset(email: string): Promise<void> {
  const { error } = await supabase.auth.resetPasswordForEmail(email);
  if (error) throw error;
}
