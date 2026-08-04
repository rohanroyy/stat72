import { getApiKey } from '../config/drive';
import { getAccessToken } from './driveService';

const CACHE_NAME = 'bahattor-file-cache-v1';

/**
 * Returns a unique cache key URL for a file
 */
function getCacheKey(file) {
  if (file.id) {
    return `https://bahattor-cache.local/drive/${file.id}`;
  }
  if (file.url) {
    return file.url;
  }
  return null;
}

/**
 * Gets a cached file's object URL, or fetches and caches it if not present.
 * Returns the local blob URL.
 */
export async function getOrFetchCachedFile(file) {
  const cacheKey = getCacheKey(file);
  if (!cacheKey) {
    return null;
  }

  try {
    const cache = await caches.open(CACHE_NAME);
    const cachedResponse = await cache.match(cacheKey);

    if (cachedResponse) {
      console.log(`[Cache] Found cached file in Cache Storage: ${file.name}`);
      const blob = await cachedResponse.blob();
      return URL.createObjectURL(blob);
    }

    console.log(`[Cache] Cache miss. Fetching file: ${file.name}`);
    
    let fetchUrl = '';
    const headers = {};
    const token = getAccessToken();

    if (file.id) {
      if (token) {
        headers['Authorization'] = `Bearer ${token}`;
        fetchUrl = `https://www.googleapis.com/drive/v3/files/${file.id}?alt=media&supportsAllDrives=true`;
      } else {
        const apiKey = getApiKey();
        if (!apiKey) {
          throw new Error('Google Drive API key or OAuth token required.');
        }
        fetchUrl = `https://www.googleapis.com/drive/v3/files/${file.id}?alt=media&key=${apiKey}&supportsAllDrives=true`;
      }
    } else if (file.url) {
      fetchUrl = file.url;
    } else {
      return null;
    }

    const response = await fetch(fetchUrl, { headers });
    if (!response.ok) {
      throw new Error(`Fetch failed with status ${response.status}`);
    }

    // Clone the response to store in cache
    const responseClone = response.clone();
    await cache.put(cacheKey, responseClone);
    console.log(`[Cache] File cached successfully: ${file.name}`);

    const blob = await response.blob();
    return URL.createObjectURL(blob);

  } catch (err) {
    console.warn('[Cache] Error during file caching/fetching:', err);
    return null;
  }
}
