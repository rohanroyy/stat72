/**
 * Exam Schedule Service
 * Manages exam data in localStorage.
 */

const STORAGE_KEY = 'studydock_exams';

/**
 * Returns all saved exams as an array, sorted by date.
 */
export function getExams() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];
    return parsed.sort((a, b) => new Date(a.date) - new Date(b.date));
  } catch {
    return [];
  }
}

/**
 * Save all exams array at once.
 */
export function saveAllExams(exams) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(exams));
}

/**
 * Add or update an exam. If exam.id exists, update; otherwise insert with generated id.
 * @param {Object} exam - { id?, subject, date (YYYY-MM-DD), time, duration, room, notes }
 */
export function saveExam(exam) {
  const exams = getExams();
  if (exam.id) {
    const idx = exams.findIndex(e => e.id === exam.id);
    if (idx !== -1) {
      exams[idx] = { ...exams[idx], ...exam };
    } else {
      exams.push(exam);
    }
  } else {
    exams.push({
      ...exam,
      id: `exam_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`,
    });
  }
  saveAllExams(exams);
  return getExams();
}

/**
 * Delete an exam by id.
 */
export function deleteExam(id) {
  const exams = getExams().filter(e => e.id !== id);
  saveAllExams(exams);
  return exams;
}

/**
 * Get exams for a specific date string (YYYY-MM-DD).
 */
export function getExamsForDate(dateStr) {
  return getExams().filter(e => e.date === dateStr);
}

/**
 * Get all dates that have at least one exam (as a Set of YYYY-MM-DD strings).
 */
export function getExamDates() {
  const dates = getExams().map(e => e.date);
  return new Set(dates);
}
