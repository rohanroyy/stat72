import { getFileType, getTypeLabel, formatSize, formatDate, getExtension } from './driveService';

const STORAGE_TOKEN_KEY = 'studydock_telegram_token';
const STORAGE_CHAT_ID_KEY = 'studydock_telegram_chat_id';
const STORAGE_DATA_KEY = 'studydock_telegram_data';
const STORAGE_TOPICS_KEY = 'studydock_telegram_topics_map';
const STORAGE_CUSTOM_NAMES_KEY = 'studydock_telegram_custom_names';
const STORAGE_OFFSET_KEY = 'studydock_telegram_last_offset';

// Default Bot Token from user
export const DEFAULT_BOT_TOKEN = '8887541572:AAGTpmJcFkWk27BCyCYCRQzkYg8hac1U_Q8';

/**
 * Get Telegram Config
 */
export function getTelegramConfig() {
  return {
    token: localStorage.getItem(STORAGE_TOKEN_KEY) || DEFAULT_BOT_TOKEN,
    chatId: localStorage.getItem(STORAGE_CHAT_ID_KEY) || '',
  };
}

/**
 * Save Telegram Config
 */
export function saveTelegramConfig(token, chatId) {
  const oldToken = localStorage.getItem(STORAGE_TOKEN_KEY);
  const oldChatId = localStorage.getItem(STORAGE_CHAT_ID_KEY);

  if (oldToken !== token || oldChatId !== chatId) {
    // Config changed: clear offset and cached sync data to trigger a fresh sync
    localStorage.removeItem(STORAGE_OFFSET_KEY);
    localStorage.removeItem(STORAGE_DATA_KEY);
    localStorage.removeItem(STORAGE_TOPICS_KEY);
    localStorage.removeItem(STORAGE_CUSTOM_NAMES_KEY);
  }

  localStorage.setItem(STORAGE_TOKEN_KEY, token);
  localStorage.setItem(STORAGE_CHAT_ID_KEY, chatId);
}

/**
 * Reset Telegram Config and all local data
 */
export function clearTelegramConfig() {
  localStorage.removeItem(STORAGE_TOKEN_KEY);
  localStorage.removeItem(STORAGE_CHAT_ID_KEY);
  localStorage.removeItem(STORAGE_DATA_KEY);
  localStorage.removeItem(STORAGE_TOPICS_KEY);
  localStorage.removeItem(STORAGE_OFFSET_KEY);
  localStorage.removeItem(STORAGE_CUSTOM_NAMES_KEY);
}

/**
 * Get the auto-detected topics map (thread_id -> name from Telegram events)
 */
export function getTopicsMap() {
  try {
    const raw = localStorage.getItem(STORAGE_TOPICS_KEY);
    return raw ? JSON.parse(raw) : {};
  } catch {
    return {};
  }
}

/**
 * Get manually set topic name overrides (thread_id -> custom name)
 */
export function getCustomTopicNames() {
  try {
    const raw = localStorage.getItem(STORAGE_CUSTOM_NAMES_KEY);
    return raw ? JSON.parse(raw) : {};
  } catch {
    return {};
  }
}

/**
 * Save a custom name for a topic thread ID.
 * These override the auto-detected names.
 */
export function saveCustomTopicName(threadId, name) {
  const existing = getCustomTopicNames();
  existing[threadId.toString()] = name.trim();
  localStorage.setItem(STORAGE_CUSTOM_NAMES_KEY, JSON.stringify(existing));
}

/**
 * Delete a custom topic name override.
 */
export function deleteCustomTopicName(threadId) {
  const existing = getCustomTopicNames();
  delete existing[threadId.toString()];
  localStorage.setItem(STORAGE_CUSTOM_NAMES_KEY, JSON.stringify(existing));
}

/**
 * Get effective name for a topic:
 * custom name > auto-detected > fallback "Thread NNNN"
 */
export function getTopicName(threadId) {
  const tid = threadId.toString();
  const custom = getCustomTopicNames();
  if (custom[tid]) return custom[tid];
  const auto = getTopicsMap();
  if (auto[tid]) return auto[tid];
  return `Thread ${tid}`;
}

/**
 * Apply custom names to all stored folders (call after saving a custom name)
 */
export function applyCustomNamesToFolders() {
  const data = getTelegramData();
  const custom = getCustomTopicNames();
  const folders = [...data.folders];

  // For each custom name, make sure a folder exists
  Object.entries(custom).forEach(([tid, name]) => {
    const existingIdx = folders.findIndex(f => f.id.toString() === tid.toString());
    if (existingIdx === -1) {
      folders.push({
        id: tid,
        name: name,
        type: 'folder',
        folderId: tid,
      });
    } else {
      folders[existingIdx].name = name;
    }
  });

  saveTelegramData(folders, data.files);
  return { folders, files: data.files };
}

