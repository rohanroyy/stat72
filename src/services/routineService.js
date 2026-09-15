import { supabase, isSupabaseConfigured } from '../lib/supabase';

const STORAGE_KEY = 'studydock_routine';

export const TIME_SLOTS = [
  { id: 'slot-1', label: '8:00 - 8:50', start: '08:00', end: '08:50' },
  { id: 'slot-2', label: '9:00 - 9:50', start: '09:00', end: '09:50' },
  { id: 'slot-3', label: '10:00 - 10:50', start: '10:00', end: '10:50' },
  { id: 'slot-4', label: '11:00 - 11:50', start: '11:00', end: '11:50' },
  { id: 'slot-5', label: '12:00 - 12:50', start: '12:00', end: '12:50' },
  { id: 'slot-lunch', label: '1:00 - 2:00', start: '13:00', end: '14:00', isLunch: true },
  { id: 'slot-6', label: '2:00 - 2:50', start: '14:00', end: '14:50' },
  { id: 'slot-7', label: '3:00 - 3:50', start: '15:00', end: '15:50' },
];

export const DAYS_OF_WEEK = [
  { day: 'Sunday', dayIndex: 0, short: 'Sun' },
  { day: 'Monday', dayIndex: 1, short: 'Mon' },
  { day: 'Tuesday', dayIndex: 2, short: 'Tue' },
  { day: 'Wednesday', dayIndex: 3, short: 'Wed' },
  { day: 'Thursday', dayIndex: 4, short: 'Thu' },
];

export const DEFAULT_ROUTINE = [
  // Sunday
  { id: 'sun-3', day: 'Sunday', dayIndex: 0, timeSlot: '10.00-10.50', startTime: '10:00', endTime: '10:50', subject: 'H 406', teacher: 'JAK', room: 'R. 402', notes: '', sortOrder: 3 },
  { id: 'sun-4', day: 'Sunday', dayIndex: 0, timeSlot: '11.00-11.50', startTime: '11:00', endTime: '11:50', subject: 'H-405', teacher: 'MI', room: 'R. 402', notes: '', sortOrder: 4 },
  { id: 'sun-5', day: 'Sunday', dayIndex: 0, timeSlot: '12.00-12.50', startTime: '12:00', endTime: '12:50', subject: 'H-405', teacher: 'MI', room: 'R. 402', notes: '', sortOrder: 5 },

  // Monday
  { id: 'mon-3', day: 'Monday', dayIndex: 1, timeSlot: '10.00-10.50', startTime: '10:00', endTime: '10:50', subject: 'H 402', teacher: 'FA', room: 'R. 402', notes: '', sortOrder: 3 },
  { id: 'mon-4', day: 'Monday', dayIndex: 1, timeSlot: '11.00-11.50', startTime: '11:00', endTime: '11:50', subject: 'H 401', teacher: 'BH', room: 'R. 436', notes: '', sortOrder: 4 },
  { id: 'mon-5', day: 'Monday', dayIndex: 1, timeSlot: '12.00-12.50', startTime: '12:00', endTime: '12:50', subject: 'H 401', teacher: 'BH', room: 'R. 436', notes: '', sortOrder: 5 },
  { id: 'mon-6', day: 'Monday', dayIndex: 1, timeSlot: '2.00-2.50', startTime: '14:00', endTime: '14:50', subject: 'H 408', teacher: 'JHK', room: 'R. 401', notes: '', sortOrder: 6 },
  { id: 'mon-7', day: 'Monday', dayIndex: 1, timeSlot: '3.00-3.50', startTime: '15:00', endTime: '15:50', subject: 'H 408', teacher: 'JHK', room: 'R. 401', notes: '', sortOrder: 7 },

  // Tuesday
  { id: 'tue-1', day: 'Tuesday', dayIndex: 2, timeSlot: '8.00-8.50', startTime: '08:00', endTime: '08:50', subject: 'H-405', teacher: 'MI', room: 'R. 402', notes: '', sortOrder: 1 },
  { id: 'tue-2', day: 'Tuesday', dayIndex: 2, timeSlot: '9.00-9.50', startTime: '09:00', endTime: '09:50', subject: 'H-404', teacher: 'KKS', room: 'R. 402', notes: '', sortOrder: 2 },
  { id: 'tue-3', day: 'Tuesday', dayIndex: 2, timeSlot: '10.00-10.50', startTime: '10:00', endTime: '10:50', subject: 'H-404', teacher: 'KKS', room: 'R. 402', notes: '', sortOrder: 3 },
  { id: 'tue-4', day: 'Tuesday', dayIndex: 2, timeSlot: '11.00-11.50', startTime: '11:00', endTime: '11:50', subject: 'H 406', teacher: 'JAK', room: 'R. 406', notes: '', sortOrder: 4 },
  { id: 'tue-5', day: 'Tuesday', dayIndex: 2, timeSlot: '12.00-12.50', startTime: '12:00', endTime: '12:50', subject: 'H 403', teacher: 'FTZ', room: 'R. 427', notes: '', sortOrder: 5 },
  { id: 'tue-6', day: 'Tuesday', dayIndex: 2, timeSlot: '2.00-2.50', startTime: '14:00', endTime: '14:50', subject: 'H-407', teacher: 'NS', room: 'R. 402', notes: '', sortOrder: 6 },

  // Wednesday
  { id: 'wed-2', day: 'Wednesday', dayIndex: 3, timeSlot: '9.00-9.50', startTime: '09:00', endTime: '09:50', subject: 'H 402', teacher: 'FA', room: 'R. 402', notes: '', sortOrder: 2 },
  { id: 'wed-3', day: 'Wednesday', dayIndex: 3, timeSlot: '10.00-10.50', startTime: '10:00', endTime: '10:50', subject: 'H 408', teacher: 'JHK', room: 'R. 402', notes: '', sortOrder: 3 },
  { id: 'wed-4', day: 'Wednesday', dayIndex: 3, timeSlot: '11.00-11.50', startTime: '11:00', endTime: '11:50', subject: 'H 401', teacher: 'BH', room: 'R. 402', notes: '', sortOrder: 4 },
  { id: 'wed-5', day: 'Wednesday', dayIndex: 3, timeSlot: '12.00-12.50', startTime: '12:00', endTime: '12:50', subject: 'H 403', teacher: 'FTZ', room: 'R. 427', notes: '', sortOrder: 5 },
  { id: 'wed-6', day: 'Wednesday', dayIndex: 3, timeSlot: '2.00-2.50', startTime: '14:00', endTime: '14:50', subject: 'H 403', teacher: 'FTZ', room: 'R. 427', notes: '', sortOrder: 6 },

  // Thursday
  { id: 'thu-2', day: 'Thursday', dayIndex: 4, timeSlot: '9.00-9.50', startTime: '09:00', endTime: '09:50', subject: 'H-404', teacher: 'KKS', room: 'R. 402', notes: '', sortOrder: 2 },
  { id: 'thu-3', day: 'Thursday', dayIndex: 4, timeSlot: '10.00-10.50', startTime: '10:00', endTime: '10:50', subject: 'H-404', teacher: 'KKS', room: 'R. 402', notes: '', sortOrder: 3 },
  { id: 'thu-4', day: 'Thursday', dayIndex: 4, timeSlot: '11.00-11.50', startTime: '11:00', endTime: '11:50', subject: 'H-407', teacher: 'NS', room: 'R. 402', notes: '', sortOrder: 4 },
  { id: 'thu-5', day: 'Thursday', dayIndex: 4, timeSlot: '12.00-12.50', startTime: '12:00', endTime: '12:50', subject: 'H-407', teacher: 'NS', room: 'R. 402', notes: '', sortOrder: 5 },
];

