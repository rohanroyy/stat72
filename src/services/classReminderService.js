/**
 * classReminderService.js
 *
 * Automatically sends notifications to users the night before (around 10:00 PM)
 * when tomorrow has scheduled classes.
 *
 * Requirements:
 *  - Trigger time: ~10:00 PM (22:00 local time).
 *  - Only fire if tomorrow has 1 or more classes (not a holiday, not a class-free weekend).
 *  - Template chosen randomly per day from 8 predefined Bengali/English templates.
 *  - {count} replaced with tomorrow's total class count.
 *  - {firstClass} replaced with the start time of tomorrow's earliest class (e.g. "10:00 AM").
 *  - Dispatches browser push notification (via Service Worker / Notification API)
 *    and broadcasts to in-app notifications so all users receive it.
 *  - Robust deduplication so users receive at most one reminder per night.
 */

import { DEFAULT_ROUTINE } from './routineService.js';
import { isDateHoliday, isWeekOverrideExpired } from './crService.js';
import { showNotification } from './notificationService.js';
import { sendBroadcastNotification, fetchBroadcastNotifications } from './broadcastService.js';

export const REMINDER_STORAGE_KEY = 'bahattor_class_reminder_last_date'; // stored as 'YYYY-MM-DD'
export const REMINDER_HOUR = 22; // 10:00 PM
export const REMINDER_MINUTE = 0;

// ── 8 Predefined Notification Templates ───────────────────────────────────────
export const CLASS_REMINDER_TEMPLATES = [
  {
    id: 1,
    title: (count) => `আগামীকাল ${count}টা ক্লাস`,
    body: () => `কালকের জন্য প্রস্তুত তো? রুটিনটা একবার দেখে নাও।`,
  },
  {
    id: 2,
    title: () => `Tomorrow's classes`,
    body: (count) => `আগামীকাল ${count}টা ক্লাস আছে। সময়মতো চলে এসো, ৭২!`,
  },
  {
    id: 3,
    title: () => `আগামীকাল ক্লাস আছে!`,
    body: (count) => `মোট ${count}টা ক্লাস, অ্যালার্ম দিয়ে ঘুমাও। 😭`,
  },
  {
    id: 4,
    title: () => `Class reminder`,
    body: (count, firstClass) => `আগামীকাল ${count}টা ক্লাস। প্রথম ক্লাস ${firstClass}-এ, don't be late!`,
  },
  {
    id: 5,
    title: () => `কালকের রুটিন ready`,
    body: (count) => `${count}টা ক্লাস অপেক্ষা করছে। See you in class!`,
  },
  {
    id: 6,
    title: () => `One more day, one more class`,
    body: (count) => `আগামীকাল ${count}টা ক্লাস আছে। Let’s make it count.`,
  },
  {
    id: 7,
    title: () => `ঘুমানোর আগে একটা reminder`,
    body: (count) => `আগামীকাল ${count}টা ক্লাস আছে। অ্যালার্ম দিতে ভুলে যেও না!`,
  },
  {
    id: 8,
    title: () => `Class loading for tomorrow...`,
    body: (count) => `${count}টা ক্লাস scheduled. Ready up, 72!`,
  },
];

// ── Date & Time Helpers ───────────────────────────────────────────────────────

/**
 * Return date information for tomorrow relative to baseDate (default now).
 */
export function getTomorrowInfo(baseDate = new Date()) {
  const tomorrow = new Date(baseDate);
  tomorrow.setDate(tomorrow.getDate() + 1);
  const y = tomorrow.getFullYear();
  const m = String(tomorrow.getMonth() + 1).padStart(2, '0');
  const d = String(tomorrow.getDate()).padStart(2, '0');
  const dateStr = `${y}-${m}-${d}`;
  const dayName = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'][tomorrow.getDay()];
  return { date: tomorrow, dateStr, dayName };
}

/**
 * Formats a raw time string (e.g. "10:00", "8:00", "08:00", "14:00", "2.00")
 * into a clean 12-hour display string (e.g. "10:00 AM", "8:00 AM", "2:00 PM").
 */
export function formatFirstClassTime(timeStr) {
  if (!timeStr) return '';
  const clean = String(timeStr).trim();

  // If already formatted like "10:00 AM"
  if (/am|pm/i.test(clean)) return clean;

  const parts = clean.split(/[:.]/);
  let h = parseInt(parts[0], 10);
  if (isNaN(h)) return clean;
  let m = parts[1] ? parts[1].slice(0, 2).padStart(2, '0') : '00';

  let ampm = 'AM';
  if (h >= 12 && h < 24) {
    ampm = 'PM';
    if (h > 12) h -= 12;
  } else if (h >= 1 && h <= 6) {
    // 1:00 to 6:00 in routine context is PM
    ampm = 'PM';
  } else if (h === 0) {
    h = 12;
    ampm = 'AM';
  }

  return `${h}:${m} ${ampm}`;
}

