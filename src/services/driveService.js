import { getApiKey, DRIVE_API_BASE, getClientId, getClientSecret } from '../config/drive';
import { getServiceAccountAccessToken } from './serviceAccountAuth';

let currentAccessToken = '';
let tokenExpiryTime = 0;
let serviceAccountConfig = null;
let adminRefreshToken = '';

export function setAccessToken(token) {
  currentAccessToken = token || '';
}

export function getAccessToken() {
  return currentAccessToken;
}

export function setServiceAccountConfig(config) {
  serviceAccountConfig = config || null;
  // Clear any existing cached token so it will regenerate
  setAccessToken('');
  tokenExpiryTime = 0;
}

export function getServiceAccountConfig() {
  return serviceAccountConfig;
}

export function setAdminRefreshToken(token) {
  adminRefreshToken = token || '';
  setAccessToken('');
  tokenExpiryTime = 0;
}

export function getAdminRefreshToken() {
  return adminRefreshToken;
}

/**
 * Returns the fixed OAuth redirect URI — always <origin>/oauth/callback.
 * This must be registered in Google Cloud Console under Authorized redirect URIs.
 */
export function getOAuthRedirectUri() {
  return `${window.location.origin}/oauth/callback`;
}

/**
 * Initiates the Google OAuth 2.0 flow for the admin account to obtain offline refresh token.
 */
export function startAdminGoogleAuth() {
  const clientId = getClientId();
  if (!clientId) {
    alert('Google OAuth Client ID is not configured. Please check your settings or environment variables.');
    return;
  }
  const redirectUri = getOAuthRedirectUri();
  const scope = 'https://www.googleapis.com/auth/drive.file https://www.googleapis.com/auth/drive.readonly';
  
  const authUrl = `https://accounts.google.com/o/oauth2/v2/auth?client_id=${clientId}&redirect_uri=${encodeURIComponent(
    redirectUri
  )}&response_type=code&scope=${encodeURIComponent(
    scope
  )}&access_type=offline&prompt=consent`;

  window.location.href = authUrl;
}

/**
 * Exchanges the authorized code for refresh and access tokens.
 */
export async function exchangeAuthCode(code) {
  const clientId = getClientId();
  const clientSecret = getClientSecret();
  if (!clientId || !clientSecret) {
    throw new Error('Google OAuth credentials (Client ID and Client Secret) are not configured.');
  }
  const redirectUri = getOAuthRedirectUri();

  const bodyParams = new URLSearchParams({
    code,
    client_id: clientId,
    client_secret: clientSecret,
    redirect_uri: redirectUri,
    grant_type: 'authorization_code',
  });

  const response = await fetch('https://oauth2.googleapis.com/token', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/x-www-form-urlencoded',
    },
    body: bodyParams.toString(),
  });

  if (!response.ok) {
    const errText = await response.text();
    throw new Error(`Failed to exchange code: ${errText}`);
  }

  return response.json();
}

/**
 * Generates an access token silently using the admin's refresh token.
 */
export async function refreshAdminAccessToken() {
  if (!adminRefreshToken) return '';

  const clientId = getClientId();
  const clientSecret = getClientSecret();
  if (!clientId || !clientSecret) {
    console.error('Google OAuth credentials (Client ID and Client Secret) are missing for refresh.');
    return '';
  }

  const bodyParams = new URLSearchParams({
    client_id: clientId,
    client_secret: clientSecret,
    refresh_token: adminRefreshToken,
    grant_type: 'refresh_token',
  });

  try {
    const response = await fetch('https://oauth2.googleapis.com/token', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
      },
      body: bodyParams.toString(),
    });

    if (!response.ok) {
      throw new Error(`Token refresh failed: HTTP ${response.status}`);
    }

    const data = await response.json();
    setAccessToken(data.access_token);
    tokenExpiryTime = Date.now() + (data.expires_in || 3600) * 1000 - 100_000;
    return data.access_token;
  } catch (err) {
    console.error('Error refreshing admin access token:', err);
    return '';
  }
}

/**
 * Ensures a valid Google OAuth access token is active.
 * Prioritizes Admin Refresh Token, falling back to Service Account config.
 */