function rowToRoutine(row) {
  return {
    id: row.id,
    day: row.day,
    dayIndex: Number(row.day_index),
    timeSlot: row.time_slot,
    startTime: row.start_time,
    endTime: row.end_time,
    subject: row.subject,
    teacher: row.teacher || '',
    room: row.room || '',
    notes: row.notes || '',
    sortOrder: Number(row.sort_order || 0),
  };
}

function routineToRow(item) {
  return {
    id: item.id,
    day: item.day,
    day_index: item.dayIndex,
    time_slot: item.timeSlot,
    start_time: item.startTime,
    end_time: item.endTime,
    subject: item.subject,
    teacher: item.teacher || '',
    room: item.room || '',
    notes: item.notes || '',
    sort_order: item.sortOrder || 0,
    updated_at: new Date().toISOString(),
  };
}

export function sortRoutine(items = []) {
  return [...items].sort((a, b) => {
    if (a.dayIndex !== b.dayIndex) return a.dayIndex - b.dayIndex;
    return (a.startTime || '').localeCompare(b.startTime || '');
  });
}

function readLocalRoutine() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return sortRoutine(DEFAULT_ROUTINE);
    const parsed = JSON.parse(raw);
    if (Array.isArray(parsed) && parsed.length > 0) {
      return sortRoutine(parsed);
    }
    return sortRoutine(DEFAULT_ROUTINE);
  } catch {
    return sortRoutine(DEFAULT_ROUTINE);
  }
}

function writeLocalRoutine(items) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(items));
}

export function getRoutine() {
  return readLocalRoutine();
}

export async function fetchRoutine() {
  if (!isSupabaseConfigured()) {
    const local = readLocalRoutine();
    return local;
  }

  try {
    const { data, error } = await supabase
      .from('class_routine')
      .select('*')
      .order('day_index', { ascending: true })
      .order('start_time', { ascending: true });

    if (error) throw error;

    if (data && data.length > 0) {
      const routine = sortRoutine(data.map(rowToRoutine));
      writeLocalRoutine(routine);
      return routine;
    }

    // If table exists but is empty, seed defaults
    await seedDefaultRoutineToSupabase();
    return sortRoutine(DEFAULT_ROUTINE);
  } catch (err) {
    console.warn('[RoutineService] Falling back to local routine:', err);
    return readLocalRoutine();
  }
}