/**
 * Retrieve synced Telegram files & folders from localStorage.
 * Returns empty arrays when nothing has been synced yet — no demo data.
 */
export function getTelegramData() {
  try {
    const rawData = localStorage.getItem(STORAGE_DATA_KEY);
    if (!rawData) {
      return { folders: [], files: [] };
    }
    const parsed = JSON.parse(rawData);
    return {
      folders: parsed.folders || [],
      files: parsed.files || [],
    };
  } catch {
    return { folders: [], files: [] };
  }
}

/**
 * Save Telegram Synced Data
 */
export function saveTelegramData(folders, files) {
  localStorage.setItem(STORAGE_DATA_KEY, JSON.stringify({ folders, files }));
}

/**
 * Resolve direct download URL for a file using Telegram bot API.
 * Returns null if the file is > 20MB (Bot API limit) rather than throwing.
 */
export async function fetchFileUrl(botToken, fileId) {
  try {
    const url = `https://api.telegram.org/bot${botToken}/getFile?file_id=${fileId}`;
    const response = await fetch(url);
    if (!response.ok) {
      return null;
    }
    const data = await response.json();
    if (!data.ok || !data.result?.file_path) {
      return null; // file too large (>20MB) or missing
    }
    return `https://api.telegram.org/file/bot${botToken}/${data.result.file_path}`;
  } catch (err) {
    console.error('Failed to fetch file URL:', err);
    return null;
  }
}

/**
 * Sync updates from Telegram Bot API.
 * - Fetches new updates from getUpdates (long-poll disabled, instant return)
 * - Extracts topic (folder) info and file attachments
 * - Files are always added even if URL can't be resolved (e.g. > 20MB)
 */
