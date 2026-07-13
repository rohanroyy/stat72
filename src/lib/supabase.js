import { createClient } from '@supabase/supabase-js';

function getProjectRefFromKey(key) {
  if (!key || !key.includes('.')) return null;
  try {
    const payload = JSON.parse(
      atob(key.split('.')[1].replace(/-/g, '+').replace(/_/g, '/'))
    );
    return payload.ref || null;
  } catch {
    return null;
  }
}

function resolveSupabaseUrl(url, anonKey) {
  const ref = getProjectRefFromKey(anonKey);
  if (!ref) return (url || '').replace(/\/$/, '');

  const canonical = `https://${ref}.supabase.co`;
  const trimmed = (url || '').replace(/\/$/, '');

  if (!trimmed || !trimmed.includes(ref)) {
    if (trimmed && trimmed !== canonical) {
      console.warn(
        `[StudyDock] VITE_SUPABASE_URL "${trimmed}" does not match your anon key project "${ref}". Using ${canonical}.`
      );
    }
    return canonical;
  }

  return trimmed;
}

const envUrl = import.meta.env.VITE_SUPABASE_URL || '';
const envAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY || '';
const supabaseUrl = resolveSupabaseUrl(envUrl, envAnonKey);
const supabaseAnonKey = envAnonKey;

export const isSupabaseConfigured = () => !!(supabaseUrl && supabaseAnonKey);

export const supabase = isSupabaseConfigured()
  ? createClient(supabaseUrl, supabaseAnonKey)
  : null;

export async function checkSupabaseConnection() {
  if (!isSupabaseConfigured()) {
    return { ok: false, message: 'Supabase is not configured. Add VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY.' };
  }

  const { error } = await supabase.from('exams').select('id').limit(1);
  if (!error) return { ok: true, url: supabaseUrl };

  const message = error.message || 'Unknown Supabase error';
  if (message.includes('does not exist') || message.includes('schema cache')) {
    return {
      ok: false,
      url: supabaseUrl,
      message: 'Database tables are missing. Run supabase/schema.sql in the Supabase SQL Editor.',
    };
  }

  return { ok: false, url: supabaseUrl, message };
}
