/**
 * notificationService.js
 * Handles exam-reminder push notifications for Bahattor.
 *
 * Strategy (no backend server required):
 *  - Request browser Notification permission on first app load.
 *  - On every app launch, check if today's batch was already sent (localStorage flag).
 *  - If current time >= 10:00 AM and not yet sent today → fire immediately.
 *  - If current time < 10:00 AM → schedule a setTimeout to fire at 10:00 AM.
 *  - Notifications cover: 3-day, 2-day, 1-day countdowns + same-day "Today" message.
 */

const NOTIF_DATE_KEY = 'bahattor_notif_last_sent'; // stored as 'YYYY-MM-DD'
const HOUR_TO_FIRE   = 10; // 10:00 AM local time

// ── Helpers ───────────────────────────────────────────────────────────────────

function toLocalDateStr(date) {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, '0');
  const d = String(date.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}

function getDaysLeft(examDateStr) {
  const now = new Date();
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const exam  = new Date(examDateStr + 'T00:00:00');
  return Math.round((exam - today) / (1000 * 60 * 60 * 24));
}

function format12h(timeStr) {
  if (!timeStr) return '';
  const parts = timeStr.split(':');
  let hours = parseInt(parts[0], 10);
  if (isNaN(hours)) return '';
  const minutes = parts[1] ? parts[1].slice(0, 2) : '00';
  const ampm = hours >= 12 ? 'PM' : 'AM';
  hours = hours % 12 || 12;
  return ` • ${hours}:${minutes} ${ampm}`;
}

function parseSubject(exam) {
  const full = (exam.subject || '').trim();
  if (full.includes(':')) {
    const idx = full.indexOf(':');
    return { code: full.slice(0, idx).trim(), name: full.slice(idx + 1).trim() };
  }
  if (full.includes(' - ')) {
    const idx = full.indexOf(' - ');
    return { code: full.slice(0, idx).trim(), name: full.slice(idx + 3).trim() };
  }
  const match = full.match(/^([A-Z]{2,6}\s*(?:H-?)?\d+[A-Z]?)\s+(.+)$/i);
  if (match) return { code: match[1].trim(), name: match[2].trim() };
  return { code: 'EXAM', name: full };
}

// ── Show a single notification ────────────────────────────────────────────────

async function showNotification(title, body, tag) {
  if (Notification.permission !== 'granted') return;

  const options = {
    body,
    tag,
    icon: '/pwa-192x192.png',
    badge: '/favicon.png',
    requireInteraction: false,
    data: { url: '/' },
  };

  // Prefer SW notification — stays visible even when the tab is in background
  if ('serviceWorker' in navigator) {
    try {
      const reg = await navigator.serviceWorker.ready;
      await reg.showNotification(title, options);
      return;
    } catch (_) { /* fall through */ }
  }

  // Fallback: plain Notification API
  new Notification(title, options);
}

// ── Build and fire all due reminders ─────────────────────────────────────────

async function fireExamReminders(exams) {
  if (!exams || exams.length === 0) return;

  let fired = 0;
  const todayStr = toLocalDateStr(new Date());

  for (const exam of exams) {
    const days   = getDaysLeft(exam.date);
    const parsed = parseSubject(exam);
    const timePart = format12h(exam.time);
    const room   = exam.room ? ` • Room ${exam.room}` : '';
    const tag    = `exam-${exam.id || (exam.subject + exam.date)}`;

    let title = null;
    let body  = null;

    if (days === 0) {
      title = `Today: ${parsed.code} exam!`;
      body  = `${parsed.name}${timePart}${room}. Best of luck! 🎓`;
    } else if (days === 1) {
      title = `${parsed.code} exam tomorrow!`;
      body  = `${parsed.name}${timePart}${room}. 1 day left — you got this! 💪`;
    } else if (days === 2) {
      title = `${parsed.code} exam in 2 days`;
      body  = `${parsed.name}${timePart}${room}. Stay focused! 📚`;
    } else if (days === 3) {
      title = `${parsed.code} exam in 3 days`;
      body  = `${parsed.name}${timePart}${room}. Time to start preparing! 📖`;
    }

    if (title) {
      await showNotification(title, body, tag);
      fired++;
    }
  }

  if (fired > 0) {
    localStorage.setItem(NOTIF_DATE_KEY, todayStr);
  }
}

// ── Schedule or fire immediately ─────────────────────────────────────────────

let _scheduledTimer = null;