export async function seedDefaultRoutineToSupabase() {
  if (!isSupabaseConfigured()) return;
  try {
    const rows = DEFAULT_ROUTINE.map(routineToRow);
    await supabase.from('class_routine').upsert(rows, { onConflict: 'id' });
  } catch (err) {
    console.warn('[RoutineService] Seed error:', err);
  }
}

export async function saveRoutineItem(item) {
  const id = item.id || `slot_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`;
  const payload = { ...item, id };

  const current = readLocalRoutine();
  const idx = current.findIndex(r => r.id === id);
  if (idx !== -1) current[idx] = payload;
  else current.push(payload);
  const updated = sortRoutine(current);
  writeLocalRoutine(updated);

  if (isSupabaseConfigured()) {
    try {
      const { error } = await supabase
        .from('class_routine')
        .upsert(routineToRow(payload), { onConflict: 'id' });
      if (error) console.error('[RoutineService] Supabase save error:', error);
    } catch (err) {
      console.error('[RoutineService] Save error:', err);
    }
  }

  return updated;
}

export async function deleteRoutineItem(id) {
  const current = readLocalRoutine().filter(r => r.id !== id);
  writeLocalRoutine(current);

  if (isSupabaseConfigured()) {
    try {
      const { error } = await supabase
        .from('class_routine')
        .delete()
        .eq('id', id);
      if (error) console.error('[RoutineService] Supabase delete error:', error);
    } catch (err) {
      console.error('[RoutineService] Delete error:', err);
    }
  }

  return current;
}

export async function resetDefaultRoutine() {
  writeLocalRoutine(DEFAULT_ROUTINE);

  if (isSupabaseConfigured()) {
    try {
      await supabase.from('class_routine').delete().neq('id', '___');
      const rows = DEFAULT_ROUTINE.map(routineToRow);
      await supabase.from('class_routine').insert(rows);
    } catch (err) {
      console.error('[RoutineService] Reset error:', err);
    }
  }

  return sortRoutine(DEFAULT_ROUTINE);
}

export function getRoutineForDay(dayInput, routineList = readLocalRoutine()) {
  let dayIndex = -1;
  let dayName = '';

  if (typeof dayInput === 'number') {
    dayIndex = dayInput;
    const match = DAYS_OF_WEEK.find(d => d.dayIndex === dayIndex);
    dayName = match ? match.day : '';
  } else if (typeof dayInput === 'string') {
    dayName = dayInput;
    const match = DAYS_OF_WEEK.find(d => d.day.toLowerCase() === dayInput.toLowerCase());
    dayIndex = match ? match.dayIndex : -1;
  }

  return (routineList || [])
    .filter(item => item.dayIndex === dayIndex || (dayName && item.day.toLowerCase() === dayName.toLowerCase()))
    .sort((a, b) => (a.startTime || '').localeCompare(b.startTime || ''));
}

/**
 * Calculates current live class status or next upcoming class for today.
 */
export function getCurrentAndNextClass(routineList = readLocalRoutine(), now = new Date()) {
  const currentDayIndex = now.getDay();
  const todayClasses = getRoutineForDay(currentDayIndex, routineList);

  const hours = String(now.getHours()).padStart(2, '0');
  const minutes = String(now.getMinutes()).padStart(2, '0');
  const currentTimeStr = `${hours}:${minutes}`;

  // Check lunch break (1:00 PM - 2:00 PM on class days)
  const isClassDay = DAYS_OF_WEEK.some(d => d.dayIndex === currentDayIndex);
  const isLunchNow = isClassDay && currentTimeStr >= '13:00' && currentTimeStr < '14:00';

  let currentClass = null;
  let nextClass = null;

  for (const c of todayClasses) {
    if (currentTimeStr >= c.startTime && currentTimeStr < c.endTime) {
      currentClass = c;
      break;
    }
  }

  for (const c of todayClasses) {
    if (c.startTime > currentTimeStr) {
      nextClass = c;
      break;
    }
  }

  return {
    isClassDay,
    isLunchNow,
    currentClass,
    nextClass,
    todayClasses,
  };
}

export function subscribeToRoutine(onUpdate) {
  if (!isSupabaseConfigured()) return () => {};

  const channel = supabase
    .channel('public:class_routine')
    .on('postgres_changes', { event: '*', schema: 'public', table: 'class_routine' }, () => {
      fetchRoutine().then(onUpdate).catch(console.error);
    })
    .subscribe();

  return () => {
    supabase.removeChannel(channel);
  };
}
