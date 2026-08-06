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
 * Build a fetch URL + headers for a file
 */
function buildFetchConfig(file) {
  const headers = {};
  const token = getAccessToken();
  let fetchUrl = '';

  if (file.id) {
    if (token) {
      headers['Authorization'] = `Bearer ${token}`;
      fetchUrl = `https://www.googleapis.com/drive/v3/files/${file.id}?alt=media&supportsAllDrives=true`;
    } else {
      const apiKey = getApiKey();
      if (!apiKey) throw new Error('Google Drive API key or OAuth token required.');
      fetchUrl = `https://www.googleapis.com/drive/v3/files/${file.id}?alt=media&key=${apiKey}&supportsAllDrives=true`;
    }
  } else if (file.url) {
    fetchUrl = file.url;
  } else {
    throw new Error('No file URL or ID available.');
  }

  return { fetchUrl, headers };
}

/**
 * Check if a file is already cached (does NOT fetch).
 */
export async function isFileCached(file) {
  const cacheKey = getCacheKey(file);
  if (!cacheKey) return false;
  try {
    const cache = await caches.open(CACHE_NAME);
    const hit = await cache.match(cacheKey);
    return !!hit;
  } catch {
    return false;
  }
}

/**
 * Pre-caches a file in the background without blocking the caller.
 * Safe to call multiple times — skips if already cached.
 * Returns a promise you can optionally await.
 */
export function preCacheFile(file) {
  const cacheKey = getCacheKey(file);
  if (!cacheKey) return Promise.resolve(null);

  return (async () => {
    try {
      const cache = await caches.open(CACHE_NAME);

      // Already cached — skip
      if (await cache.match(cacheKey)) {
        return;
      }

      console.log(`[Cache] Pre-caching file in background: ${file.name}`);
      const { fetchUrl, headers } = buildFetchConfig(file);
      const response = await fetch(fetchUrl, { headers });
      if (!response.ok) throw new Error(`Pre-cache fetch failed: HTTP ${response.status}`);
      await cache.put(cacheKey, response);
      console.log(`[Cache] Pre-cache complete: ${file.name}`);
    } catch (err) {
      // Non-fatal — silently fail, viewer will fetch fresh when opened
      console.warn('[Cache] Pre-cache skipped:', err.message || err);
    }
  })();
}

/**
 * Gets a cached file's object URL, or fetches + caches it and returns a blob URL.
 *
 * On cache hit  → returns object URL immediately (fast).
 * On cache miss → downloads, stores in Cache Storage, returns object URL.
 *
 * @returns {Promise<string|null>} blob:// object URL, or null on failure
 */
export async function getOrFetchCachedFile(file) {
  const cacheKey = getCacheKey(file);
  if (!cacheKey) return null;

  try {
    const cache = await caches.open(CACHE_NAME);
    const cachedResponse = await cache.match(cacheKey);

    if (cachedResponse) {
      console.log(`[Cache] Cache hit: ${file.name}`);
      const blob = await cachedResponse.blob();
      return URL.createObjectURL(blob);
    }

    console.log(`[Cache] Cache miss — fetching: ${file.name}`);
    const { fetchUrl, headers } = buildFetchConfig(file);

    const response = await fetch(fetchUrl, { headers });
    if (!response.ok) throw new Error(`Fetch failed: HTTP ${response.status}`);

    // Store in cache and create object URL from same data
    const blob = await response.blob();
    // Re-wrap blob as a Response for Cache Storage
    await cache.put(cacheKey, new Response(blob, {
      headers: { 'Content-Type': blob.type || 'application/octet-stream' },
    }));
    console.log(`[Cache] Cached successfully: ${file.name}`);

    return URL.createObjectURL(blob);
  } catch (err) {
    console.warn('[Cache] Error during file caching/fetching:', err);
    return null;
  }
}

/**
 * Remove a specific file from the cache.
 */
export async function removeCachedFile(file) {
  const cacheKey = getCacheKey(file);
  if (!cacheKey) return;
  try {
    const cache = await caches.open(CACHE_NAME);
    await cache.delete(cacheKey);
    console.log(`[Cache] Removed from cache: ${file.name}`);
  } catch (err) {
    console.warn('[Cache] Error removing cached file:', err);
  }
}