export async function syncTelegramUpdates(botToken, chatId) {
  const currentData = getTelegramData();
  const currentFolders = [...currentData.folders];
  const currentFiles = [...currentData.files];

  // Merged topic name map: auto-detected + custom overrides
  let topicsMap = getTopicsMap();
  const customNames = getCustomTopicNames();

  // Standard bot polling offset
  const lastOffset = parseInt(localStorage.getItem(STORAGE_OFFSET_KEY) || '0', 10);

  // offset=0 when never polled before fetches ALL available pending updates from Telegram
  // (Telegram stores updates for 24h)
  const offsetParam = lastOffset > 0 ? lastOffset + 1 : 0;
  const url = `https://api.telegram.org/bot${botToken}/getUpdates?offset=${offsetParam}&limit=100&timeout=0`;

  const response = await fetch(url);
  if (!response.ok) {
    throw new Error(`Telegram API returned HTTP ${response.status}`);
  }

  const resData = await response.json();
  if (!resData.ok) {
    throw new Error(resData.description || 'Telegram API error — check your bot token');
  }

  const updates = resData.result || [];

  if (updates.length > 0) {
    // Advance the offset so we don't re-process these updates
    const maxUpdateId = Math.max(...updates.map(u => u.update_id));
    localStorage.setItem(STORAGE_OFFSET_KEY, maxUpdateId.toString());
  }

  let filesAdded = 0;

  for (const update of updates) {
    const message = update.message || update.channel_post || update.edited_message || update.edited_channel_post;
    if (!message) continue;

    // Filter by target chat ID using robust normalization
    const compareChatIds = (id1, id2) => {
      if (!id1 || !id2) return false;
      const clean = (id) => {
        let s = String(id).trim();
        if (s.startsWith('-100')) s = s.substring(4);
        else if (s.startsWith('-')) s = s.substring(1);
        return s;
      };
      return clean(id1) === clean(id2);
    };

    if (chatId && !compareChatIds(message.chat?.id, chatId)) {
      continue;
    }

    // Determine which topic thread this message belongs to
    // message_thread_id is present for forum topic messages
    const rawThreadId = message.message_thread_id;
    const threadId = rawThreadId ? rawThreadId.toString() : 'topic-general';

    // ─── Topic name resolution ───────────────────────────────────────────────
    // Priority: custom override > forum_topic_created event > existing auto map
    const resolveTopicName = (tid) => {
      if (customNames[tid]) return customNames[tid];
      if (topicsMap[tid]) return topicsMap[tid];
      return null;
    };

    // Handle forum_topic_created service message
    if (message.forum_topic_created) {
      const autoName = message.forum_topic_created.name;
      topicsMap[threadId] = autoName;
    }

    // Handle forum_topic_edited service message
    if (message.forum_topic_edited?.name) {
      topicsMap[threadId] = message.forum_topic_edited.name;
    }

    // ─── Upsert folder for this thread ───────────────────────────────────────
    if (threadId !== 'topic-general') {
      const folderName = resolveTopicName(threadId) || topicsMap[threadId] || `Thread ${threadId}`;
      const existingIdx = currentFolders.findIndex(f => f.id === threadId);
      if (existingIdx === -1) {
        currentFolders.push({
          id: threadId,
          name: folderName,
          type: 'folder',
          folderId: threadId,
        });
      } else {
        // Always update name in case a custom name was just applied
        currentFolders[existingIdx].name = resolveTopicName(threadId) || currentFolders[existingIdx].name;
      }
    } else {
      // General topic
      const genName = resolveTopicName('topic-general') || 'General';
      if (!currentFolders.some(f => f.id === 'topic-general')) {
        currentFolders.push({
          id: 'topic-general',
          name: genName,
          type: 'folder',
          folderId: 'topic-general',
        });
      }
    }

    // ─── Extract media / file attachment ─────────────────────────────────────
    let fileObj = null;

    if (message.document) {
      const doc = message.document;
      fileObj = {
        id: doc.file_id,
        uniqueId: doc.file_unique_id,
        name: doc.file_name || `document_${message.message_id}`,
        mimeType: doc.mime_type || 'application/octet-stream',
        size: doc.file_size || 0,
        messageId: message.message_id,
        date: message.date,
      };
    } else if (message.photo?.length > 0) {
      const photo = message.photo[message.photo.length - 1];
      const caption = message.caption || `photo_${message.message_id}`;
      fileObj = {
        id: photo.file_id,
        uniqueId: photo.file_unique_id,
        name: caption.match(/\.(jpg|jpeg|png|gif|webp)$/i) ? caption : `${caption}.jpg`,
        mimeType: 'image/jpeg',
        size: photo.file_size || 0,
        messageId: message.message_id,
        date: message.date,
      };
    } else if (message.video) {
      const vid = message.video;
      const caption = message.caption || `video_${message.message_id}`;
      fileObj = {
        id: vid.file_id,
        uniqueId: vid.file_unique_id,
        name: vid.file_name || (caption.match(/\.(mp4|mkv|avi|mov)$/i) ? caption : `${caption}.mp4`),
        mimeType: vid.mime_type || 'video/mp4',
        size: vid.file_size || 0,
        messageId: message.message_id,
        date: message.date,
      };
    } else if (message.audio) {
      const aud = message.audio;
      const caption = message.caption || aud.title || `audio_${message.message_id}`;
      fileObj = {
        id: aud.file_id,
        uniqueId: aud.file_unique_id,
        name: aud.file_name || `${caption}.mp3`,
        mimeType: aud.mime_type || 'audio/mpeg',
        size: aud.file_size || 0,
        messageId: message.message_id,
        date: message.date,
      };
    } else if (message.voice) {
      const v = message.voice;
      fileObj = {
        id: v.file_id,
        uniqueId: v.file_unique_id,
        name: `voice_${message.message_id}.ogg`,
        mimeType: v.mime_type || 'audio/ogg',
        size: v.file_size || 0,
        messageId: message.message_id,
        date: message.date,
      };
    }

    if (fileObj) {
      // Prevent duplicate file inserts (by unique_id or file_id)
      if (currentFiles.some(f => f.uniqueId === fileObj.uniqueId || f.id === fileObj.id)) {
        continue;
      }

      const fileType = getFileType(fileObj.mimeType);
      const modifiedTime = new Date(fileObj.date * 1000).toISOString();

      // Try to resolve a direct download URL.
      // Files >20MB can't be downloaded via Bot API, so we store url:null
      // and still show the file in the list.
      const directUrl = await fetchFileUrl(botToken, fileObj.id);

      const enrichedFile = {
        id: fileObj.id,
        uniqueId: fileObj.uniqueId,
        name: fileObj.name,
        fileType,
        typeLabel: getTypeLabel(fileType),
        size: fileObj.size,
        formattedSize: formatSize(fileObj.size),
        modifiedTime,
        formattedDate: formatDate(modifiedTime),
        extension: getExtension(fileObj.name),
        url: directUrl,           // may be null for large files
        tgFileId: fileObj.id,     // stored for future reference
        messageId: fileObj.messageId,
        parents: [threadId],      // maps to folder by thread ID
      };

      currentFiles.push(enrichedFile);
      filesAdded++;
    }
  }

  // Persist updated topic map and data
  localStorage.setItem(STORAGE_TOPICS_KEY, JSON.stringify(topicsMap));
  saveTelegramData(currentFolders, currentFiles);

  return {
    folders: currentFolders,
    files: currentFiles,
    newCount: filesAdded,
  };
}