function scheduleOrFireNow(exams) {
  const now      = new Date();
  const todayStr = toLocalDateStr(now);
  const lastSent = localStorage.getItem(NOTIF_DATE_KEY);

  // Already sent today
  if (lastSent === todayStr) return;

  const currentHour   = now.getHours();
  const currentMinute = now.getMinutes();
  const isPast10AM    = currentHour > HOUR_TO_FIRE || (currentHour === HOUR_TO_FIRE && currentMinute >= 0);

  if (isPast10AM) {
    // Fire right now (app was opened after 10 AM, notifications not yet sent today)
    fireExamReminders(exams);
  } else {
    // Schedule for 10:00:00 AM today
    if (_scheduledTimer) clearTimeout(_scheduledTimer);

    const fire10AM = new Date(
      now.getFullYear(), now.getMonth(), now.getDate(),
      HOUR_TO_FIRE, 0, 0, 0
    );
    const msUntil10 = fire10AM - now;

    _scheduledTimer = setTimeout(() => {
      fireExamReminders(exams);
    }, msUntil10);
  }
}

// ── Send exam list to the service worker for storage ─────────────────────────

function syncExamsToSW(exams) {
  if (!('serviceWorker' in navigator)) return;
  navigator.serviceWorker.ready.then((reg) => {
    if (reg.active) {
      reg.active.postMessage({ type: 'STORE_EXAMS', exams });
    }
  }).catch(() => {});
}

// ── Public API ────────────────────────────────────────────────────────────────

/**
 * Request notification permission from the browser.
 * Returns 'granted' | 'denied' | 'default' | 'unsupported'
 */
export async function requestNotificationPermission() {
  if (!('Notification' in window)) return 'unsupported';
  if (Notification.permission === 'granted') return 'granted';
  if (Notification.permission === 'denied') return 'denied';
  try {
    const result = await Notification.requestPermission();
    return result;
  } catch (_) {
    return 'denied';
  }
}

/**
 * Call this once after the app boots and exams are loaded.
 * Requests permission if not yet decided, then schedules/fires reminders.
 */
export async function initExamNotifications(exams = []) {
  if (!('Notification' in window)) return;

  let perm = Notification.permission;

  // Ask for permission if not yet decided
  if (perm === 'default') {
    perm = await requestNotificationPermission();
  }

  if (perm !== 'granted') return;

  // Only care about exams 0–3 days away
  const relevant = exams.filter((e) => {
    const d = getDaysLeft(e.date);
    return d >= 0 && d <= 3;
  });

  syncExamsToSW(relevant);
  scheduleOrFireNow(relevant);
}

/**
 * Call whenever the exams list is updated (e.g. admin adds a new exam).
 * Re-evaluates the schedule without re-asking for permission.
 */
export function updateExamNotifications(exams = []) {
  if (!('Notification' in window)) return;
  if (Notification.permission !== 'granted') return;

  if (_scheduledTimer) clearTimeout(_scheduledTimer);

  const relevant = exams.filter((e) => {
    const d = getDaysLeft(e.date);
    return d >= 0 && d <= 3;
  });

  syncExamsToSW(relevant);
  scheduleOrFireNow(relevant);
}

/**
 * Show a device push notification for a user-activity event
 * (suggestion added, confusion posted, confusion replied, etc.).
 * Clicking the OS notification opens `actionUrl` as a deep-link.
 *
 * @param {string} title      - e.g. "Rahim added a suggestion"
 * @param {string} body       - e.g. "Math Final Exam"
 * @param {string} actionUrl  - e.g. "/?tab=calendar&e=...&s=..."
 */
export async function showUserActivityNotification(title, body, actionUrl) {
  if (!('Notification' in window)) return;
  if (Notification.permission !== 'granted') return;

  const tag = `activity_${Date.now()}`;
  const options = {
    body:              body || '',
    tag,
    icon:              '/pwa-192x192.png',
    badge:             '/favicon.png',
    requireInteraction: false,
    data:              { url: actionUrl || '/' },
  };

  if ('serviceWorker' in navigator) {
    try {
      const reg = await navigator.serviceWorker.ready;
      await reg.showNotification(title, options);
      return;
    } catch (_) { /* fall through */ }
  }

  // Fallback: plain Notification API (no click-to-navigate on iOS Safari)
  const n = new Notification(title, options);
  n.onclick = () => {
    window.focus();
    if (actionUrl) window.location.href = actionUrl;
  };
}
