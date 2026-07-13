import { isSupabaseConfigured, checkSupabaseConnection } from '../lib/supabase';
import { migrateExamsFromLocalStorage, fetchExams, getExams } from './examService';
import { migrateFoldersFromLocalStorage, fetchFolders } from './foldersService';
import { migrateSettingsFromLocalStorage, fetchAppSettings } from './settingsService';
import { setRuntimeApiKey } from '../config/drive';

const STORAGE_API_KEY = 'studydock_api_key';
const STORAGE_TOKEN_KEY = 'studydock_telegram_token';
const STORAGE_CHAT_ID_KEY = 'studydock_telegram_chat_id';
const STORAGE_CUSTOM_NAMES_KEY = 'studydock_telegram_custom_names';

function applySettingsToLocalStorage(settings) {
  if (settings.googleApiKey) {
    localStorage.setItem(STORAGE_API_KEY, settings.googleApiKey);
    setRuntimeApiKey(settings.googleApiKey);
  }

  if (settings.telegram) {
    localStorage.setItem(STORAGE_TOKEN_KEY, settings.telegram.token || '');
    localStorage.setItem(STORAGE_CHAT_ID_KEY, settings.telegram.chatId || '');
  }

  if (settings.telegramCustomTopicNames) {
    localStorage.setItem(
      STORAGE_CUSTOM_NAMES_KEY,
      JSON.stringify(settings.telegramCustomTopicNames)
    );
  }
}

export async function loadAppData() {
  if (!isSupabaseConfigured()) {
    const envKey = import.meta.env.VITE_GOOGLE_API_KEY || localStorage.getItem(STORAGE_API_KEY) || '';
    setRuntimeApiKey(envKey);
    let customNames = {};
    try {
      customNames = JSON.parse(localStorage.getItem(STORAGE_CUSTOM_NAMES_KEY) || '{}');
    } catch {
      customNames = {};
    }
    return {
      exams: getExams(),
      folders: await fetchFolders(),
      settings: {
        googleApiKey: envKey,
        telegram: {
          token: localStorage.getItem(STORAGE_TOKEN_KEY) || '',
          chatId: localStorage.getItem(STORAGE_CHAT_ID_KEY) || '',
        },
        telegramCustomTopicNames: customNames,
      },
      useLocalOnly: true,
    };
  }

  const connection = await checkSupabaseConnection();
  if (!connection.ok) {
    throw new Error(connection.message);
  }

  await Promise.all([
    migrateExamsFromLocalStorage(),
    migrateFoldersFromLocalStorage(),
    migrateSettingsFromLocalStorage(),
  ]);

  const [exams, folders, settings] = await Promise.all([
    fetchExams(),
    fetchFolders(),
    fetchAppSettings(),
  ]);

  applySettingsToLocalStorage(settings);

  const envKey = import.meta.env.VITE_GOOGLE_API_KEY || '';
  const effectiveApiKey = envKey || settings.googleApiKey || '';
  setRuntimeApiKey(effectiveApiKey);

  return {
    exams,
    folders,
    settings: {
      ...settings,
      googleApiKey: effectiveApiKey,
    },
    useLocalOnly: false,
  };
}
