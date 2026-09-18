/**
 * ratingService.js
 *
 * Handles class rating persistence and aggregation.
 *
 * Table: class_ratings
 *   id          TEXT PRIMARY KEY — "rating_{student_id}_{subject}_{date}"
 *   student_id  TEXT
 *   subject     TEXT — "H 401"
 *   teacher     TEXT — "BH"
 *   date        TEXT — "YYYY-MM-DD"
 *   rating      INT  — 1–5
 *   created_at  TIMESTAMPTZ
 */

import { supabase, isSupabaseConfigured } from '../lib/supabase';

const TABLE = 'class_ratings';

// Normalise subject codes to a stable key: "H 401" == "H-401" == "h401"
export function normaliseSubject(code = '') {
  return code.replace(/[\s-]/g, '').toLowerCase();
}

function getTodayStr() {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

function makeRatingId(studentId, subject, date) {
  const safe = (s) => String(s).replace(/[^a-zA-Z0-9]/g, '_');
  return `rating_${safe(studentId)}_${safe(subject)}_${safe(date)}`;
}

// ── Write ─────────────────────────────────────────────────────────────────────

/**
 * Submit or update a rating for a class (upsert on unique constraint).
 *
 * @param {Object} params
 * @param {string} params.studentId
 * @param {string} params.subject    — "H 401"
 * @param {string} params.teacher    — "BH"
 * @param {string} [params.date]     — defaults to today "YYYY-MM-DD"
 * @param {number} params.rating     — 1–5
 */
export async function submitRating({ studentId, subject, teacher, date, rating }) {
  if (!studentId) throw new Error('studentId required');
  if (!subject) throw new Error('subject required');
  if (!rating || rating < 1 || rating > 5) throw new Error('rating must be 1–5');

  const ratingDate = date || getTodayStr();
  const id = makeRatingId(studentId, subject, ratingDate);

  const payload = {
    id,
    student_id: studentId,
    subject,
    teacher: teacher || '',
    date: ratingDate,
    rating,
    created_at: new Date().toISOString(),
  };

  if (!isSupabaseConfigured()) {
    // Fallback: store locally for offline / unconfigured envs
    try {
      const raw = localStorage.getItem('bahattor_class_ratings') || '{}';
      const local = JSON.parse(raw);
      local[id] = payload;
      localStorage.setItem('bahattor_class_ratings', JSON.stringify(local));
    } catch (_) {}
    return;
  }

  const { error } = await supabase
    .from(TABLE)
    .upsert(payload, { onConflict: 'student_id,subject,date' });

  if (error) throw new Error(error.message);
}

// ── Read ──────────────────────────────────────────────────────────────────────

/**
 * Fetch all ratings the student has submitted today.
 * Returns an array of rating objects: { subject, rating, teacher, date }
 *
 * @param {string} studentId
 * @returns {Promise<Array>}
 */
export async function fetchTodayRatings(studentId) {
  if (!studentId) return [];
  const today = getTodayStr();

  if (!isSupabaseConfigured()) {
    try {
      const raw = localStorage.getItem('bahattor_class_ratings') || '{}';
      const local = JSON.parse(raw);
      return Object.values(local).filter(
        (r) => r.student_id === studentId && r.date === today
      );
    } catch {
      return [];
    }
  }

  const { data, error } = await supabase
    .from(TABLE)
    .select('subject, teacher, rating, date')
    .eq('student_id', studentId)
    .eq('date', today);

  if (error) {
    console.error('[ratingService] fetchTodayRatings:', error.message);
    return [];
  }
  return data || [];
}

/**
 * Fetch every rating row (for global aggregation).
 * Returns array of { subject, teacher, rating }.
 *
 * @returns {Promise<Array>}
 */
export async function fetchAllRatings() {
  if (!isSupabaseConfigured()) {
    try {
      const raw = localStorage.getItem('bahattor_class_ratings') || '{}';
      return Object.values(JSON.parse(raw));
    } catch {
      return [];
    }
  }

  const { data, error } = await supabase
    .from(TABLE)
    .select('subject, teacher, rating');

  if (error) {
    console.error('[ratingService] fetchAllRatings:', error.message);
    return [];
  }
  return data || [];
}

/**
 * Compute per-teacher (per-subject) average ratings from all stored ratings.
 *
 * Returns a map keyed by subject code (normalised):
 * {
 *   'h401': { subject: 'H 401', teacher: 'BH', avg: 4.2, count: 14 },
 *   ...
 * }
 *
 * @returns {Promise<Object>}
 */
export async function getTeacherAverageRatings() {
  const all = await fetchAllRatings();

  const acc = {}; // key → { subject, teacher, sum, count }

  for (const row of all) {
    if (!row.subject || !row.rating) continue;
    const key = normaliseSubject(row.subject);
    if (!acc[key]) {
      acc[key] = { subject: row.subject, teacher: row.teacher || '', sum: 0, count: 0 };
    }
    acc[key].sum += Number(row.rating);
    acc[key].count += 1;
  }

  const result = {};
  for (const [key, val] of Object.entries(acc)) {
    result[key] = {
      subject: val.subject,
      teacher: val.teacher,
      avg: val.count > 0 ? Math.round((val.sum / val.count) * 10) / 10 : 0,
      count: val.count,
    };
  }

  return result;
}

/**
 * Subscribe to realtime changes on class_ratings.
 * Returns an unsubscribe function.
 *
 * @param {Function} callback
 * @returns {Function}
 */
export function subscribeToRatings(callback) {
  if (!isSupabaseConfigured() || !supabase) return () => {};

  const channel = supabase
    .channel('class_ratings_realtime')
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