export async function ensureServiceAccountToken() {
  if (currentAccessToken && Date.now() < tokenExpiryTime) {
    return currentAccessToken;
  }

  // 1. Try Admin Refresh Token (silent flow acting as Admin)
  if (adminRefreshToken) {
    const token = await refreshAdminAccessToken();
    if (token) return token;
  }

  // 2. Try Google Service Account (local RSA JWT signer)
  if (serviceAccountConfig) {
    try {
      const token = await getServiceAccountAccessToken(serviceAccountConfig);
      setAccessToken(token);
      tokenExpiryTime = Date.now() + 3500 * 1000; // valid for ~1 hour
      return token;
    } catch (err) {
      console.error('Failed to generate service account token:', err);
    }
  }

  return '';
}

/**
 * File type categories mapped from MIME types
 */
const MIME_MAP = {
  'application/pdf': 'pdf',
  'image/jpeg': 'image',
  'image/png': 'image',
  'image/gif': 'image',
  'image/webp': 'image',
  'image/svg+xml': 'image',
  'image/bmp': 'image',
  'video/mp4': 'video',
  'video/quicktime': 'video',
  'video/x-msvideo': 'video',
  'video/webm': 'video',
  'video/x-matroska': 'video',
  'text/plain': 'note',
  'application/vnd.google-apps.document': 'note',
  'application/vnd.google-apps.folder': 'folder',
  'application/vnd.google-apps.spreadsheet': 'note',
  'application/vnd.google-apps.presentation': 'note',
};

/**
 * Determine file type category from MIME type
 */
export function getFileType(mimeType) {
  if (!mimeType) return 'note';
  if (MIME_MAP[mimeType]) return MIME_MAP[mimeType];
  if (mimeType.startsWith('image/')) return 'image';
  if (mimeType.startsWith('video/')) return 'video';
  if (mimeType.startsWith('audio/')) return 'note';
  return 'note';
}

/**
 * Get short type label for accessibility
 */
export function getTypeLabel(fileType) {
  const labels = {
    pdf: 'PDF',
    image: 'IMG',
    video: 'MP4',
    note: 'TXT',
    folder: 'DIR',
  };
  return labels[fileType] || 'FILE';
}

/**
 * Format bytes to human-readable size
 */
export function formatSize(bytes) {
  if (!bytes || bytes === '0') return '-';
  const num = parseInt(bytes, 10);
  if (num < 1024) return `${num} B`;
  if (num < 1024 * 1024) return `${(num / 1024).toFixed(1)} KB`;
  if (num < 1024 * 1024 * 1024) return `${(num / (1024 * 1024)).toFixed(1)} MB`;
  return `${(num / (1024 * 1024 * 1024)).toFixed(1)} GB`;
}

/**
 * Format ISO date to short time string
 */
export function formatDate(isoString) {
  if (!isoString) return '';
  const d = new Date(isoString);
  const now = new Date();
  const isToday = d.toDateString() === now.toDateString();

  if (isToday) {
    return d.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', hour12: false });
  }

  const yesterday = new Date(now);
  yesterday.setDate(yesterday.getDate() - 1);
  if (d.toDateString() === yesterday.toDateString()) {
    return 'Yesterday';
  }

  return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
}

/**
 * Get file extension
 */
export function getExtension(filename) {
  if (!filename) return '';
  const parts = filename.split('.');
  return parts.length > 1 ? parts.pop().toLowerCase() : '';
}

/**
 * List all files and folders in a Drive folder
 */
export async function listFolder(folderId, apiKey) {
  const token = await ensureServiceAccountToken();
  const key = apiKey || getApiKey();

  const fields = 'files(id,name,mimeType,size,createdTime,modifiedTime,thumbnailLink,iconLink,parents,videoMediaMetadata,imageMediaMetadata)';
  const query = `'${folderId}' in parents and trashed = false`;
  const orderBy = 'folder,name';

  let url = `${DRIVE_API_BASE}/files?q=${encodeURIComponent(query)}&fields=${encodeURIComponent(fields)}&orderBy=${encodeURIComponent(orderBy)}&pageSize=1000&supportsAllDrives=true&includeItemsFromAllDrives=true`;
  const headers = {};

  if (token) {
    headers['Authorization'] = `Bearer ${token}`;
  } else if (key) {
    url += `&key=${key}`;
  } else {
    throw new Error('Google Drive API configuration is missing. Configure a Service Account or API key.');
  }

  const response = await fetch(url, { headers });

  if (!response.ok) {
    const errorData = await response.json().catch(() => ({}));
    const message = errorData?.error?.message || `HTTP ${response.status}`;
    throw new Error(message);
  }

  const data = await response.json();
  const items = data.files || [];

  // Separate folders and files, enrich with type info
  const folders = [];
  const files = [];

  for (const item of items) {
    const fileType = getFileType(item.mimeType);
    const enriched = {
      ...item,
      fileType,
      typeLabel: getTypeLabel(fileType),
      formattedSize: formatSize(item.size),
      formattedDate: formatDate(item.modifiedTime),
      extension: getExtension(item.name),
    };

    if (fileType === 'folder') {
      folders.push(enriched);
    } else {
      files.push(enriched);
    }
  }

  // Sort files by modified time (most recent first)
  files.sort((a, b) => new Date(b.modifiedTime) - new Date(a.modifiedTime));

  return { folders, files };
}

