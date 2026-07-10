// CRUD helpers for saved scenarios. All of these assume supabase is
// configured and the user is signed in — the AccountBar component guards
// both before calling.

import { supabase } from './supabase.js';

export async function listScenarios() {
  const { data, error } = await supabase
    .from('scenarios')
    .select('id, name, inputs, updated_at')
    .order('updated_at', { ascending: false });
  if (error) throw error;
  return data;
}

// Upserts on (user_id, name): same name overwrites, new name creates a new
// scenario — that's the whole multi-scenario mechanism.
export async function saveScenario({ name, inputs }) {
  const { data: userData, error: userErr } = await supabase.auth.getUser();
  if (userErr) throw userErr;
  const { error } = await supabase
    .from('scenarios')
    .upsert(
      { user_id: userData.user.id, name, inputs, updated_at: new Date().toISOString() },
      { onConflict: 'user_id,name' },
    );
  if (error) throw error;
}

export async function deleteScenario(id) {
  const { error } = await supabase.from('scenarios').delete().eq('id', id);
  if (error) throw error;
}
