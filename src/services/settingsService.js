import { supabase, isSupabaseConfigured } from '../lib/supabase';

const SETTINGS_KEYS = {
  GOOGLE_API_KEY: 'google_api_key',
  TELEGRAM: 'telegram',
  TELEGRAM_CUSTOM_TOPIC_NAMES: 'telegram_custom_topic_names',
  SUGGESTION_UPLOAD_FOLDER: 'suggestion_upload_folder',
  GOOGLE_SERVICE_ACCOUNT: 'google_service_account',
  GOOGLE_REFRESH_TOKEN: 'google_refresh_token',
  GOOGLE_CLIENT_ID: 'google_client_id',
  GOOGLE_CLIENT_SECRET: 'google_client_secret',
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
      suggestionUploadFolder: '',
      googleServiceAccount: null,
      googleRefreshToken: '',
      googleClientId: '',
      googleClientSecret: '',
    };
  }

  const { data, error } = await supabase.from('app_settings').select('key, value');
  if (error) throw new Error(error.message);

  const map = Object.fromEntries((data || []).map((row) => [row.key, rowToValue(row)]));

  return {
    googleApiKey: map[SETTINGS_KEYS.GOOGLE_API_KEY] || '',
    telegram: map[SETTINGS_KEYS.TELEGRAM] || { token: '', chatId: '' },
    telegramCustomTopicNames: map[SETTINGS_KEYS.TELEGRAM_CUSTOM_TOPIC_NAMES] || {},
    suggestionUploadFolder: map[SETTINGS_KEYS.SUGGESTION_UPLOAD_FOLDER] || '',
    googleServiceAccount: map[SETTINGS_KEYS.GOOGLE_SERVICE_ACCOUNT] || null,
    googleRefreshToken: map[SETTINGS_KEYS.GOOGLE_REFRESH_TOKEN] || '',
    googleClientId: map[SETTINGS_KEYS.GOOGLE_CLIENT_ID] || '',
    googleClientSecret: map[SETTINGS_KEYS.GOOGLE_CLIENT_SECRET] || '',
  };
}

export async function saveGoogleApiKey(key) {
  await saveSetting(SETTINGS_KEYS.GOOGLE_API_KEY, key);
}

export async function saveTelegramSettings(token, chatId) {
  await saveSetting(SETTINGS_KEYS.TELEGRAM, { token, chatId });
}

export async function saveSuggestionUploadFolder(folderLinkOrId) {
  await saveSetting(SETTINGS_KEYS.SUGGESTION_UPLOAD_FOLDER, folderLinkOrId);
}

export async function saveGoogleServiceAccount(configJson) {
  await saveSetting(SETTINGS_KEYS.GOOGLE_SERVICE_ACCOUNT, configJson);
}

export async function saveGoogleRefreshToken(token) {
  await saveSetting(SETTINGS_KEYS.GOOGLE_REFRESH_TOKEN, token);
}

export async function saveGoogleClientId(clientId) {
  await saveSetting(SETTINGS_KEYS.GOOGLE_CLIENT_ID, clientId);
}

export async function saveGoogleClientSecret(clientSecret) {
  await saveSetting(SETTINGS_KEYS.GOOGLE_CLIENT_SECRET, clientSecret);
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
  const suggestionUploadFolder = localStorage.getItem('bahattor_suggestion_upload_folder') || '';
  const googleClientId = localStorage.getItem('bahattor_google_client_id') || '';
  const googleClientSecret = localStorage.getItem('bahattor_google_client_secret') || '';
  let serviceAccount = null;
  try {
    serviceAccount = JSON.parse(localStorage.getItem('bahattor_google_service_account') || 'null');
  } catch {}

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
  if (suggestionUploadFolder) {
    upserts.push({ key: SETTINGS_KEYS.SUGGESTION_UPLOAD_FOLDER, value: suggestionUploadFolder });
  }
  if (serviceAccount) {
    upserts.push({ key: SETTINGS_KEYS.GOOGLE_SERVICE_ACCOUNT, value: serviceAccount });
  }
  if (googleClientId) {
    upserts.push({ key: SETTINGS_KEYS.GOOGLE_CLIENT_ID, value: googleClientId });
  }
  if (googleClientSecret) {
    upserts.push({ key: SETTINGS_KEYS.GOOGLE_CLIENT_SECRET, value: googleClientSecret });
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
