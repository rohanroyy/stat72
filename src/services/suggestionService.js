import { supabase, isSupabaseConfigured } from '../lib/supabase';
import { fetchSetting, saveSetting } from './settingsService';

const LOCAL_KEY_PREFIX = 'bahattor_suggestions_';
const TOPPERS_KEY = 'bahattor_toppers';

// ── Local storage helpers ─────────────────────────────────────────────────────

function readLocalSuggestions(examId) {
  try {
    const raw = localStorage.getItem(LOCAL_KEY_PREFIX + examId);
    return raw ? JSON.parse(raw) : [];
  } catch {
    return [];
  }
}

function writeLocalSuggestions(examId, suggestions) {
  localStorage.setItem(LOCAL_KEY_PREFIX + examId, JSON.stringify(suggestions));
}

// ── Toppers ───────────────────────────────────────────────────────────────────

export async function fetchTopperIds() {
  if (!isSupabaseConfigured()) {
    try {
      const raw = localStorage.getItem(TOPPERS_KEY);
      return raw ? JSON.parse(raw) : [];
    } catch {
      return [];
    }
  }
  try {
    const val = await fetchSetting(TOPPERS_KEY);
    return Array.isArray(val) ? val : [];
  } catch {
    return [];
  }
}

export async function saveTopperIds(ids) {
  const arr = Array.isArray(ids) ? ids : [];
  if (!isSupabaseConfigured()) {
    localStorage.setItem(TOPPERS_KEY, JSON.stringify(arr));
    return arr;
  }
  await saveSetting(TOPPERS_KEY, arr);
  return arr;
}

// ── Suggestions CRUD ──────────────────────────────────────────────────────────

export async function fetchSuggestions(examId) {
  if (!isSupabaseConfigured()) {
    return readLocalSuggestions(examId);
  }
  try {
    const { data, error } = await supabase
      .from('exam_suggestions')
      .select('*')
      .eq('exam_id', examId)
      .order('created_at', { ascending: true });
    if (error) throw new Error(error.message);
    return data || [];
  } catch (err) {
    console.error('fetchSuggestions failed, falling back to local:', err);
    return readLocalSuggestions(examId);
  }
}

export async function addSuggestion(examId, { text, attachment }, uploader) {
  const newSugg = {
    id: `sugg_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`,
    exam_id: examId,
    uploader_id: uploader.id,
    uploader_name: uploader.name,
    text: text || null,
    attachment: attachment || null,
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
  };

  if (!isSupabaseConfigured()) {
    const list = readLocalSuggestions(examId);
    list.push(newSugg);
    writeLocalSuggestions(examId, list);
    return list;
  }

  try {
    const { error } = await supabase.from('exam_suggestions').insert(newSugg);
    if (error) throw new Error(error.message);
    return fetchSuggestions(examId);
  } catch (err) {
    // Fallback: store locally if table doesn't exist yet
    console.error('addSuggestion DB error, using local fallback:', err.message);
    const list = readLocalSuggestions(examId);
    list.push(newSugg);
    writeLocalSuggestions(examId, list);
    return list;
  }
}

export async function editSuggestion(examId, suggId, { text, attachment }) {
  const updated_at = new Date().toISOString();

  if (!isSupabaseConfigured()) {
    const list = readLocalSuggestions(examId).map(s =>
      s.id === suggId ? { ...s, text: text || null, attachment: attachment || null, updated_at } : s
    );
    writeLocalSuggestions(examId, list);
    return list;
  }

  try {
    const { error } = await supabase
      .from('exam_suggestions')
      .update({ text: text || null, attachment: attachment || null, updated_at })
      .eq('id', suggId);
    if (error) throw new Error(error.message);
    return fetchSuggestions(examId);
  } catch (err) {
    console.error('editSuggestion DB error, using local fallback:', err.message);
    const list = readLocalSuggestions(examId).map(s =>
      s.id === suggId ? { ...s, text: text || null, attachment: attachment || null, updated_at } : s
    );
    writeLocalSuggestions(examId, list);
    return list;
  }
}

export async function deleteSuggestion(examId, suggId) {
  if (!isSupabaseConfigured()) {
    const list = readLocalSuggestions(examId).filter(s => s.id !== suggId);
    writeLocalSuggestions(examId, list);
    return list;
  }

  try {
    const { error } = await supabase
      .from('exam_suggestions')
      .delete()
      .eq('id', suggId);
    if (error) throw new Error(error.message);
    return fetchSuggestions(examId);
  } catch (err) {
    console.error('deleteSuggestion DB error, using local fallback:', err.message);
    const list = readLocalSuggestions(examId).filter(s => s.id !== suggId);
    writeLocalSuggestions(examId, list);
    return list;
  }
}

export function subscribeToSuggestions(examId, onChange) {
  if (!isSupabaseConfigured()) return () => {};
  try {
    const channel = supabase
      .channel(`exam_suggestions_${examId}`)
      .on('postgres_changes', {
        event: '*',
        schema: 'public',
        table: 'exam_suggestions',
        filter: `exam_id=eq.${examId}`,
      }, () => onChange())
      .subscribe();
    return () => supabase.removeChannel(channel);
  } catch {
    return () => {};
  }
}
