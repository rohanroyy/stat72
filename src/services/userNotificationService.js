/**
 * userNotificationService.js
 *
 * Handles per-user activity notifications:
 *  - suggestion added     → notify all students except the actor
 *  - confusion post       → notify all students except the actor
 *  - confusion reply      → notify only the original post's author
 *
 * Storage: Supabase `user_notifications` table (with local-storage fallback).
 */

import { supabase, isSupabaseConfigured } from '../lib/supabase';
import { fetchAllStudents } from './broadcastService';

const LOCAL_KEY = (userId) => `bahattor_user_notifs_${userId}`;
const MAX_LOCAL  = 50;

// ── Helpers ───────────────────────────────────────────────────────────────────

function makeId() {
  return `un_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
}

function readLocal(userId) {
  try {
    return JSON.parse(localStorage.getItem(LOCAL_KEY(userId)) || '[]');
  } catch {
    return [];
  }
}

function writeLocal(userId, list) {
  try {
    localStorage.setItem(LOCAL_KEY(userId), JSON.stringify(list.slice(0, MAX_LOCAL)));
  } catch { /* quota */ }
}

/** Build the deep-link action URL for a notification. */
function buildActionUrl(type, examId, refId) {
  const base = '/?tab=calendar';
  if (!examId) return base;
  if (type === 'suggestion') {
    return `${base}&e=${encodeURIComponent(examId)}&s=${encodeURIComponent(refId || '')}`;
  }
  // confusion_post or confusion_reply
  return `${base}&e=${encodeURIComponent(examId)}&c=${encodeURIComponent(refId || '')}`;
}

/** Build a single notification row object. */
function buildNotif({ userId, type, title, body, examId, examName, refId, sender }) {
  return {
    id:           makeId(),
    user_id:      userId,
    type,
    title,
    body:         body || null,
    exam_id:      examId || null,
    exam_name:    examName || null,
    ref_id:       refId || null,
    action_url:   buildActionUrl(type, examId, refId),
    sender_id:    sender?.id   || null,
    sender_name:  sender?.name || null,
    sender_photo: sender?.profile_picture || sender?.avatar || null,
    read:         false,
    created_at:   new Date().toISOString(),
  };
}

// ── Bulk insert (Supabase) ────────────────────────────────────────────────────

async function insertMany(rows) {
  if (!rows.length) return;
  try {
    const { error } = await supabase.from('user_notifications').insert(rows);
    if (error) {
      console.error('[userNotifService] Supabase insert error — if this says "relation does not exist", run the user_notifications SQL in your Supabase dashboard:', error.message);
      // Fallback: store in localStorage so notifications still appear in-app
      rows.forEach((row) => {
        const list = readLocal(row.user_id);
        list.unshift(row);
        writeLocal(row.user_id, list);
      });
      window.dispatchEvent(new Event('user_notif_update'));
    }
  } catch (err) {
    console.error('[userNotifService] insertMany threw:', err.message);
    // Fallback: store in localStorage
    rows.forEach((row) => {
      const list = readLocal(row.user_id);
      list.unshift(row);
      writeLocal(row.user_id, list);
    });
    window.dispatchEvent(new Event('user_notif_update'));
  }
}

// ── Public: fetch ─────────────────────────────────────────────────────────────

/**
 * Fetch all notifications for the current user, newest first.
 */
export async function fetchMyNotifications(userId) {
  if (!userId) return [];

  // Always include any locally-stored notifications (fallback + offline)
  const localItems = readLocal(userId);

  if (!isSupabaseConfigured()) {
    return localItems;
  }

  try {
    const { data, error } = await supabase
      .from('user_notifications')
      .select('*')
      .eq('user_id', userId)
      .order('created_at', { ascending: false })
      .limit(60);

    if (error) {
      // Table may not exist yet — return local data silently
      console.warn('[userNotifService] fetchMyNotifications (using local fallback):', error.message);
      return localItems;
    }

    const remoteItems = data || [];

    // Merge: remote first, then any local-only items not in remote
    const remoteIds = new Set(remoteItems.map((n) => n.id));
    const localOnly = localItems.filter((n) => !remoteIds.has(n.id));
    return [...remoteItems, ...localOnly];
  } catch (err) {
    console.warn('[userNotifService] fetchMyNotifications threw, using local:', err.message);
    return localItems;
  }
}

// ── Public: send ──────────────────────────────────────────────────────────────

/**
 * Send a notification to ALL students EXCEPT the actor (suggestion added).
 * Fire-and-forget: caller should not await this.
 */
export async function sendSuggestionNotification({ actor, examId, examName, suggId }) {
  if (!actor?.id) return;
  try {
    const allStudents = await fetchAllStudents();
    const recipients = allStudents.filter((s) => s.id !== actor.id);
    if (!recipients.length) return;

    const title = `${actor.name} added a suggestion in ${examName || 'an exam'}`;

    if (!isSupabaseConfigured()) {
      recipients.forEach((s) => {
        const list = readLocal(s.id);
        list.unshift(buildNotif({ userId: s.id, type: 'suggestion', title, examId, examName, refId: suggId, sender: actor }));
        writeLocal(s.id, list);
      });
      window.dispatchEvent(new Event('user_notif_update'));
      return;
    }

    const rows = recipients.map((s) =>
      buildNotif({ userId: s.id, type: 'suggestion', title, examId, examName, refId: suggId, sender: actor })
    );
    await insertMany(rows);
  } catch (err) {
    console.error('[userNotifService] sendSuggestionNotification:', err.message);
  }
}

/**
 * Send a notification to ALL students EXCEPT the actor (confusion post created).
 * Fire-and-forget: caller should not await this.
 */
export async function sendConfusionPostNotification({ actor, examId, examName, postId }) {
  if (!actor?.id) return;
  try {
    const allStudents = await fetchAllStudents();
    const recipients = allStudents.filter((s) => s.id !== actor.id);
    if (!recipients.length) return;

    const title = `${actor.name} posted a confusion about ${examName || 'an exam'}`;

    if (!isSupabaseConfigured()) {
      recipients.forEach((s) => {
        const list = readLocal(s.id);
        list.unshift(buildNotif({ userId: s.id, type: 'confusion_post', title, examId, examName, refId: postId, sender: actor }));
        writeLocal(s.id, list);
      });
      window.dispatchEvent(new Event('user_notif_update'));
      return;
    }

    const rows = recipients.map((s) =>
      buildNotif({ userId: s.id, type: 'confusion_post', title, examId, examName, refId: postId, sender: actor })
    );
    await insertMany(rows);
  } catch (err) {
    console.error('[userNotifService] sendConfusionPostNotification:', err.message);
  }
}

/**
 * Send a notification ONLY to the original post's author when someone replies.
 * Does NOT notify if the actor is the same as the post author.
 * Fire-and-forget: caller should not await this.
 */
export async function sendConfusionReplyNotification({ actor, postAuthorId, postAuthorName, examId, examName, postId }) {
  if (!actor?.id) return;
  // Don't notify yourself
  if (actor.id === postAuthorId) return;
  if (!postAuthorId) return;

  try {
    const title = `${actor.name} replied to your confusion in ${examName || 'an exam'}`;

    if (!isSupabaseConfigured()) {
      const list = readLocal(postAuthorId);
      list.unshift(buildNotif({ userId: postAuthorId, type: 'confusion_reply', title, examId, examName, refId: postId, sender: actor }));
      writeLocal(postAuthorId, list);
      window.dispatchEvent(new Event('user_notif_update'));
      return;
    }

    const row = buildNotif({ userId: postAuthorId, type: 'confusion_reply', title, examId, examName, refId: postId, sender: actor });
    await insertMany([row]);
  } catch (err) {
    console.error('[userNotifService] sendConfusionReplyNotification:', err.message);
  }
}

// ── Public: dismiss ───────────────────────────────────────────────────────────

/**
 * Permanently delete a notification by id (the user pressed ✕).
 */
export async function dismissNotification(notifId, userId) {
  if (!isSupabaseConfigured()) {
    if (!userId) return;
    const list = readLocal(userId).filter((n) => n.id !== notifId);
    writeLocal(userId, list);
    window.dispatchEvent(new Event('user_notif_update'));
    return;
  }
  try {
    const { error } = await supabase
      .from('user_notifications')
      .delete()
      .eq('id', notifId);
    if (error) console.error('[userNotifService] dismiss error:', error.message);
  } catch (err) {
    console.error('[userNotifService] dismiss threw:', err.message);
  }
}

/**
 * Get count of unread notifications for a user.
 */
export async function fetchUnreadCount(userId) {
  if (!userId) return 0;
  try {
    const list = await fetchMyNotifications(userId);
    return list.filter((n) => !n.read).length;
  } catch {
    return 0;
  }
}

/**
 * Mark all notifications as read for a user (called when opening Notification tab).
 */
export async function markAllAsRead(userId) {
  if (!userId) return;

  // 1. Update local storage first for instant UI response
  const localList = readLocal(userId);
  const updatedLocal = localList.map((n) => ({ ...n, read: true }));
  writeLocal(userId, updatedLocal);
  window.dispatchEvent(new Event('user_notif_update'));

  // 2. Update Supabase table if configured
  if (isSupabaseConfigured()) {
    try {
      const { error } = await supabase
        .from('user_notifications')
        .update({ read: true })
        .eq('user_id', userId)
        .eq('read', false);
      if (error) console.error('[userNotifService] markAllAsRead error:', error.message);
    } catch (err) {
      console.error('[userNotifService] markAllAsRead threw:', err.message);
    }
  }
}


/**
 * Delete ALL notifications whose ref_id matches (used when content is deleted).
 * - Suggestion deleted  → pass the suggestion id
 * - Confusion post deleted → pass the post id
 *
 * Uses a SECURITY DEFINER RPC to bypass per-user RLS and clean across all recipients.
 * Fire-and-forget: callers should not await unless they need confirmation.
 */
export async function deleteNotificationsByRef(refId) {
  if (!refId) return;

  if (!isSupabaseConfigured()) {
    // Local-storage fallback: remove from every known user key
    const keys = Object.keys(localStorage).filter((k) => k.startsWith('bahattor_user_notifs_'));
    keys.forEach((key) => {
      try {
        const list = JSON.parse(localStorage.getItem(key) || '[]');
        const filtered = list.filter((n) => n.ref_id !== refId);
        if (filtered.length !== list.length) {
          localStorage.setItem(key, JSON.stringify(filtered));
        }
      } catch { /* skip */ }
    });
    window.dispatchEvent(new Event('user_notif_update'));
    return;
  }

  try {
    const { error } = await supabase.rpc('delete_notifications_by_ref', { p_ref_id: refId });
    if (error) console.error('[userNotifService] deleteNotificationsByRef RPC error:', error.message);
  } catch (err) {
    console.error('[userNotifService] deleteNotificationsByRef threw:', err.message);
  }
}


// ── Public: realtime subscription ────────────────────────────────────────────

/**
 * Subscribe to realtime changes on the current user's notifications.
 * Returns an unsubscribe function.
 */
export function subscribeToMyNotifications(userId, onChange) {
  // Always listen to the localStorage event (covers fallback + same-device updates)
  const localHandler = (e) => onChange(e?.detail);
  window.addEventListener('user_notif_update', localHandler);

  if (!isSupabaseConfigured() || !userId) {
    return () => window.removeEventListener('user_notif_update', localHandler);
  }

  let channel = null;
  try {
    channel = supabase
      .channel(`user_notifs_${userId}`)
      .on('postgres_changes', {
        event: 'INSERT',
        schema: 'public',
        table: 'user_notifications',
        filter: `user_id=eq.${userId}`,
      }, (payload) => onChange(payload.new))
      .on('postgres_changes', {
        event: '*',
        schema: 'public',
        table: 'user_notifications',
        filter: `user_id=eq.${userId}`,
      }, () => onChange())
      .subscribe();
  } catch {
    // Supabase realtime not available — localStorage event handler still active
  }

  return () => {
    window.removeEventListener('user_notif_update', localHandler);
    if (channel) {
      try { supabase.removeChannel(channel); } catch { /* ignore */ }
    }
  };
}
