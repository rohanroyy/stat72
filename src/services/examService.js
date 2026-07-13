import { supabase, isSupabaseConfigured } from '../lib/supabase';

const STORAGE_KEY = 'studydock_exams';

function rowToExam(row) {
  return {
    id: row.id,
    subject: row.subject,
    date: row.date,
    time: row.time || '',
    duration: row.duration || '',
    room: row.room || '',
    notes: row.notes || '',
  };
}

function examToRow(exam) {
  return {
    id: exam.id,
    subject: exam.subject,
    date: exam.date,
    time: exam.time || '',
    duration: exam.duration || '',
    room: exam.room || '',
    notes: exam.notes || '',
    updated_at: new Date().toISOString(),
  };
}

function sortExams(exams) {
  return [...exams].sort((a, b) => new Date(a.date) - new Date(b.date));
}

function readLocalExams() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? sortExams(parsed) : [];
  } catch {
    return [];
  }
}

function writeLocalExams(exams) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(exams));
}

export function getExams() {
  return readLocalExams();
}

export async function fetchExams() {
  if (!isSupabaseConfigured()) return readLocalExams();

  const { data, error } = await supabase
    .from('exams')
    .select('*')
    .order('date', { ascending: true });

  if (error) throw error;
  const exams = sortExams((data || []).map(rowToExam));
  writeLocalExams(exams);
  return exams;
}

export async function saveExam(exam) {
  const id = exam.id || `exam_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`;
  const payload = { ...exam, id };

  if (!isSupabaseConfigured()) {
    const exams = readLocalExams();
    const idx = exams.findIndex((e) => e.id === id);
    if (idx !== -1) exams[idx] = { ...exams[idx], ...payload };
    else exams.push(payload);
    writeLocalExams(exams);
    return sortExams(exams);
  }

  const { error } = await supabase.from('exams').upsert(examToRow(payload), { onConflict: 'id' });
  if (error) throw error;

  return fetchExams();
}

export async function deleteExam(id) {
  if (!isSupabaseConfigured()) {
    const exams = readLocalExams().filter((e) => e.id !== id);
    writeLocalExams(exams);
    return exams;
  }

  const { error } = await supabase.from('exams').delete().eq('id', id);
  if (error) throw error;

  return fetchExams();
}

export function getExamsForDate(dateStr, exams = readLocalExams()) {
  return exams.filter((e) => e.date === dateStr);
}

export function getExamDates(exams = readLocalExams()) {
  return new Set(exams.map((e) => e.date));
}

export async function migrateExamsFromLocalStorage() {
  if (!isSupabaseConfigured()) return;

  const { count, error: countError } = await supabase
    .from('exams')
    .select('*', { count: 'exact', head: true });

  if (countError) throw countError;
  if (count > 0) return;

  const local = readLocalExams();
  if (!local.length) return;

  const rows = local.map(examToRow);
  const { error } = await supabase.from('exams').insert(rows);
  if (error) throw error;
}

export function subscribeToExams(onChange) {
  if (!isSupabaseConfigured()) return () => {};

  const channel = supabase
    .channel('exams_changes')
    .on('postgres_changes', { event: '*', schema: 'public', table: 'exams' }, () => {
      onChange();
    })
    .subscribe();

  return () => {
    supabase.removeChannel(channel);
  };
}
