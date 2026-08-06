import { supabase, isSupabaseConfigured } from '../lib/supabase';
import { uploadFileToDrive, createFolderInDrive, deleteFileFromDrive } from './driveService';
import { extractFolderId } from '../config/drive';

// ── Local storage keys ────────────────────────────────────────────────────────
const LOCAL_POSTS_PREFIX   = 'bahattor_cf_posts_';
const LOCAL_REPLIES_PREFIX = 'bahattor_cf_replies_';
const LOCAL_FOLDER_PREFIX  = 'bahattor_cf_folder_';   // cache: examId → Drive folder ID

// ── Helpers ───────────────────────────────────────────────────────────────────

function readLocal(key) {
  try { return JSON.parse(localStorage.getItem(key) || 'null') || []; } catch { return []; }
}
function writeLocal(key, value) {
  localStorage.setItem(key, JSON.stringify(value));
}

function getCachedFolderId(examId) {
  return localStorage.getItem(LOCAL_FOLDER_PREFIX + examId) || null;
}
function cacheFolderId(examId, folderId) {
  localStorage.setItem(LOCAL_FOLDER_PREFIX + examId, folderId);
}

// ── Time formatting utility ───────────────────────────────────────────────────

export function formatRelativeTime(isoString) {
  if (!isoString) return '';
  const secs = Math.floor((Date.now() - new Date(isoString)) / 1000);
  if (secs < 60)  return 'just now';
  if (secs < 3600) return `${Math.floor(secs / 60)}m ago`;
  if (secs < 86400) return `${Math.floor(secs / 3600)}h ago`;
  const days = Math.floor(secs / 86400);
  if (days < 7)   return `${days}d ago`;
  return new Date(isoString).toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
}

// ── Drive folder management ───────────────────────────────────────────────────

/**
 * Returns the Drive folder ID to use for confusion image uploads for a given exam.
 * Creates the folder on first use, then caches the ID in localStorage.
 *
 * Folder path: <suggestionUploadFolder> / "<examName> – Confusions"
 */
export async function getOrCreateConfusionFolder(examId, examName, uploadFolderLink) {
  const cached = getCachedFolderId(examId);
  if (cached) return cached;

  const parentId = extractFolderId(uploadFolderLink);
  if (!parentId) {
    throw new Error('Admin has not configured an upload folder. Please set it in the Admin Panel.');
  }

  const folderName = `${examName} – Confusions`;
  const folder = await createFolderInDrive(folderName, parentId);
  cacheFolderId(examId, folder.id);
  return folder.id;
}

// ── Image upload ──────────────────────────────────────────────────────────────

/**
 * Uploads image files to the exam's confusion Drive folder.
 * Returns an array of attachment objects: { type, name, driveId, mimeType, uploaded }
 */
export async function uploadConfusionImages(files, examId, examName, uploadFolderLink, onProgress) {
  const folderId = await getOrCreateConfusionFolder(examId, examName, uploadFolderLink);
  const results = [];

  for (let i = 0; i < files.length; i++) {
    const file = files[i];
    const result = await uploadFileToDrive(file, file.name, folderId, (pct) => {
      if (onProgress) {
        const overall = Math.round(((i + pct / 100) / files.length) * 100);
        onProgress(overall, i + 1, files.length);
      }
    });
    results.push({
      type: 'image',
      name: result.name,
      driveId: result.id,
      mimeType: result.mimeType || file.type,
      uploaded: true,
    });
  }

  return results;
}

// ── Posts ─────────────────────────────────────────────────────────────────────

/**
 * Lightweight count-only query — used for the confusion FAB badge.
 * Does not load post bodies or avatars.
 */
export async function fetchPostCount(examId) {
  if (!examId) return 0;
  if (!isSupabaseConfigured()) {
    return readLocal(LOCAL_POSTS_PREFIX + examId).length;
  }
  try {
    const { count, error } = await supabase
      .from('confusion_posts')
      .select('id', { count: 'exact', head: true })
      .eq('exam_id', examId);
    if (error) throw new Error(error.message);
    return count ?? 0;
  } catch {
    return readLocal(LOCAL_POSTS_PREFIX + examId).length;
  }
}

export async function fetchPosts(examId) {
  if (!isSupabaseConfigured()) return readLocal(LOCAL_POSTS_PREFIX + examId);
  try {
    const { data, error } = await supabase
      .from('confusion_posts')
      .select('*')
      .eq('exam_id', examId)
      .order('created_at', { ascending: false });
    if (error) throw new Error(error.message);

    const posts = data || [];
    if (posts.length > 0) {
      const authorIds = [...new Set(posts.map(p => p.author_id).filter(Boolean))];
      if (authorIds.length > 0) {
        const { data: students } = await supabase
          .from('students')
          .select('id, profile_picture')
          .in('id', authorIds);
        if (students) {
          const avatarMap = Object.fromEntries(students.map(s => [s.id, s.profile_picture]));
          posts.forEach(p => {
            p.author_avatar = avatarMap[p.author_id] || p.author_avatar || null;
          });
        }
      }
    }
    return posts;
  } catch (err) {
    console.error('fetchPosts failed:', err);
    return readLocal(LOCAL_POSTS_PREFIX + examId);
  }
}

