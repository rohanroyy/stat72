/**
 * classConfirmationService.js
 * Service for CR class attendance confirmations.
 *
 * Table: cr_class_confirmations
 *   id            TEXT  PRIMARY KEY  — "conf_{date}_{subject}_{slotKey}" (safe chars)
 *   date          TEXT  — "YYYY-MM-DD"
 *   subject       TEXT  — "H 401"
 *   slot_key      TEXT  — "11:00-12:50" (startTime-endTime of the full slot group)
 *   start_time    TEXT  — "11:00"
 *   end_time      TEXT  — "12:50"
 *   class_count   INT   — 1 or 2 (double-slot = 2)
 *   confirmed_by  TEXT  — CR student ID
 *   confirmed_by_name TEXT
 *   confirmed_at  TIMESTAMPTZ
 *   is_confirmed  BOOLEAN
 */

import { supabase, isSupabaseConfigured } from '../lib/supabase';

const TABLE = 'cr_class_confirmations';

// ── Helpers ───────────────────────────────────────────────────────────────────

function getTodayStr() {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

function makeConfirmId(date, subject, slotKey) {
  const safe = (s) => String(s).replace(/[^a-zA-Z0-9]/g, '_');
  return `conf_${safe(date)}_${safe(subject)}_${safe(slotKey)}`;
}

// ── Fetch ─────────────────────────────────────────────────────────────────────

/**
 * Fetch all confirmed classes for today.
 * Returns array of confirmation rows.
 */
export async function fetchTodayConfirmations() {
  if (!isSupabaseConfigured()) return [];
  const today = getTodayStr();
  const { data, error } = await supabase
    .from(TABLE)
    .select('*')
    .eq('date', today)
    .eq('is_confirmed', true);
  if (error) {
    console.error('[classConfirmationService] fetchTodayConfirmations:', error.message);
    return [];
  }
  return data || [];
}

/**
 * Fetch all confirmed classes across all dates.
 * Used to compute course-level class count totals.
 */
export async function fetchAllConfirmations() {
  if (!isSupabaseConfigured()) return [];
  const { data, error } = await supabase
    .from(TABLE)
    .select('subject, class_count')
    .eq('is_confirmed', true);
  if (error) {
    console.error('[classConfirmationService] fetchAllConfirmations:', error.message);
    return [];
  }
  return data || [];
}

/**
 * Returns per-course total class count.
 * Example: { 'H 401': 14, 'H 402': 8 }
 */
export async function getCourseClassTotals() {
  const all = await fetchAllConfirmations();
  const totals = {};
  for (const row of all) {
    if (!row.subject) continue;
    totals[row.subject] = (totals[row.subject] || 0) + (row.class_count || 1);
  }
  return totals;
}

// ── Write ─────────────────────────────────────────────────────────────────────

/**
 * Confirm (or update) a class slot.
 * Uses upsert on (date, subject, slot_key) constraint.
 *
 * @param {Object} params
 * @param {string} params.date        - "YYYY-MM-DD"
 * @param {string} params.subject     - "H 401"
 * @param {string} params.slotKey     - "11:00-12:50"
 * @param {string} params.startTime   - "11:00"
 * @param {string} params.endTime     - "12:50"
 * @param {number} params.classCount  - 1 or 2
 * @param {Object} params.crStudent   - { id, name }
 */
export async function confirmClass({ date, subject, slotKey, startTime, endTime, classCount, crStudent }) {
  if (!isSupabaseConfigured()) throw new Error('Supabase not configured');
  if (!crStudent?.id) throw new Error('CR student ID required');

  const id = makeConfirmId(date, subject, slotKey);
  const payload = {
    id,
    date,
    subject,
    slot_key: slotKey,
    start_time: startTime,
    end_time: endTime,
    class_count: classCount || 1,
    confirmed_by: crStudent.id,
    confirmed_by_name: crStudent.name || 'CR',
    confirmed_at: new Date().toISOString(),
    is_confirmed: true,
  };

  const { error } = await supabase
    .from(TABLE)
    .upsert(payload, { onConflict: 'date,subject,slot_key' });

  if (error) throw new Error(error.message);
}

/**
 * Remove confirmation (undo) for a specific class slot.
 *
 * @param {string} date     - "YYYY-MM-DD"
 * @param {string} subject  - "H 401"
 * @param {string} slotKey  - "11:00-12:50"
 */
export async function unconfirmClass(date, subject, slotKey) {
  if (!isSupabaseConfigured()) throw new Error('Supabase not configured');

  const { error } = await supabase
    .from(TABLE)
    .delete()
    .eq('date', date)
    .eq('subject', subject)
    .eq('slot_key', slotKey);

  if (error) throw new Error(error.message);
}

// ── Realtime ──────────────────────────────────────────────────────────────────

/**
 * Subscribe to realtime changes on the confirmations table.
 * Calls `callback` whenever any row is inserted, updated, or deleted.
 * Returns an unsubscribe function.
 */
export function subscribeToConfirmations(callback) {
  if (!isSupabaseConfigured() || !supabase) return () => {};

  const channel = supabase
    .channel('cr_confirmations_realtime')
    .on(
      'postgres_changes',
      { event: '*', schema: 'public', table: TABLE },
      () => { callback(); }
    )
    .subscribe();

  return () => {
    supabase.removeChannel(channel);
  };
}
