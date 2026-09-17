/**
 * crService.js
 * All data operations for the CR (Class Representative) panel.
 * Storage: Supabase app_settings table (JSONB), with localStorage fallback.
 *
 * Keys used in app_settings:
 *  - cr_ids            : string[]  — UUIDs of designated CRs (set by admin)
 *  - cr_announcements  : Announcement[] — posted by CR, shown in notification feed
 *  - cr_holidays       : Holiday[]      — holiday entries
 *  - cr_today_override : TodayOverride  — today's schedule override (expires by date)
 *  - cr_week_override  : WeekOverride   — per-day overrides (expires after 7 days or manual reset)
 */

import { supabase, isSupabaseConfigured } from '../lib/supabase';
import { fetchSetting, saveSetting } from './settingsService';
import { fetchAllStudents } from './broadcastService';
import { DEFAULT_ROUTINE, sortRoutine } from './routineService';

// ── Helpers ───────────────────────────────────────────────────────────────────

function makeId(prefix = 'cr') {
  return `${prefix}_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`;
}

function getTodayStr() {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

const WEEK_OVERRIDE_TTL_MS = 7 * 24 * 60 * 60 * 1000; // 7 days

// ── Local-storage fallback helpers ────────────────────────────────────────────

function readLocal(key) {
  try { return JSON.parse(localStorage.getItem(`bahattor_${key}`) || 'null'); } catch { return null; }
}
function writeLocal(key, value) {
  try { localStorage.setItem(`bahattor_${key}`, JSON.stringify(value)); } catch { /* quota */ }
}
function removeLocal(key) {
  try { localStorage.removeItem(`bahattor_${key}`); } catch { /* ignore */ }
}

async function get(key) {
  if (isSupabaseConfigured()) {
    try { return await fetchSetting(key); } catch { return readLocal(key); }
  }
  return readLocal(key);
}

async function set(key, value) {
  writeLocal(key, value);
  if (isSupabaseConfigured()) {
    try { await saveSetting(key, value); } catch (e) { console.error('[crService] set error:', e); }
  }
}

async function remove(key) {
  removeLocal(key);
  if (isSupabaseConfigured()) {
    try { await saveSetting(key, null); } catch (e) { console.error('[crService] remove error:', e); }
  }
}

// ── Holiday Date Helpers ──────────────────────────────────────────────────────

/**
 * Returns true if the given YYYY-MM-DD string falls on any holiday
 * (single-day or within a range).
 */
export function isDateHoliday(dateStr, holidays = []) {
  if (!dateStr || !holidays.length) return false;
  return holidays.some(h => {
    if (!h.date) return false;
    if (h.isRange && h.endDate) {
      return dateStr >= h.date && dateStr <= h.endDate;
    }
    return dateStr === h.date;
  });
}

/**
 * Returns the first holiday entry that covers the given YYYY-MM-DD string,
 * or null if not a holiday.
 */
export function getHolidayForDate(dateStr, holidays = []) {
  if (!dateStr || !holidays.length) return null;
  return holidays.find(h => {
    if (!h.date) return false;
    if (h.isRange && h.endDate) {
      return dateStr >= h.date && dateStr <= h.endDate;
    }
    return dateStr === h.date;
  }) || null;
}

// ── CR IDs ────────────────────────────────────────────────────────────────────

/** Fetch array of CR student UUIDs. */
export async function fetchCRIds() {
  const data = await get('cr_ids');
  return Array.isArray(data) ? data : [];
}

/** Admin saves the full list of CR student UUIDs. */
export async function saveCRIds(ids) {
  await set('cr_ids', ids);
  return ids;
}

/** Check if a student ID is a CR. */
export function isCRUser(crIds, userId) {
  return Array.isArray(crIds) && !!userId && crIds.includes(userId);
}

// ── CR Announcements ──────────────────────────────────────────────────────────

/**
 * Fetch all CR announcements (newest first).
 */
export async function fetchCRAnnouncements() {
  const data = await get('cr_announcements');
  return Array.isArray(data) ? data : [];
}

/**
 * Post a new CR announcement. Also inserts into user_notifications for all students
 * so it shows as an in-app notification.
 */
export async function postCRAnnouncement({ title, body, crStudent }) {
  if (!title?.trim()) throw new Error('Title is required');

  const announcement = {
    id: makeId('ann'),
    title: title.trim(),
    body: (body || '').trim(),
    source: 'cr',
    cr_id: crStudent?.id || null,
    cr_name: crStudent?.name || 'CR',
    created_at: new Date().toISOString(),
  };

  const current = await fetchCRAnnouncements();
  const updated = [announcement, ...current].slice(0, 30);
  await set('cr_announcements', updated);

  // Notify all students via user_notifications
  try {
    await _notifyAllStudents({
      title: `📢 ${announcement.cr_name}: ${announcement.title}`,
      body: announcement.body || undefined,
      type: 'cr_announcement',
      refId: announcement.id,
    });
  } catch (e) {
    console.warn('[crService] notification delivery failed:', e);
  }

  return updated;
}

/** Delete a CR announcement by id. */
export async function deleteCRAnnouncement(id) {
  const current = await fetchCRAnnouncements();
  const updated = current.filter(a => a.id !== id);
  await set('cr_announcements', updated);
  return updated;
}

// ── Holidays ──────────────────────────────────────────────────────────────────

/** Fetch all holidays, sorted by date. */
export async function fetchHolidays() {
  const data = await get('cr_holidays');
  const list = Array.isArray(data) ? data : [];
  return list.sort((a, b) => (a.date || '').localeCompare(b.date || ''));
}

/** Add a new holiday entry. Supports single-day and vacation ranges. */
export async function addHoliday({ date, endDate, label, note, isRange }) {
  if (!date || !label?.trim()) throw new Error('Date and label are required');
  const holiday = {
    id: makeId('hol'),
    date,
    endDate: isRange ? (endDate || date) : date,
    isRange: !!isRange,
    label: label.trim(),
    note: (note || '').trim(),
    created_at: new Date().toISOString(),
  };
  const current = await fetchHolidays();
  const updated = [...current.filter(h => h.id !== holiday.id), holiday]
    .sort((a, b) => (a.date || '').localeCompare(b.date || ''));
  await set('cr_holidays', updated);
  return updated;
}

/** Update an existing holiday. Supports single-day and vacation ranges. */
export async function updateHoliday(id, { date, endDate, label, note, isRange }) {
  const current = await fetchHolidays();
  const updated = current.map(h =>
    h.id === id
      ? { ...h, date, endDate: isRange ? (endDate || date) : date, isRange: !!isRange, label: label.trim(), note: (note || '').trim() }
      : h
  ).sort((a, b) => (a.date || '').localeCompare(b.date || ''));
  await set('cr_holidays', updated);
  return updated;
}

/** Delete a holiday by id. */
export async function deleteHoliday(id) {
  const current = await fetchHolidays();
  const updated = current.filter(h => h.id !== id);
  await set('cr_holidays', updated);
  return updated;
}

// ── Today's Schedule Override ─────────────────────────────────────────────────

/**
 * Fetch today's override. Returns null if none or if date is stale (auto-cleanup).
 */
export async function fetchTodayOverride() {
  const data = await get('cr_today_override');
  if (!data) return null;
  if (data.date !== getTodayStr()) {
    // Stale: silently remove
    await remove('cr_today_override');
    return null;
  }
  return data;
}

/**
 * Save today's schedule override. `slots` is an array of routine-shaped objects
 * (same shape as routineService items) for today's day.
 * Notifies all students of the change.
 */
export async function saveTodayOverride(slots, dayName, crStudent) {
  const override = {
    date: getTodayStr(),
    day: dayName,
    slots: slots || [],
    saved_at: new Date().toISOString(),
    cr_id: crStudent?.id || null,
    cr_name: crStudent?.name || 'CR',
  };
  await set('cr_today_override', override);

  // Notify all students
  try {
    await _notifyAllStudents({
      title: `📅 Schedule change for today (${dayName})`,
      body: `${crStudent?.name || 'CR'} updated today's class schedule. Check the routine tab.`,
      type: 'cr_schedule',
      refId: `today_${override.date}`,
    });
  } catch (e) {
    console.warn('[crService] today override notification failed:', e);
  }

  return override;
}

/** Clear today's override. */
export async function clearTodayOverride() {
  await remove('cr_today_override');
}

// ── Week Schedule Override ────────────────────────────────────────────────────

/**
 * Fetch week override. Returns null if expired (7 days) or missing.
 * Format: { created_at: ISO, days: { 'Sunday': [...slots], 'Monday': [...slots] } }
 */
export async function fetchWeekOverride() {
  const data = await get('cr_week_override');
  if (!data) return null;

  // Auto-expire after 7 days
  const age = Date.now() - new Date(data.created_at || 0).getTime();
  if (age > WEEK_OVERRIDE_TTL_MS) {
    await remove('cr_week_override');
    return null;
  }
  return data;
}

/**
 * Save a full week override.
 * `dayOverrides` is an object: { 'Sunday': [...slots], 'Monday': [...slots] }
 * Only the days that differ from default need to be included.
 */
export async function saveWeekOverride(dayOverrides, crStudent) {
  const override = {
    created_at: new Date().toISOString(),
    days: dayOverrides,
    cr_id: crStudent?.id || null,
    cr_name: crStudent?.name || 'CR',
  };
  await set('cr_week_override', override);

  // Notify all students
  try {
    await _notifyAllStudents({
      title: `📆 Weekly schedule updated`,
      body: `${crStudent?.name || 'CR'} made changes to this week's class schedule. Check the routine tab.`,
      type: 'cr_schedule',
      refId: `week_${override.created_at}`,
    });
  } catch (e) {
    console.warn('[crService] week override notification failed:', e);
  }

  return override;
}

/** Reset week override to default (clears the override, restoring class_routine). */
export async function resetWeekOverride() {
  await remove('cr_week_override');
}

/** Returns true if week override is older than TTL. */
export function isWeekOverrideExpired(override) {
  if (!override?.created_at) return true;
  return Date.now() - new Date(override.created_at).getTime() > WEEK_OVERRIDE_TTL_MS;
}

/** Returns number of days remaining before week override expires. */
export function weekOverrideDaysLeft(override) {
  if (!override?.created_at) return 0;
  const age = Date.now() - new Date(override.created_at).getTime();
  const left = WEEK_OVERRIDE_TTL_MS - age;
  return Math.max(0, Math.ceil(left / (24 * 60 * 60 * 1000)));
}

// ── Routine Merging ───────────────────────────────────────────────────────────

/**
 * Merge base routine with CR overrides.
 * - Week override: replaces entire day's slots for any overridden days.
 * - Today override: replaces today's entire day with override slots.
 * Returns a sorted merged routine list (same shape as routineService items).
 */
export function mergeRoutineWithOverrides(baseRoutine, weekOverride, todayOverride) {
  let result = [...(baseRoutine || DEFAULT_ROUTINE)];

  // Apply week override (per-day replacement)
  if (weekOverride && !isWeekOverrideExpired(weekOverride) && weekOverride.days) {
    Object.entries(weekOverride.days).forEach(([day, slots]) => {
      // Remove all existing slots for this day
      result = result.filter(r => r.day !== day);
      // Add the override slots for this day
      if (Array.isArray(slots)) {
        result.push(...slots);
      }
    });
  }

  // Apply today override (overrides today completely)
  const todayStr = getTodayStr();
  if (todayOverride && todayOverride.date === todayStr && todayOverride.day) {
    result = result.filter(r => r.day !== todayOverride.day);
    if (Array.isArray(todayOverride.slots)) {
      result.push(...todayOverride.slots);
    }
  }

  return sortRoutine(result);
}

// ── Internal: notify all students ─────────────────────────────────────────────

async function _notifyAllStudents({ title, body, type, refId }) {
  if (!isSupabaseConfigured()) return;

  try {
    const allStudents = await fetchAllStudents();
    if (!allStudents.length) return;

    function makeId2() {
      return `un_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
    }

    const rows = allStudents.map(s => ({
      id: makeId2(),
      user_id: s.id,
      type,
      title,
      body: body || null,
      exam_id: null,
      exam_name: null,
      ref_id: refId || null,
      action_url: '/?tab=announcement',
      sender_id: null,
      sender_name: null,
      sender_photo: null,
      read: false,
      created_at: new Date().toISOString(),
    }));

    const { error } = await supabase.from('user_notifications').insert(rows);
    if (error) console.error('[crService] notify insert error:', error.message);
  } catch (err) {
    console.error('[crService] _notifyAllStudents error:', err.message);
  }
}