/**
 * Get a direct view URL for a file
 */
export function getViewUrl(fileId, mimeType) {
  const fileType = getFileType(mimeType);

  switch (fileType) {
    case 'pdf':
      return `https://drive.google.com/uc?export=download&id=${fileId}`;
    case 'image':
      return `https://drive.google.com/uc?export=view&id=${fileId}`;
    case 'video':
      return `https://drive.google.com/file/d/${fileId}/preview`;
    default:
      return `https://drive.google.com/file/d/${fileId}/view`;
  }
}

/**
 * Get direct download URL
 */
export function getDownloadUrl(fileId) {
  return `https://drive.google.com/uc?export=download&id=${fileId}`;
}

/**
 * Get thumbnail URL (higher resolution)
 */
export function getThumbnailUrl(thumbnailLink, size = 400) {
  if (!thumbnailLink) return null;
  // Drive thumbnail links have =s220 suffix; replace with desired size
  return thumbnailLink.replace(/=s\d+$/, `=s${size}`);
}

/**
 * Count files in a folder (quick count, separate API call)
 */
export async function countFolderItems(folderId, apiKey) {
  const token = await ensureServiceAccountToken();
  const key = apiKey || getApiKey();

  const query = `'${folderId}' in parents and trashed = false`;
  let url = `${DRIVE_API_BASE}/files?q=${encodeURIComponent(query)}&fields=files(id)&pageSize=1000&supportsAllDrives=true&includeItemsFromAllDrives=true`;
  const headers = {};

  if (token) {
    headers['Authorization'] = `Bearer ${token}`;
  } else if (key) {
    url += `&key=${key}`;
  } else {
    return 0;
  }

  try {
    const response = await fetch(url, { headers });
    if (!response.ok) return 0;
    const data = await response.json();
    return data.files?.length || 0;
  } catch {
    return 0;
  }
}

/**
 * Gets an OAuth access token strictly from the admin refresh token.
 * Service accounts CANNOT upload to regular Drive folders (no storage quota),
 * so uploads must always use the admin's delegated OAuth token.
 * Throws a user-friendly error if OAuth is not configured.
 */
async function getOAuthTokenForUpload() {
  // If we already have a valid cached token from admin OAuth, reuse it
  if (currentAccessToken && Date.now() < tokenExpiryTime && adminRefreshToken) {
    return currentAccessToken;
  }

  // Try to refresh using the admin's refresh token
  if (adminRefreshToken) {
    const token = await refreshAdminAccessToken();
    if (token) return token;
  }

  // No OAuth token available — service account cannot be used for uploads
  throw new Error(
    'Google Drive upload requires Admin OAuth authorization. ' +
    'Please ask your admin to connect their Google account in the Admin Panel ' +
    '(Admin → "Connect Google Account for Uploads" button).'
  );
}

/**
 * Creates a folder in Google Drive inside the given parent folder.
 * Uses admin OAuth token (same as uploads).
 *
 * @param {string} folderName
 * @param {string} parentFolderId
 * @returns {Promise<{id: string, name: string}>}
 */
export async function createFolderInDrive(folderName, parentFolderId) {
  const token = await getOAuthTokenForUpload();

  const response = await fetch(
    `${DRIVE_API_BASE}/files?supportsAllDrives=true`,
    {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${token}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        name: folderName,
        mimeType: 'application/vnd.google-apps.folder',
        parents: [parentFolderId],
      }),
    }
  );

  if (!response.ok) {
    const errData = await response.json().catch(() => ({}));
    throw new Error(
      errData?.error?.message || `Folder creation failed: HTTP ${response.status}`
    );
  }

  const data = await response.json();
  return { id: data.id, name: data.name };
}

