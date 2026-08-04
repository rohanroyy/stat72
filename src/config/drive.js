// Google Drive configuration
export const DEFAULT_FOLDER_ID = '1WSEHg_3AqArmsSej66SucFDwiUgbR-Yk';

// Default folders configured at the root level if none in localStorage
export const DEFAULT_FOLDERS = [
  {
    id: 'default-materials',
    name: 'Class Materials',
    folderId: DEFAULT_FOLDER_ID,
    driveLink: 'https://drive.google.com/drive/folders/1WSEHg_3AqArmsSej66SucFDwiUgbR-Yk'
  }
];

// Extract Google Drive Folder ID from a sharing link or raw ID
export function extractFolderId(input) {
  if (!input) return '';
  const trimmed = input.trim();
  if (trimmed.includes('drive.google.com')) {
    const foldersMatch = trimmed.match(/\/folders\/([a-zA-Z0-9-_]+)/);
    if (foldersMatch && foldersMatch[1]) {
      return foldersMatch[1];
    }
    const idMatch = trimmed.match(/[?&]id=([a-zA-Z0-9-_]+)/);
    if (idMatch && idMatch[1]) {
      return idMatch[1];
    }
  }
  return trimmed;
}

// Google API Key — reads from env, runtime override, or local storage
let runtimeApiKey = '';

export function setRuntimeApiKey(key) {
  runtimeApiKey = key || '';
}

export function getApiKey() {
  if (runtimeApiKey) return runtimeApiKey;
  const envKey = import.meta.env.VITE_GOOGLE_API_KEY;
  if (envKey) return envKey;
  try {
    return localStorage.getItem('studydock_api_key') || '';
  } catch {
    return '';
  }
}

/** @deprecated Use getApiKey() — kept for existing imports */
export const API_KEY = getApiKey();
export const POLL_INTERVAL = 30_000;
export const DRIVE_API_BASE = 'https://www.googleapis.com/drive/v3';

// Google OAuth 2.0 Client ID
export const DEFAULT_CLIENT_ID = '669390946434-kcb875brk537omcfusecuvsfn80gr6l6.apps.googleusercontent.com';

let runtimeClientId = '';
let runtimeClientSecret = '';

export function setRuntimeClientId(id) {
  runtimeClientId = id || '';
}

export function setRuntimeClientSecret(secret) {
  runtimeClientSecret = secret || '';
}

export function getClientId() {
  if (runtimeClientId) return runtimeClientId;
  const envId = import.meta.env.VITE_GOOGLE_CLIENT_ID;
  if (envId) return envId;
  try {
    return localStorage.getItem('bahattor_google_client_id') || DEFAULT_CLIENT_ID;
  } catch {
    return DEFAULT_CLIENT_ID;
  }
}

export function getClientSecret() {
  if (runtimeClientSecret) return runtimeClientSecret;
  const envSecret = import.meta.env.VITE_GOOGLE_CLIENT_SECRET;
  if (envSecret) return envSecret;
  try {
    return localStorage.getItem('bahattor_google_client_secret') || '';
  } catch {
    return '';
  }
}