export async function createPost(examId, { text, images }, author) {
  const newPost = {
    id: `cp_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`,
    exam_id: examId,
    author_id: author.id,
    author_name: author.name,
    author_avatar: author.profile_picture || author.avatar || null,
    text: text || null,
    images: Array.isArray(images) ? images : [],
    helpful: 0,
    status: 'open',
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
  };

  if (!isSupabaseConfigured()) {
    const list = readLocal(LOCAL_POSTS_PREFIX + examId);
    list.unshift(newPost);
    writeLocal(LOCAL_POSTS_PREFIX + examId, list);
    return newPost;
  }

  try {
    const { data, error } = await supabase
      .from('confusion_posts')
      .insert(newPost)
      .select()
      .single();
    if (error) throw new Error(error.message);
    return data;
  } catch (err) {
    console.error('createPost DB error, using local fallback:', err.message);
    const list = readLocal(LOCAL_POSTS_PREFIX + examId);
    list.unshift(newPost);
    writeLocal(LOCAL_POSTS_PREFIX + examId, list);
    return newPost;
  }
}

export async function updatePost(examId, postId, { text, images }) {
  const updated_at = new Date().toISOString();
  const imageValue = Array.isArray(images) ? images : [];

  if (!isSupabaseConfigured()) {
    const list = readLocal(LOCAL_POSTS_PREFIX + examId).map(p =>
      p.id === postId ? { ...p, text: text || null, images: imageValue, updated_at } : p
    );
    writeLocal(LOCAL_POSTS_PREFIX + examId, list);
    return list.find(p => p.id === postId) || null;
  }

  try {
    const { data, error } = await supabase
      .from('confusion_posts')
      .update({ text: text || null, images: imageValue, updated_at })
      .eq('id', postId)
      .select()
      .single();
    if (error) throw new Error(error.message);
    return data;
  } catch (err) {
    console.error('updatePost DB error:', err.message);
    throw err;
  }
}

export async function deletePost(examId, postId) {
  if (!isSupabaseConfigured()) {
    const list = readLocal(LOCAL_POSTS_PREFIX + examId).filter(p => p.id !== postId);
    writeLocal(LOCAL_POSTS_PREFIX + examId, list);
    return;
  }

  const { error } = await supabase.from('confusion_posts').delete().eq('id', postId);
  if (error) throw new Error(error.message);
}

// ── Replies ───────────────────────────────────────────────────────────────────

export async function fetchReplies(postId) {
  if (!isSupabaseConfigured()) return readLocal(LOCAL_REPLIES_PREFIX + postId);
  try {
    const { data, error } = await supabase
      .from('confusion_replies')
      .select('*')
      .eq('post_id', postId)
      .order('created_at', { ascending: true });
    if (error) throw new Error(error.message);

    const replies = data || [];
    if (replies.length > 0) {
      const authorIds = [...new Set(replies.map(r => r.author_id).filter(Boolean))];
      if (authorIds.length > 0) {
        const { data: students } = await supabase
          .from('students')
          .select('id, profile_picture')
          .in('id', authorIds);
        if (students) {
          const avatarMap = Object.fromEntries(students.map(s => [s.id, s.profile_picture]));
          replies.forEach(r => {
            r.author_avatar = avatarMap[r.author_id] || r.author_avatar || null;
          });
        }
      }
    }
    return replies;
  } catch (err) {
    console.error('fetchReplies failed:', err);
    return readLocal(LOCAL_REPLIES_PREFIX + postId);
  }
}

export async function createReply(postId, { text, images }, author) {
  const newReply = {
    id: `cr_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`,
    post_id: postId,
    author_id: author.id,
    author_name: author.name,
    author_avatar: author.profile_picture || author.avatar || null,
    text: text || null,
    images: Array.isArray(images) ? images : [],
    helpful: 0,
    created_at: new Date().toISOString(),
  };

  if (!isSupabaseConfigured()) {
    const list = readLocal(LOCAL_REPLIES_PREFIX + postId);
    list.push(newReply);
    writeLocal(LOCAL_REPLIES_PREFIX + postId, list);
    return newReply;
  }

  try {
    const { data, error } = await supabase
      .from('confusion_replies')
      .insert(newReply)
      .select()
      .single();
    if (error) throw new Error(error.message);
    return data;
  } catch (err) {
    console.error('createReply DB error, using local fallback:', err.message);
    const list = readLocal(LOCAL_REPLIES_PREFIX + postId);
    list.push(newReply);
    writeLocal(LOCAL_REPLIES_PREFIX + postId, list);
    return newReply;
  }
}

export async function deleteReply(postId, replyId) {
  if (!isSupabaseConfigured()) {
    const list = readLocal(LOCAL_REPLIES_PREFIX + postId).filter(r => r.id !== replyId);
    writeLocal(LOCAL_REPLIES_PREFIX + postId, list);
    return;
  }

  const { error } = await supabase.from('confusion_replies').delete().eq('id', replyId);
  if (error) throw new Error(error.message);
}

// ── Drive image cleanup ───────────────────────────────────────────────────────

/**
 * Deletes all uploaded Drive images from a list of image attachment objects.
 * Only deletes files with { uploaded: true } — Drive-picker picks are skipped.
 */
export async function deleteConfusionImages(images) {
  if (!Array.isArray(images)) return;
  const uploaded = images.filter(img => img?.uploaded && img?.driveId);
  await Promise.allSettled(uploaded.map(img => deleteFileFromDrive(img.driveId)));
}

// ── Realtime ──────────────────────────────────────────────────────────────────

export function subscribeToConfusions(examId, onChange) {
  if (!isSupabaseConfigured()) return () => {};
  try {
    const channel = supabase
      .channel(`cf_${examId}`)
      .on('postgres_changes', {
        event: '*', schema: 'public', table: 'confusion_posts',
        filter: `exam_id=eq.${examId}`,
      }, () => onChange())
      .on('postgres_changes', {
        event: '*', schema: 'public', table: 'confusion_replies',
      }, () => onChange())
      .subscribe();
    return () => supabase.removeChannel(channel);
  } catch {
    return () => {};
  }
}