/**
 * Normalizes subject string for comparison.
 */
function normSubject(code = '') {
  return String(code).replace(/[\s-]/g, '').toLowerCase();
}

/**
 * Calculates tomorrow's classes taking into account:
 *  - Holiday checks (crHolidays)
 *  - Weekly CR overrides (crWeekOverride)
 *  - Routine list (or DEFAULT_ROUTINE fallback)
 *  - Consecutive periods merging (double-slot = 1 unified class session)
 */
export function getTomorrowClasses(routineList = [], weekOverride = null, holidays = [], baseDate = new Date()) {
  const { dateStr, dayName } = getTomorrowInfo(baseDate);

  // 1. Holiday check
  if (isDateHoliday(dateStr, holidays)) {
    return {
      count: 0,
      firstClass: '',
      classes: [],
      isHoliday: true,
      dayName,
      dateStr,
    };
  }

  // 2. Resolve slots for tomorrow's day
  let daySlots = [];
  const hasValidWeekOverride =
    weekOverride &&
    !isWeekOverrideExpired(weekOverride) &&
    weekOverride.days &&
    Array.isArray(weekOverride.days[dayName]);

  if (hasValidWeekOverride) {
    daySlots = weekOverride.days[dayName];
  } else {
    const base = (routineList && routineList.length > 0) ? routineList : DEFAULT_ROUTINE;
    daySlots = base.filter((r) => r.day === dayName);
  }

  // Filter valid class items
  const validSlots = (daySlots || []).filter((s) => s && s.subject && s.subject.trim());
  if (validSlots.length === 0) {
    return {
      count: 0,
      firstClass: '',
      classes: [],
      isHoliday: false,
      dayName,
      dateStr,
    };
  }

  // Sort slots by start time
  const sortedSlots = [...validSlots].sort((a, b) => {
    const timeA = a.startTime || a.start_time || a.timeSlot || '';
    const timeB = b.startTime || b.start_time || b.timeSlot || '';
    return timeA.localeCompare(timeB);
  });

  // Merge consecutive periods of the same class (consistent with RoutinePage & Dashboard)
  const isSameClass = (a, b) => {
    if (!a || !b) return false;
    const sameSub = normSubject(a.subject) === normSubject(b.subject);
    const roomA = String(a.room || '').replace(/^r\.?\s*/i, '').toLowerCase();
    const roomB = String(b.room || '').replace(/^r\.?\s*/i, '').toLowerCase();
    const sameRoom = !roomA || !roomB || roomA === roomB;
    const teachA = String(a.teacher || '').toLowerCase();
    const teachB = String(b.teacher || '').toLowerCase();
    const sameTeach = !teachA || !teachB || teachA === teachB;
    return sameSub && sameRoom && sameTeach;
  };

  const merged = [];
  for (let i = 0; i < sortedSlots.length;) {
    const item = sortedSlots[i];
    let end = i;
    while (end + 1 < sortedSlots.length && isSameClass(item, sortedSlots[end + 1])) {
      end++;
    }
    merged.push({
      ...item,
      periodCount: end - i + 1,
    });
    i = end + 1;
  }

  const count = merged.length;
  if (count === 0) {
    return {
      count: 0,
      firstClass: '',
      classes: [],
      isHoliday: false,
      dayName,
      dateStr,
    };
  }

  // Earliest class start time
  const earliest = sortedSlots[0];
  const rawStartTime = earliest.startTime || earliest.start_time || (earliest.timeSlot ? earliest.timeSlot.split('-')[0] : '');
  const firstClass = formatFirstClassTime(rawStartTime);

  return {
    count,
    firstClass,
    classes: merged,
    isHoliday: false,
    dayName,
    dateStr,
  };
}

/**
 * Deterministically pick a template for a given dateStr.
 * This guarantees all students get the EXACT same randomly-distributed template each night,
 * and different templates on consecutive days.
 */
export function pickReminderMessage(dateStr, count, firstClass) {
  let hash = 0;
  for (let i = 0; i < dateStr.length; i++) {
    hash = (hash * 31 + dateStr.charCodeAt(i)) >>> 0;
  }
  const index = hash % CLASS_REMINDER_TEMPLATES.length;
  const tmpl = CLASS_REMINDER_TEMPLATES[index];

  return {
    templateId: tmpl.id,
    templateIndex: index,
    title: tmpl.title(count, firstClass),
    body: tmpl.body(count, firstClass),
  };
}