/**
 * Uploads a file (Blob/File object) to a specific Google Drive folder.
 * IMPORTANT: This always uses the admin OAuth token (refresh token flow).
 * Uses XHR for real upload progress — no base64 encoding (raw binary multipart).
 *
 * @param {File|Blob} fileBlob
 * @param {string} fileName
 * @param {string} parentFolderId
 * @param {function(number):void} [onProgress] — called with 0-100 percent
 */
export async function uploadFileToDrive(fileBlob, fileName, parentFolderId, onProgress) {
  // Always use OAuth for uploads — service accounts lack storage quota
  const token = await getOAuthTokenForUpload();

  const metadata = JSON.stringify({
    name: fileName,
    parents: [parentFolderId],
  });

  // Build a true multipart/related body using Blob concatenation
  // This avoids base64 (~33% size inflation) and is processed faster
  const boundary = 'bahattor_boundary_' + Date.now();
  const CRLF = '\r\n';

  const metaPart = [
    '--' + boundary + CRLF,
    'Content-Type: application/json; charset=UTF-8' + CRLF + CRLF,
    metadata + CRLF,
  ].join('');

  const filePart = [
    '--' + boundary + CRLF,
    'Content-Type: ' + (fileBlob.type || 'application/octet-stream') + CRLF + CRLF,
  ].join('');

  const closePart = CRLF + '--' + boundary + '--';

  const body = new Blob([
    metaPart,
    filePart,
    fileBlob,
    closePart,
  ], { type: `multipart/related; boundary=${boundary}` });

  const url = 'https://www.googleapis.com/upload/drive/v3/files?uploadType=multipart&supportsAllDrives=true';

  return new Promise((resolve, reject) => {
    const xhr = new XMLHttpRequest();
    xhr.open('POST', url);
    xhr.setRequestHeader('Authorization', `Bearer ${token}`);
    xhr.setRequestHeader('Content-Type', `multipart/related; boundary=${boundary}`);

    if (onProgress && xhr.upload) {
      xhr.upload.onprogress = (e) => {
        if (e.lengthComputable) {
          onProgress(Math.round((e.loaded / e.total) * 100));
        }
      };
    }

    xhr.onload = () => {
      if (xhr.status >= 200 && xhr.status < 300) {
        try {
          const data = JSON.parse(xhr.responseText);
          if (onProgress) onProgress(100);
          resolve({
            id: data.id,
            name: data.name,
            mimeType: data.mimeType || fileBlob.type,
          });
        } catch (e) {
          reject(new Error('Failed to parse upload response'));
        }
      } else {
        let message = `Upload failed: HTTP ${xhr.status}`;
        try {
          const errData = JSON.parse(xhr.responseText);
          message = errData?.error?.message || message;
        } catch (_) {}
        if (message.toLowerCase().includes('storage quota') || message.toLowerCase().includes('service account')) {
          message = 'Upload failed: Admin OAuth authorization is required. Please ask your admin to connect their Google account in the Admin Panel.';
        }
        reject(new Error(message));
      }
    };

    xhr.onerror = () => reject(new Error('Network error during upload'));
    xhr.onabort = () => reject(new Error('Upload was aborted'));

    xhr.send(body);
  });
}

/**
 * Permanently deletes a file from Google Drive by its file ID.
 * Only works for files uploaded via this app (requires admin OAuth token).
 * Does NOT affect files/folders selected from existing Drive locations.
 *
 * @param {string} fileId - The Drive file ID to delete
 * @returns {Promise<void>}
 */
export async function deleteFileFromDrive(fileId) {
  if (!fileId) return;

  // Use the same admin OAuth token as uploads
  const token = await getOAuthTokenForUpload();

  const url = `https://www.googleapis.com/drive/v3/files/${encodeURIComponent(fileId)}?supportsAllDrives=true`;
  const response = await fetch(url, {
    method: 'DELETE',
    headers: { 'Authorization': `Bearer ${token}` },
  });

  // 204 No Content = success, 404 = already gone — both are acceptable
  if (!response.ok && response.status !== 404) {
    let message = `Drive delete failed: HTTP ${response.status}`;
    try {
      const errData = await response.json();
      message = errData?.error?.message || message;
    } catch (_) {}
    throw new Error(message);
  }
}
