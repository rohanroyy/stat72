import { API_KEY, DRIVE_API_BASE } from '../config/drive';

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
export async function listFolder(folderId) {
  if (!API_KEY) {
    throw new Error('NO_API_KEY');
  }

  const fields = 'files(id,name,mimeType,size,createdTime,modifiedTime,thumbnailLink,iconLink,parents,videoMediaMetadata,imageMediaMetadata)';
  const query = `'${folderId}' in parents and trashed = false`;
  const orderBy = 'folder,name';

  const url = `${DRIVE_API_BASE}/files?q=${encodeURIComponent(query)}&fields=${encodeURIComponent(fields)}&orderBy=${encodeURIComponent(orderBy)}&pageSize=1000&key=${API_KEY}`;

  const response = await fetch(url);

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
export async function countFolderItems(folderId) {
  if (!API_KEY) return 0;

  const query = `'${folderId}' in parents and trashed = false`;
  const url = `${DRIVE_API_BASE}/files?q=${encodeURIComponent(query)}&fields=files(id)&pageSize=1000&key=${API_KEY}`;

  try {
    const response = await fetch(url);
    if (!response.ok) return 0;
    const data = await response.json();
    return data.files?.length || 0;
  } catch {
    return 0;
  }
}
