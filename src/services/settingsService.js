import { supabase, isSupabaseConfigured } from '../lib/supabase';

const SETTINGS_KEYS = {
  GOOGLE_API_KEY: 'google_api_key',
  TELEGRAM: 'telegram',
  TELEGRAM_CUSTOM_TOPIC_NAMES: 'telegram_custom_topic_names',
};

function rowToValue(row) {
  if (!row) return null;
  const { value } = row;
  if (typeof value === 'string') {
    try {
      return JSON.parse(value);
    } catch {
      return value;
    }
  }
  return value;
}

export async function fetchSetting(key) {
  if (!isSupabaseConfigured()) return null;

  const { data, error } = await supabase
    .from('app_settings')
    .select('value')
    .eq('key', key)
    .maybeSingle();

  if (error) throw new Error(error.message);
  return rowToValue(data);
}

export async function saveSetting(key, value) {
  if (!isSupabaseConfigured()) return;

  const { error } = await supabase
    .from('app_settings')
    .upsert(
      { key, value, updated_at: new Date().toISOString() },
      { onConflict: 'key' }
    );

  if (error) throw new Error(error.message);
}

export async function fetchAppSettings() {
  if (!isSupabaseConfigured()) {
    return {
      googleApiKey: '',
      telegram: { token: '', chatId: '' },
      telegramCustomTopicNames: {},
    };
  }

  const { data, error } = await supabase.from('app_settings').select('key, value');
  if (error) throw new Error(error.message);

  const map = Object.fromEntries((data || []).map((row) => [row.key, rowToValue(row)]));

  return {
    googleApiKey: map[SETTINGS_KEYS.GOOGLE_API_KEY] || '',
    telegram: map[SETTINGS_KEYS.TELEGRAM] || { token: '', chatId: '' },
    telegramCustomTopicNames: map[SETTINGS_KEYS.TELEGRAM_CUSTOM_TOPIC_NAMES] || {},
  };
}

export async function saveGoogleApiKey(key) {
  await saveSetting(SETTINGS_KEYS.GOOGLE_API_KEY, key);
}

export async function saveTelegramSettings(token, chatId) {
  await saveSetting(SETTINGS_KEYS.TELEGRAM, { token, chatId });
}

export async function clearTelegramSettings() {
  await saveSetting(SETTINGS_KEYS.TELEGRAM, { token: '', chatId: '' });
}

export async function saveTelegramCustomTopicNames(names) {
  await saveSetting(SETTINGS_KEYS.TELEGRAM_CUSTOM_TOPIC_NAMES, names);
}

export async function migrateSettingsFromLocalStorage() {
  if (!isSupabaseConfigured()) return;

  const { count, error: countError } = await supabase
    .from('app_settings')
    .select('*', { count: 'exact', head: true });

  if (countError) throw new Error(countError.message);
  if (count > 0) return;

  const apiKey = localStorage.getItem('studydock_api_key') || '';
  const token = localStorage.getItem('studydock_telegram_token') || '';
  const chatId = localStorage.getItem('studydock_telegram_chat_id') || '';

  let customNames = {};
  try {
    customNames = JSON.parse(localStorage.getItem('studydock_telegram_custom_names') || '{}');
  } catch {
    customNames = {};
  }

  const upserts = [];
  if (apiKey) upserts.push({ key: SETTINGS_KEYS.GOOGLE_API_KEY, value: apiKey });
  if (token || chatId) upserts.push({ key: SETTINGS_KEYS.TELEGRAM, value: { token, chatId } });
  if (Object.keys(customNames).length) {
    upserts.push({ key: SETTINGS_KEYS.TELEGRAM_CUSTOM_TOPIC_NAMES, value: customNames });
  }

  if (!upserts.length) return;

  const { error } = await supabase.from('app_settings').upsert(upserts, { onConflict: 'key' });
  if (error) throw new Error(error.message);
}

export function subscribeToSettings(onChange) {
  if (!isSupabaseConfigured()) return () => {};

  const channel = supabase
    .channel('app_settings_changes')
    .on('postgres_changes', { event: '*', schema: 'public', table: 'app_settings' }, () => {
      onChange();
    })
    .subscribe();

  return () => {
    supabase.removeChannel(channel);
  };
}