// ── Execution & Scheduling ────────────────────────────────────────────────────

let _classReminderTimer = null;
let _periodicChecker = null;

/**
 * Dispatches tomorrow's class reminder if tomorrow has classes.
 * Can be called manually (force = true) for testing.
 */
export async function sendTomorrowClassReminder({
  routineList = [],
  weekOverride = null,
  holidays = [],
  force = false,
  baseDate = new Date(),
} = {}) {
  try {
    const classInfo = getTomorrowClasses(routineList, weekOverride, holidays, baseDate);
    const { count, firstClass, dateStr, isHoliday, dayName } = classInfo;

    // If tomorrow has no classes (holiday, weekend, or empty routine)
    if (count === 0) {
      return {
        sent: false,
        reason: isHoliday ? 'holiday' : 'no_classes',
        dayName,
        dateStr,
      };
    }

    // Pick message template
    const message = pickReminderMessage(dateStr, count, firstClass);
    const notificationTag = `class_reminder_${dateStr}`;

    // 1. Device Push Notification
    const lastSentDate = localStorage.getItem(REMINDER_STORAGE_KEY);
    let devicePushSent = false;

    if (lastSentDate !== dateStr || force) {
      await showNotification(
        message.title,
        message.body,
        notificationTag,
        '/?tab=routine'
      );
      localStorage.setItem(REMINDER_STORAGE_KEY, dateStr);
      devicePushSent = true;
    }

    // 2. Broadcast to all users (stored in broadcast_notifications in Supabase)
    // Custom ID ensures only ONE broadcast row is ever created for this date across all users
    try {
      await sendBroadcastNotification(
        message.title,
        message.body,
        'all',
        notificationTag,
        '/?tab=routine'
      );
    } catch (err) {
      console.warn('[classReminderService] broadcast sync notice:', err.message);
    }

    return {
      sent: true,
      devicePushSent,
      dateStr,
      dayName,
      count,
      firstClass,
      title: message.title,
      body: message.body,
    };
  } catch (error) {
    console.error('[classReminderService] sendTomorrowClassReminder error:', error);
    return { sent: false, error: error.message };
  }
}

/**
 * Evaluates the schedule and sets up a timer or fires immediately if past 10:00 PM.
 */
export function initClassReminderScheduler({
  routineList = [],
  weekOverride = null,
  holidays = [],
} = {}) {
  // Clear any existing timers
  if (_classReminderTimer) {
    clearTimeout(_classReminderTimer);
    _classReminderTimer = null;
  }
  if (_periodicChecker) {
    clearInterval(_periodicChecker);
    _periodicChecker = null;
  }

  const checkAndRun = () => {
    const now = new Date();
    const { dateStr } = getTomorrowInfo(now);
    const lastSent = localStorage.getItem(REMINDER_STORAGE_KEY);

    const currentHour = now.getHours();
    const currentMinute = now.getMinutes();

    // Night window: 10:00 PM (22:00) to 11:59:59 PM (23:59)
    const isNightWindow = currentHour >= REMINDER_HOUR;

    if (isNightWindow) {
      if (lastSent !== dateStr) {
        sendTomorrowClassReminder({ routineList, weekOverride, holidays });
      }
    } else {
      // It is before 10:00 PM today. Schedule timer for 10:00:00 PM tonight.
      const targetTime = new Date(
        now.getFullYear(),
        now.getMonth(),
        now.getDate(),
        REMINDER_HOUR,
        REMINDER_MINUTE,
        0,
        0
      );
      const msUntil10PM = targetTime.getTime() - now.getTime();

      if (msUntil10PM > 0 && msUntil10PM <= 24 * 60 * 60 * 1000) {
        if (_classReminderTimer) clearTimeout(_classReminderTimer);
        _classReminderTimer = setTimeout(() => {
          sendTomorrowClassReminder({ routineList, weekOverride, holidays });
        }, msUntil10PM);
      }
    }
  };

  // Run initial check
  checkAndRun();

  // Also maintain a periodic heartbeat every 20 minutes to guard against
  // laptop/mobile sleep, tab suspension, or time changes.
  _periodicChecker = setInterval(checkAndRun, 20 * 60 * 1000);
}

/**
 * Clears active timers (useful on unmount).
 */
export function clearClassReminderScheduler() {
  if (_classReminderTimer) {
    clearTimeout(_classReminderTimer);
    _classReminderTimer = null;
  }
  if (_periodicChecker) {
    clearInterval(_periodicChecker);
    _periodicChecker = null;
  }
}
