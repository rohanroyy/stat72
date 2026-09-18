import React, { useState, useEffect, useRef, useCallback } from 'react';
import { supabase, isSupabaseConfigured } from '../../lib/supabase';
import GlimpseUploaderCard from '../glimpse/GlimpseUploaderCard';
import { submitRating, fetchTodayRatings, normaliseSubject } from '../../services/ratingService';
import { SUBJECT_META } from '../explore/ClassCountPanel';


// Motivational quotes shown in header
const QUOTES = [
  'Class started. The comeback starts now.',
  'Brain loading… please wait.',
  'Make memories, collect knowledge.',
  'Ambition high, attendance negotiable.',
  'Keep going. Your story is still being written.',
  'Sleep schedule has left the group.',
  'Syllabus waits for no one.',
  'Class today. Stories tomorrow.',
  'Dream big. Sleep less. Complain anyway.',
  'The struggle is part of the syllabus.',
  'Your future is built on ordinary days.',
  'Some chase grades. Some chase sleep.',
  'Learn. Laugh. Repeat.',
  'No pressure. Just an entire future.',
  'Back to class, back to reality.',
  'Be consistent. Even if your attendance isn’t.',
  'Everything is under control. Probably.',
  'The journey is the flex.',
  'Grades matter. So do the stories behind them.',
  'Keep going, even when nobody notices.',
  'Syllabus এগিয়ে যাচ্ছে. আমরাও… hopefully.',
  'Do something today your future self will respect.',
  'Academic comeback loading...',
  'Coffee first. Statistics later.',
  'Make today worth remembering.',
  'Progress over perfection. Panic over procrastination.',
  'New classes, new lessons, same old friends.',
  'Excuses don’t get grades.',
  'One lecture at a time. One crisis at a time.',
  'Another semester, another chance to surprise ourselves.',
  'The syllabus doesn’t care about your feelings.',
  'Dream. Do. Repeat.',
  'Show up. Learn something. Make memories.',
  'Not there yet. Getting there.',
  'Brain says study. Body says sleep.',
  'Let’s make this year count.',
  'Some chase success. We chase the attendance sheet first.',
  'Keep going. Keep growing.',
  'The comeback is always under construction.',
  'Future us will remember this.',
  'One day, all this chaos will make sense.',
  'Study smart. Panic smarter.',
  'Your next chapter needs your effort today.',
  'Here we go again.',
  'Make the effort worth the outcome.',
  'We came to learn. Somehow, chaos came too.',
  'Deadline is just motivation with a date.',
  'Start where you are. Build from there.',
  'You can ignore the syllabus. The syllabus won’t ignore you.',
  'Future you has enough problems.',
  'Not everyone has to understand the journey.',
  'One good day can change the direction.',
  'The goal is progress, not perfection.',
  '৭২ চলছে. গল্পও চলবে.',
  'Be the reason your future self says, “Worth it.”',
  'Less excuses. More attempts.',
  'We understand everything… eventually.',
  'Chaos today. Memories tomorrow.',
];

// ── Routine helpers (mirrored from RoutinePage) ──────────────────────────────
const ROUTINE_DAYS = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday'];
const ROUTINE_TIMES = ['8.00-8.50', '9.00-9.50', '10.00-10.50', '11.00-11.50', '12.00-12.50', '1.00-2.00', '2.00-2.50', '3.00-3.50'];
const SUBJECT_TONES = { 'H-401': 'blue', 'H-402': 'violet', 'H-403': 'violet', 'H-404': 'coral', 'H-405': 'gold', 'H-406': 'rose', 'H-407': 'blue', 'H-408': 'coral' };
const DEFAULT_SCHEDULE = {
  Sunday: [null, null, { code: 'H 406', room: '402', teacher: 'JAK' }, { code: 'H-405', room: '402', teacher: 'MI' }, { code: 'H-405', room: '402', teacher: 'MI' }, 'break', null, null],
  Monday: [null, null, { code: 'H 402', room: '402', teacher: 'FA' }, { code: 'H 401', room: '436', teacher: 'BH' }, { code: 'H 401', room: '436', teacher: 'BH' }, 'break', { code: 'H 408', room: '401', teacher: 'JHK' }, { code: 'H 408', room: '401', teacher: 'JHK' }],
  Tuesday: [{ code: 'H-405', room: '402', teacher: 'MI' }, { code: 'H-404', room: '402', teacher: 'KKS' }, { code: 'H-404', room: '402', teacher: 'KKS' }, { code: 'H 406', room: '406', teacher: 'JAK' }, { code: 'H 403', room: '427', teacher: 'FTZ' }, 'break', { code: 'H-407', room: '402', teacher: 'NS' }, null],
  Wednesday: [null, { code: 'H 402', room: '402', teacher: 'FA' }, { code: 'H 408', room: '402', teacher: 'JHK' }, { code: 'H 401', room: '402', teacher: 'BH' }, { code: 'H 403', room: '427', teacher: 'FTZ' }, 'break', { code: 'H 403', room: '427', teacher: 'FTZ' }, null],
  Thursday: [null, { code: 'H-404', room: '402', teacher: 'KKS' }, { code: 'H-404', room: '402', teacher: 'KKS' }, { code: 'H-407', room: '402', teacher: 'NS' }, { code: 'H-407', room: '402', teacher: 'NS' }, 'break', null, null],
};

const normCode = (v = '') => v.replace(/[\s-]/g, '').toLowerCase();
const sameClass = (a, b) =>
  a && b && a !== 'break' && b !== 'break' &&
  normCode(a.code) === normCode(b.code) &&
  String(a.room || '').replace(/^r\.?\s*/i, '').toLowerCase() === String(b.room || '').replace(/^r\.?\s*/i, '').toLowerCase() &&
  String(a.teacher || '').toLowerCase() === String(b.teacher || '').toLowerCase();
const toneFor = (code = '') =>
  SUBJECT_TONES[Object.keys(SUBJECT_TONES).find(k => normCode(k) === normCode(code))] || 'coral';

function mergeRoutineDay(slots) {
  const result = [];
  for (let i = 0; i < slots.length;) {
    const item = slots[i];
    if (!item) { i++; continue; }
    if (item === 'break') { i++; continue; } // skip break for dashboard
    let end = i;
    while (end + 1 < slots.length && sameClass(item, slots[end + 1])) end++;
    result.push({
      ...item,
      type: 'class',
      start: i,
      end,
      time: end === i ? ROUTINE_TIMES[i] : `${ROUTINE_TIMES[i].split('-')[0]}-${ROUTINE_TIMES[end].split('-')[1]}`,
      tone: toneFor(item.code),
      periodCount: end - i + 1,
    });
    i = end + 1;
  }
  return result;
}

// Parse a time-slot string like '10.00-10.50' → [startMin, endMin]
function parseRoutineTime(timeStr) {
  return timeStr.split('-').map(part => {
    const [rawH, rawM = '0'] = part.trim().split('.');
    let h = Number(rawH);
    if (h >= 1 && h <= 5) h += 12; // PM conversion for 1-5
    return h * 60 + Number(rawM);
  });
}

// Build schedule object from routineList (live DB) or fall back to DEFAULT_SCHEDULE
function buildSchedule(routineList) {
  if (!routineList || !routineList.length) return DEFAULT_SCHEDULE;
  const startIndex = {
    '08:00': 0, '8:00': 0, '8.00': 0,
    '09:00': 1, '9:00': 1, '9.00': 1,
    '10:00': 2, '10.00': 2,
    '11:00': 3, '11.00': 3,
    '12:00': 4, '12.00': 4,
    '14:00': 6, '2:00': 6, '2.00': 6,
    '15:00': 7, '3:00': 7, '3.00': 7,
  };
  const built = Object.fromEntries(ROUTINE_DAYS.map(day => [day, [null, null, null, null, null, 'break', null, null]]));
  routineList.forEach(item => {
    const idx = startIndex[String(item.startTime || item.start_time || '').trim()];
    if (built[item.day] && idx !== undefined && idx !== 5) {
      built[item.day][idx] = {
        code: item.subject,
        room: String(item.room || '').replace(/^r\.?\s*/i, ''),
        teacher: item.teacher || '',
      };
    }
  });
  return built;
}

export default function Dashboard({ student: initialStudent, exams = [], routineList = [], holidays = [], isCR = false, onProfileUpdate, onLogout, onChangeTab }) {
  // ── Rating state ──────────────────────────────────────────────────────────
  const [showRatePanel, setShowRatePanel] = useState(false);
  const [todayRatings, setTodayRatings] = useState([]); // already-submitted today
  const [ratePanelKey, setRatePanelKey] = useState(0); // force re-mount after submit

  const loadTodayRatings = useCallback(async () => {
    if (!initialStudent?.id) return;
    try {
      const rows = await fetchTodayRatings(initialStudent.id);
      setTodayRatings(rows || []);
    } catch (err) {
      console.error('[Dashboard] fetchTodayRatings:', err);
    }
  }, [initialStudent?.id]);

  useEffect(() => { loadTodayRatings(); }, [loadTodayRatings]);
  const [student, setStudent] = useState(initialStudent);
  const [showProfileModal, setShowProfileModal] = useState(false);
  const [isEditing, setIsEditing] = useState(false);
  const [editForm, setEditForm] = useState({ ...initialStudent });
  const [editError, setEditError] = useState('');
  const [saveLoading, setSaveLoading] = useState(false);

  const [moodInput, setMoodInput] = useState('');
  const [moodEditing, setMoodEditing] = useState(false);

  const [profilePic, setProfilePic] = useState(() => {
    if (initialStudent?.profile_picture) return initialStudent.profile_picture;
    try {
      return localStorage.getItem('bahattor_profile_pic_' + initialStudent?.id) || null;
    } catch {
      return null;
    }
  });
  const [picPreview, setPicPreview] = useState(null);
  const picInputRef = useRef(null);

  const [notifPermission, setNotifPermission] = useState(() => {
    if (!('Notification' in window)) return 'unsupported';
    return Notification.permission;
  });

  const handleRequestPermission = async () => {
    if (!('Notification' in window)) return;
    try {
      const status = await Notification.requestPermission();
      setNotifPermission(status);
    } catch (err) {
      console.error('Failed to request permission:', err);
    }
  };

  const isIOS = /iPad|iPhone|iPod/.test(navigator.userAgent) && !window.MSStream;
  const isStandalone = window.matchMedia('(display-mode: standalone)').matches || window.navigator.standalone;

  // Pick a stable daily quote
  const quote = QUOTES[new Date().getDate() % QUOTES.length];

  // ── Today's Classes — live clock for auto-dismissal ──────────────────────
  const [nowMinutes, setNowMinutes] = useState(() => {
    const n = new Date();
    return n.getHours() * 60 + n.getMinutes();
  });
  useEffect(() => {
    const tick = setInterval(() => {
      const n = new Date();
      setNowMinutes(n.getHours() * 60 + n.getMinutes());
    }, 30000); // refresh every 30 s
    return () => clearInterval(tick);
  }, []);

  useEffect(() => {
    if (initialStudent) {
      const selectedAt = initialStudent.mood_selected_at;
      const isExpired = initialStudent.mood && (
        !selectedAt || (Date.now() - new Date(selectedAt).getTime() > 12 * 60 * 60 * 1000)
      );

      if (isExpired) {
        const clearedFields = { mood: null, mood_selected_at: null };
        const clearedStudent = { ...initialStudent, ...clearedFields };
        setStudent(clearedStudent);
        setEditForm(clearedStudent);

        persistStudentUpdate(clearedFields, initialStudent.id).catch(err => {
          console.error('Failed to auto-clear expired mood:', err);
        });

        onProfileUpdate(clearedStudent);
      } else {
        setStudent(initialStudent);
        setEditForm(initialStudent);
      }

      if (initialStudent.profile_picture) {
        setProfilePic(initialStudent.profile_picture);
      }
    }
  }, [initialStudent]);

  const persistStudentUpdate = async (updatedFields, targetId = initialStudent?.id) => {
    if (!targetId) return;
    if (isSupabaseConfigured()) {
      const { data, error } = await supabase
        .from('students')
        .update(updatedFields)
        .eq('id', targetId)
        .select();

      if (error) {
        console.error('Supabase update error:', error);
        throw error;
      }

      if (!data || data.length === 0) {
        throw new Error(
          "Database update failed: No rows were updated. Check your Supabase RLS policies."
        );
      }

      const merged = { ...initialStudent, ...updatedFields };
      localStorage.setItem('bahattor_logged_in_student', JSON.stringify(merged));
    } else {
      const rawMock = localStorage.getItem('bahattor_mock_students') || '[]';
      const mockStudents = JSON.parse(rawMock);
      const idx = mockStudents.findIndex(s => s.id === targetId);
      if (idx !== -1) {
        mockStudents[idx] = { ...mockStudents[idx], ...updatedFields };
        localStorage.setItem('bahattor_mock_students', JSON.stringify(mockStudents));
      }
      localStorage.setItem('bahattor_logged_in_student', JSON.stringify({ ...initialStudent, ...updatedFields }));
    }
  };

  const handleMoodSave = async () => {
    const trimmed = moodInput.trim().slice(0, 40);
    if (!trimmed) return;
    const updatedFields = { mood: trimmed, mood_selected_at: new Date().toISOString() };
    try {
      await persistStudentUpdate(updatedFields);
      const updated = { ...student, ...updatedFields };
      setStudent(updated);
      onProfileUpdate(updated);
      setMoodInput('');
      setMoodEditing(false);
    } catch (err) {
      console.error('Failed to save mood:', err);
    }
  };

  const handleClearMood = async () => {
    const updatedFields = { mood: null, mood_selected_at: null };
    try {
      await persistStudentUpdate(updatedFields);
      const updated = { ...student, ...updatedFields };
      setStudent(updated);
      onProfileUpdate(updated);
      setMoodInput('');
      setMoodEditing(false);
    } catch (err) {
      console.error('Failed to clear mood:', err);
    }
  };

  const handlePicChange = (e) => {
    const file = e.target.files[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (ev) => { setPicPreview(ev.target.result); };
    reader.readAsDataURL(file);
  };

  const compressImage = (base64, maxSizeKB = 200) => {
    return new Promise((resolve) => {
      const img = new Image();
      img.onload = () => {
        const canvas = document.createElement('canvas');
        let w = img.width, h = img.height;
        const MAX = 400;
        if (w > h && w > MAX) { h = Math.round(h * MAX / w); w = MAX; }
        else if (h > MAX) { w = Math.round(w * MAX / h); h = MAX; }
        canvas.width = w; canvas.height = h;
        canvas.getContext('2d').drawImage(img, 0, 0, w, h);
        let quality = 0.85;
        let result = canvas.toDataURL('image/jpeg', quality);
        while (result.length / 1024 > maxSizeKB && quality > 0.3) {
          quality -= 0.1;
          result = canvas.toDataURL('image/jpeg', quality);
        }
        resolve(result);
      };
      img.src = base64;
    });
  };

  const applyPicSave = (pic) => {
    if (!pic) return;
    localStorage.setItem('bahattor_profile_pic_' + student.id, pic);
    setProfilePic(pic);
    setPicPreview(null);
  };

  const handleRemovePic = async () => {
    localStorage.removeItem('bahattor_profile_pic_' + student.id);
    setProfilePic(null);
    setPicPreview(null);
    try {
      const updatedFields = { profile_picture: null };
      await persistStudentUpdate(updatedFields);
      const updated = { ...student, ...updatedFields };
      setStudent(updated);
      onProfileUpdate(updated);
    } catch (err) {
      console.error('Failed to remove profile picture:', err);
    }
  };

  const handleEditChange = (e) => {
    const { name, value } = e.target;
    setEditForm(prev => ({ ...prev, [name]: value }));
  };

  const handleSaveProfile = async (e) => {
    e.preventDefault();
    setEditError('');
    setSaveLoading(true);

    const { name, dob, gender, class_roll, session, phone_number } = editForm;
    if (!name || !dob || !gender || !class_roll || !session || !phone_number) {
      setEditError('All fields are required.');
      setSaveLoading(false);
      return;
    }

    try {
      let picToSave = profilePic;
      if (picPreview) {
        picToSave = await compressImage(picPreview, 200);
      }

      const updatedFields = {
        name: name.trim(),
        dob,
        gender,
        class_roll: class_roll.trim(),
        session: session.trim(),
        phone_number: phone_number.trim(),
        profile_picture: picToSave
      };
      await persistStudentUpdate(updatedFields);
      applyPicSave(picToSave === profilePic ? null : picToSave);
      const updated = { ...student, ...updatedFields };
      setStudent(updated);
      onProfileUpdate(updated);
      setIsEditing(false);
      setShowProfileModal(false);
    } catch (err) {
      setEditError(err.message || 'Failed to update profile.');
    } finally {
      setSaveLoading(false);
    }
  };

  // Date helpers
  const today = new Date();
  const dateNum = today.getDate();
  const monthName = today.toLocaleDateString('en-US', { month: 'short' });
  const yearNum = today.getFullYear();
  const dayName = today.toLocaleDateString('en-US', { weekday: 'short' });

  const getLocalDateStr = (d) => {
    const year = d.getFullYear();
    const month = String(d.getMonth() + 1).padStart(2, '0');
    const day = String(d.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
  };

  // Get ALL exams this month (from today onwards in local time)
  const todayStr = getLocalDateStr(today);
  const nextMonthStart = new Date(today.getFullYear(), today.getMonth() + 1, 1);
  const nextMonthStartStr = getLocalDateStr(nextMonthStart);

  const monthExams = exams
    .filter(e => {
      if (e.date < todayStr) return false;
      if (e.date === todayStr && e.time) {
        const currentHours = today.getHours();
        const currentMinutes = today.getMinutes();
        const [examHours, examMinutes] = e.time.split(':').map(Number);
        if (examHours !== undefined) {
          const examStartMinutes = examHours * 60 + (examMinutes || 0);
          const currentTotalMinutes = currentHours * 60 + currentMinutes;
          // Remove if current time is more than 3 hours (180 mins) past the exam start time
          if (currentTotalMinutes > examStartMinutes + 180) {
            return false;
          }
        }
      }
      return e.date < nextMonthStartStr;
    })
    .sort((a, b) => a.date.localeCompare(b.date));

  // First name only for greeting
  const firstName = student.name ? student.name.split(' ')[0] : 'there';

  const initials = student.name
    ? student.name.split(' ').map(n => n[0]).join('').slice(0, 2).toUpperCase()
    : 'ST';

  const displayPic = picPreview || profilePic;

  // Compute remaining days for an exam
  const getDaysLeft = (examDateStr) => {
    const examDate = new Date(examDateStr + 'T00:00:00');
    const todayMidnight = new Date(today.getFullYear(), today.getMonth(), today.getDate());
    return Math.ceil((examDate - todayMidnight) / (1000 * 60 * 60 * 24));
  };

  // Intelligently parse exam subject into course code (e.g. STAT H-305) & course title
  const parseExamSubject = (exam) => {
    const full = (exam.subject || '').trim();

    if (full.includes(':')) {
      const parts = full.split(':');
      return {
        code: parts[0].trim(),
        name: parts.slice(1).join(':').trim()
      };
    }

    if (full.includes(' - ')) {
      const parts = full.split(' - ');
      return {
        code: parts[0].trim(),
        name: parts.slice(1).join(' - ').trim()
      };
    }

    const match = full.match(/^([A-Z]{2,6}\s*(?:H-?)?\d+[A-Z]?)\s+(.+)$/i);
    if (match) {
      return {
        code: match[1].trim(),
        name: match[2].trim()
      };
    }

    if (/^[A-Z]{2,6}\s*(?:H-?)?\d+[A-Z]?$/i.test(full)) {
      return {
        code: full,
        name: exam.notes || 'Course Exam'
      };
    }

    return {
      code: 'STAT',
      name: full
    };
  };

  // Format 12-hour time (e.g. 13:30 -> 1:30 PM)
  const format12HourTime = (timeStr) => {
    if (!timeStr) return '';
    if (/am|pm/i.test(timeStr)) return timeStr;
    const [h, m] = timeStr.split(':');
    if (h === undefined) return timeStr;
    let hours = parseInt(h, 10);
    if (isNaN(hours)) return timeStr;
    const minutes = m ? m.slice(0, 2) : '00';
    const ampm = hours >= 12 ? 'PM' : 'AM';
    hours = hours % 12;
    if (hours === 0) hours = 12;
    return `${hours}:${minutes} ${ampm}`;
  };

  // Format exam card footer text: Date, 12-hour time, Room location
  const formatExamFooter = (dateStr, timeStr, roomStr) => {
    const d = new Date(dateStr + 'T00:00:00');
    const dayLabel = d.toLocaleDateString('en-US', { weekday: 'short' });
    const dateLabel = d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
    let parts = [`${dayLabel}, ${dateLabel}`];
    if (timeStr) {
      parts.push(format12HourTime(timeStr));
    }
    if (roomStr) {
      const cleanRoom = roomStr.toLowerCase().includes('room') ? roomStr : `Room ${roomStr}`;
      parts.push(cleanRoom);
    }
    return parts.join(' · ');
  };

  return (
    <div className="dash-page">

      {/* ── Hero Header ──────────────────────────────────────────── */}
      <div className="dash-hero">
        <div className="dash-hero-top">
          <div className="dash-hero-text">
            <p className="dash-hero-greeting">Hey {firstName}</p>
            <p className="dash-hero-quote">{quote}</p>
          </div>
          <div className="dash-hero-avatar-col">
            <div
              className="dash-hero-avatar"
              onClick={() => { setIsEditing(false); setEditForm({ ...student }); setShowProfileModal(true); }}
              title="View Profile"
            >
              {displayPic
                ? <img src={displayPic} alt="Profile" className="dash-avatar-img" />
                : <span>{initials}</span>
              }
            </div>
            <p className="dash-hero-roll">Roll {student.class_roll}</p>
            <p className="dash-hero-reg">Reg {student.registration_number}</p>
          </div>
        </div>

        <div className="dash-hero-actions">
          <button
            className="dash-view-profile-pill"
            onClick={() => { setIsEditing(false); setEditForm({ ...student }); setShowProfileModal(true); }}
          >
            View profile
          </button>
          <button
            className="dash-logout-pill"
            onClick={onLogout}
            aria-label="Log out"
            title="Log out"
          >
            {/* logout icon */}
            <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
              <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4" />
              <polyline points="16 17 21 12 16 7" />
              <line x1="21" y1="12" x2="9" y2="12" />
            </svg>
          </button>
        </div>
      </div>

      {/* ── Notification Check Banner ────────────────────────────── */}
      {notifPermission !== 'granted' && notifPermission !== 'unsupported' && (
        <div className="dash-notif-banner">
          <div className="dash-notif-banner-icon">🔔</div>
          <div className="dash-notif-banner-content">
            {isIOS && !isStandalone ? (
              <>
                <strong>Enable push alerts</strong>
                <p>Tap Share ➔ "Add to Home Screen" and launch the app from your home screen to get exam notifications.</p>
              </>
            ) : (
              <>
                <strong>Enable notifications</strong>
                <p>Get reminders for upcoming exams.</p>
              </>
            )}
          </div>
          {!(isIOS && !isStandalone) && (
            <button className="dash-notif-banner-btn" onClick={handleRequestPermission}>
              Enable
            </button>
          )}
        </div>
      )}

      {/* ── Date + Mood 50/50 ────────────────────────────────────── */}
      <div className="dash-twin-row">

        {/* Date card */}
        <div className="dash-mini-card">
          <p className="dash-mini-label">Today</p>
          <p className="dash-mini-big">{dateNum}</p>
          <p className="dash-mini-sub">{dayName}, {monthName} {yearNum}</p>
        </div>

        {/* Mood card */}
        <div className="dash-mini-card dash-mini-card-mood">
          <div className="dash-mini-mood-header">
            <p className="dash-mini-label">Mood</p>
            {student.mood && !moodEditing && (
              <div className="dash-mini-mood-actions">
                <button
                  className="dash-mini-mood-edit-btn"
                  onClick={() => { setMoodInput(student.mood); setMoodEditing(true); }}
                  title="Edit mood"
                >
                  {/* pencil icon */}
                  <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7" />
                    <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z" />
                  </svg>
                </button>
                <button
                  className="dash-mini-mood-remove-btn"
                  onClick={handleClearMood}
                  title="Remove mood"
                >×</button>
              </div>
            )}
          </div>

          {student.mood && !moodEditing ? (
            <p className="dash-mini-sub dash-mini-mood-text">{student.mood}</p>
          ) : moodEditing ? (
            <div className="dash-mini-mood-input-area">
              <input
                className="mood-text-input"
                type="text"
                placeholder="How are you feeling?"
                maxLength={40}
                value={moodInput}
                autoFocus
                onChange={e => setMoodInput(e.target.value.slice(0, 40))}
                onKeyDown={e => {
                  if (e.key === 'Enter') handleMoodSave();
                  if (e.key === 'Escape') { setMoodEditing(false); setMoodInput(''); }
                }}
              />
              <div className="mood-input-footer">
                <span className="mood-char-count">{moodInput.length}/40</span>
                <div className="mood-input-btns">
                  <button className="mood-cancel-btn" onClick={() => { setMoodEditing(false); setMoodInput(''); }}>Cancel</button>
                  <button className="mood-save-btn" onClick={handleMoodSave} disabled={!moodInput.trim()}>Save</button>
                </div>
              </div>
            </div>
          ) : (
            <button
              className="dash-add-mood-btn"
              onClick={() => { setMoodInput(''); setMoodEditing(true); }}
            >
              + Add mood
            </button>
          )}
        </div>

      </div>

      {/* ── Today's Classes ──────────────────────────────────────── */}
      <TodaysClasses
        routineList={routineList}
        holidays={holidays}
        nowMinutes={nowMinutes}
        onChangeTab={onChangeTab}
        todayRatings={todayRatings}
        onOpenRatePanel={() => { setRatePanelKey(k => k + 1); setShowRatePanel(true); }}
      />

      {/* ── Glimpse Uploader Option Card ────────────────────────────── */}
      <GlimpseUploaderCard student={student} />

      {/* ── Upcoming Exams this month ────────────────────────────── */}
      <div className="dash-section">
        <div className="dash-section-header">
          <span className="dash-section-title">Upcoming exam</span>
          <button className="dash-see-all-btn" onClick={() => onChangeTab && onChangeTab('calendar')}>See all</button>
        </div>

        {monthExams.length === 0 ? (
          <div className="dash-no-exams">
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8">
              <circle cx="12" cy="12" r="10" /><polyline points="12 6 12 12 16 14" />
            </svg>
            <span>No upcoming exams this month</span>
          </div>
        ) : (
          <div className="dash-exam-cards-list">
            {monthExams.map((exam, idx) => {
              const daysLeft = getDaysLeft(exam.date);
              const isUrgent = daysLeft <= 3;
              const isToday = daysLeft === 0;
              const parsed = parseExamSubject(exam);

              return (
                <div key={exam.id || idx} className={`dash-exam-card ${isUrgent ? 'dash-exam-card-urgent' : ''}`}>
                  <div className="dash-exam-card-top">
                    <div className="dash-exam-card-info">
                      <p className="dash-exam-card-code">{parsed.code}</p>
                      <p className="dash-exam-card-subject">{parsed.name}</p>
                    </div>
                    <div className="dash-exam-card-days">
                      {isToday ? (
                        <span className="dash-exam-today-badge">TODAY</span>
                      ) : (
                        <>
                          <span className="dash-exam-days-num">{daysLeft}</span>
                          <span className="dash-exam-days-label">days left</span>
                        </>
                      )}
                    </div>
                  </div>

                  <div className="dash-exam-card-bottom">
                    <span className="dash-exam-card-date">
                      {formatExamFooter(exam.date, exam.time, exam.room)}
                    </span>
                    <button
                      className="dash-exam-arrow-btn"
                      onClick={() => onChangeTab && onChangeTab('calendar')}
                      title="View in calendar"
                      aria-label="Open calendar"
                    >
                      {/* arrow up-right */}
                      <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                        <line x1="7" y1="17" x2="17" y2="7" />
                        <polyline points="7 7 17 7 17 17" />
                      </svg>
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* ── Assignments ──────────────────────────────────────────── */}
      <div className="dash-section">
        <div className="dash-section-header">
          <span className="dash-section-title">Assignments</span>
        </div>
        <div className="dash-no-assignments">
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8">
            <path d="M13 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V9z" />
            <polyline points="13 2 13 9 20 9" />
          </svg>
          <span>No assignments yet</span>
        </div>
      </div>

      {isCR && (
        <button
          type="button"
          className="dash-cr-entry-card"
          onClick={() => onChangeTab && onChangeTab('cr')}
          aria-label="CR Panel"
        >
          <svg
            className="dash-cr-card-icon"
            width="20"
            height="20"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2.2"
            strokeLinecap="round"
            strokeLinejoin="round"
          >
            <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2" />
            <circle cx="9" cy="7" r="4" />
            <path d="M23 21v-2a4 4 0 0 0-3-3.87" />
            <path d="M16 3.13a4 4 0 0 1 0 7.75" />
          </svg>
          <span className="dash-cr-card-text">CR Panel</span>
        </button>
      )}

      {/* ── Rate Today's Classes Panel ────────────────────────────────── */}
      {showRatePanel && (
        <RateTodaysClassesPanel
          key={ratePanelKey}
          routineList={routineList}
          holidays={holidays}
          nowMinutes={nowMinutes}
          studentId={student?.id}
          todayRatings={todayRatings}
          onClose={() => setShowRatePanel(false)}
          onRatingSubmitted={() => loadTodayRatings()}
        />
      )}

      {/* ── Profile Modal ────────────────────────────────────────── */}
      {showProfileModal && (
        <div className="modal-overlay" onClick={() => { setShowProfileModal(false); setIsEditing(false); setPicPreview(null); }}>
          <div className="modal-card" onClick={e => e.stopPropagation()}>
            <div className="modal-header">
              <h3>{isEditing ? 'Edit Profile' : 'Student Profile'}</h3>
              <button className="modal-close-btn" onClick={() => { setShowProfileModal(false); setIsEditing(false); setPicPreview(null); }}>×</button>
            </div>

            {isEditing ? (
              <form onSubmit={handleSaveProfile} className="profile-edit-form">
                {editError && <div className="auth-error">{editError}</div>}
                <div className="pic-upload-section">
                  <div className="pic-preview-circle">
                    {(picPreview || profilePic)
                      ? <img src={picPreview || profilePic} alt="Profile" className="dash-avatar-img" />
                      : <span className="pic-initials">{initials}</span>
                    }
                  </div>
                  <div className="pic-upload-actions">
                    <button type="button" className="pic-upload-btn" onClick={() => picInputRef.current?.click()}>
                      {profilePic || picPreview ? 'Change Photo' : 'Add Photo'}
                    </button>
                    {(profilePic || picPreview) && (
                      <button type="button" className="pic-remove-btn" onClick={handleRemovePic}>Remove</button>
                    )}
                    <input ref={picInputRef} type="file" accept="image/*" style={{ display: 'none' }} onChange={handlePicChange} />
                  </div>
                </div>
                <div className="form-row">
                  <div className="setup-input-group">
                    <label className="setup-label">Full Name</label>
                    <input name="name" className="setup-input" type="text" value={editForm.name} onChange={handleEditChange} required />
                  </div>
                  <div className="setup-input-group">
                    <label className="setup-label">Date of Birth</label>
                    <input name="dob" className="setup-input" type="date" value={editForm.dob} onChange={handleEditChange} required />
                  </div>
                </div>
                <div className="form-row">
                  <div className="setup-input-group">
                    <label className="setup-label">Gender</label>
                    <select name="gender" className="setup-input" value={editForm.gender} onChange={handleEditChange} required>
                      <option value="Male">Male</option>
                      <option value="Female">Female</option>
                      <option value="Other">Other</option>
                    </select>
                  </div>
                  <div className="setup-input-group">
                    <label className="setup-label">Class Roll</label>
                    <input name="class_roll" className="setup-input" type="text" value={editForm.class_roll} onChange={handleEditChange} required />
                  </div>
                </div>
                <div className="form-row">
                  <div className="setup-input-group">
                    <label className="setup-label">Session</label>
                    <input name="session" className="setup-input" type="text" value={editForm.session} onChange={handleEditChange} required />
                  </div>
                  <div className="setup-input-group">
                    <label className="setup-label">Phone Number</label>
                    <input name="phone_number" className="setup-input" type="tel" value={editForm.phone_number} onChange={handleEditChange} required />
                  </div>
                </div>
                <div className="profile-uneditable-notice">Registration Number and DU Email cannot be edited.</div>
                <div className="form-actions">
                  <button type="button" className="btn-cancel" onClick={() => { setIsEditing(false); setPicPreview(null); }} disabled={saveLoading}>Cancel</button>
                  <button type="submit" className="btn-save" disabled={saveLoading}>{saveLoading ? 'Saving...' : 'Save Changes'}</button>
                </div>
              </form>
            ) : (
              <div className="profile-view-details">
                <div className="profile-view-avatar">
                  <div className="pic-preview-circle">
                    {profilePic
                      ? <img src={profilePic} alt="Profile" className="dash-avatar-img" />
                      : <span className="pic-initials">{initials}</span>
                    }
                  </div>
                  <div>
                    <p className="profile-view-name">{student.name}</p>
                    <p className="profile-view-session">{student.session}</p>
                  </div>
                </div>
                {[
                  { label: 'Registration Number', value: student.registration_number },
                  { label: 'DU Student Email', value: student.email },
                  { label: 'Class Roll', value: student.class_roll },
                  { label: 'Date of Birth', value: new Date(student.dob).toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' }) },
                  { label: 'Gender', value: student.gender },
                  { label: 'Phone Number', value: student.phone_number },
                ].map(({ label, value }) => (
                  <div className="detail-item" key={label}>
                    <span className="detail-label">{label}</span>
                    <span className="detail-value">{value}</span>
                  </div>
                ))}
                <button type="button" className="profile-edit-trigger" onClick={() => setIsEditing(true)}>Edit Profile</button>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

// ── Today's Classes Sub-Component ─────────────────────────────────────────────
function TodaysClasses({ routineList, holidays = [], nowMinutes, onChangeTab, todayRatings = [], onOpenRatePanel }) {
  const todayFull = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'][new Date().getDay()];
  const isWeekend = !ROUTINE_DAYS.includes(todayFull);

  // Compute today's date string (YYYY-MM-DD) for holiday check
  const todayDate = new Date();
  const todayStr = `${todayDate.getFullYear()}-${String(todayDate.getMonth() + 1).padStart(2, '0')}-${String(todayDate.getDate()).padStart(2, '0')}`;

  // Check if today is a holiday
  const todayHoliday = holidays.find(h => {
    if (!h.date) return false;
    if (h.isRange && h.endDate) return todayStr >= h.date && todayStr <= h.endDate;
    return todayStr === h.date;
  }) || null;

  const schedule = buildSchedule(routineList);
  const allClasses = isWeekend ? [] : mergeRoutineDay(schedule[todayFull] || []);

  // Filter out classes whose end time has fully passed
  const upcomingClasses = allClasses.filter(cls => {
    const [, endMin] = parseRoutineTime(cls.time);
    return endMin > nowMinutes;
  });

  // Classes that have already ended today — used to show the rate card
  const endedClasses = allClasses.filter(cls => {
    const [, endMin] = parseRoutineTime(cls.time);
    return endMin <= nowMinutes;
  });

  // Deduplicate ended classes by subject (a double-slot = 1 ratable class)
  const uniqueEnded = [];
  const seenSubjects = new Set();
  for (const cls of endedClasses) {
    const key = normaliseSubject(cls.code);
    if (!seenSubjects.has(key)) {
      seenSubjects.add(key);
      uniqueEnded.push(cls);
    }
  }

  // Which of those has the student NOT rated yet today?
  const ratedKeys = new Set((todayRatings || []).map(r => normaliseSubject(r.subject)));
  const unratedEnded = uniqueEnded.filter(cls => !ratedKeys.has(normaliseSubject(cls.code)));
  const showRateCard = !isWeekend && !todayHoliday && unratedEnded.length > 0;

  // Format time slot for display: '10.00-10.50' → '10:00 – 10:50'
  const fmtTime = (timeStr) => {
    return timeStr.replace('-', ' – ').replace(/\./g, ':');
  };

  // Friendly label
  const isLive = (timeStr) => {
    const [startMin, endMin] = parseRoutineTime(timeStr);
    return nowMinutes >= startMin && nowMinutes < endMin;
  };

  const TONE_COLORS = {
    blue: { bg: '#1d4ed8', badge: '#93c5fd', text: '#ffffff', sub: 'rgba(255,255,255,0.72)' },
    violet: { bg: '#6d28d9', badge: '#c4b5fd', text: '#ffffff', sub: 'rgba(255,255,255,0.72)' },
    coral: { bg: '#c2410c', badge: '#fca5a5', text: '#ffffff', sub: 'rgba(255,255,255,0.72)' },
    gold: { bg: '#b45309', badge: '#fcd34d', text: '#ffffff', sub: 'rgba(255,255,255,0.80)' },
    rose: { bg: '#be185d', badge: '#f9a8d4', text: '#ffffff', sub: 'rgba(255,255,255,0.72)' },
  };

  return (
    <div className="dash-section dash-today-classes-section">
      <div className="dash-section-header">
        <span className="dash-section-title">Today's classes</span>
        {!isWeekend && (
          <button className="dash-see-all-btn" onClick={() => onChangeTab && onChangeTab('routine')}>
            Full routine
          </button>
        )}
      </div>

      {isWeekend ? (
        <div className="dash-no-exams">
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8">
            <path d="M12 2a10 10 0 1 0 0 20A10 10 0 0 0 12 2z" />
            <path d="M12 6v6l4 2" />
          </svg>
          <span>No classes on weekends — enjoy your break!</span>
        </div>
      ) : todayHoliday ? (
        <div className="dash-no-exams dash-holiday-banner" style={{ color: '#000000' }}>
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
            <rect x="3" y="4" width="18" height="17" rx="3" />
            <path d="M8 2v4M16 2v4M3 10h18" />
            <path d="M8 14h.01M12 14h.01M16 14h.01" />
          </svg>
          <span style={{ color: '#000000' }}>
            <b style={{ color: '#000000' }}>{todayHoliday.label}</b>{todayHoliday.note ? ` — ${todayHoliday.note}` : ''} · No classes today
          </span>
        </div>
      ) : upcomingClasses.length === 0 ? (
        <div className="dash-no-exams">
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8">
            <path d="M22 11.08V12a10 10 0 1 1-5.93-9.14" />
            <polyline points="22 4 12 14.01 9 11.01" />
          </svg>
          <span>All classes for today are done — great work!</span>
        </div>
      ) : (
        <div className="dash-today-classes-scroll">
          {upcomingClasses.map((cls, idx) => {
            const live = isLive(cls.time);
            const colors = TONE_COLORS[cls.tone] || TONE_COLORS.coral;
            return (
              <div
                key={`${cls.code}-${idx}`}
                className={`dash-class-card ${live ? 'dash-class-card-live' : ''}`}
                style={{ background: colors.bg }}
              >
                {/* Live pulse badge */}
                {live && (
                  <div className="dash-class-live-badge">
                    <span className="dash-class-live-dot" />
                    NOW
                  </div>
                )}

                {/* Subject code */}
                <p className="dash-class-code" style={{ color: '#ffffff' }}>{cls.code}</p>

                {/* Periods */}
                {cls.periodCount > 1 && (
                  <span className="dash-class-periods" style={{ color: colors.sub }}>
                    {cls.periodCount} periods
                  </span>
                )}

                {/* Time */}
                <p className="dash-class-time" style={{ color: colors.text }}>{fmtTime(cls.time)}</p>

                {/* Divider */}
                <div className="dash-class-divider" style={{ borderColor: 'rgba(255,255,255,0.2)' }} />

                {/* Teacher + Room */}
                <div className="dash-class-meta">
                  {cls.teacher && (
                    <span className="dash-class-meta-item" style={{ color: colors.sub }}>
                      <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2">
                        <circle cx="12" cy="7" r="4" /><path d="M4 21c.7-4 3.3-6 8-6s7.3 2 8 6" />
                      </svg>
                      {cls.teacher}
                    </span>
                  )}
                  {cls.room && (
                    <span className="dash-class-meta-item" style={{ color: colors.sub }}>
                      <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2">
                        <path d="M20 10c0 5.5-8 12-8 12S4 15.5 4 10a8 8 0 1 1 16 0Z" /><circle cx="12" cy="10" r="2.5" />
                      </svg>
                      R. {cls.room}
                    </span>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* ── Rate Today's Classes Card ────────────────────────────────────── */}
      {showRateCard && (
        <button
          type="button"
          className="dash-rate-card"
          onClick={onOpenRatePanel}
          aria-label="Rate today's classes"
        >
          <div className="dash-rate-card-left">
            <div className="dash-rate-card-icon">
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2" />
              </svg>
            </div>
            <div className="dash-rate-card-body">
              <span className="dash-rate-card-title">Rate today's classes</span>
              <span className="dash-rate-card-sub">{unratedEnded.length} {unratedEnded.length === 1 ? 'class' : 'classes'} to rate</span>
            </div>
          </div>
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round" className="dash-rate-card-arrow">
            <polyline points="9 18 15 12 9 6" />
          </svg>
        </button>
      )}
    </div>
  );
}

// ── Rate Today's Classes Panel ────────────────────────────────────────────────
function RateTodaysClassesPanel({ routineList, holidays = [], nowMinutes, studentId, todayRatings = [], onClose, onRatingSubmitted }) {
  const todayFull = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'][new Date().getDay()];
  const isWeekend = !ROUTINE_DAYS.includes(todayFull);

  const todayDate = new Date();
  const todayStr = `${todayDate.getFullYear()}-${String(todayDate.getMonth() + 1).padStart(2, '0')}-${String(todayDate.getDate()).padStart(2, '0')}`;
  const todayHoliday = holidays.find(h => {
    if (!h.date) return false;
    if (h.isRange && h.endDate) return todayStr >= h.date && todayStr <= h.endDate;
    return todayStr === h.date;
  }) || null;

  const schedule = buildSchedule(routineList);
  const allClasses = (isWeekend || todayHoliday) ? [] : mergeRoutineDay(schedule[todayFull] || []);

  // All ended classes (deduplicated by subject)
  const endedClasses = allClasses.filter(cls => {
    const [, endMin] = parseRoutineTime(cls.time);
    return endMin <= nowMinutes;
  });
  const uniqueEnded = [];
  const seenSubjects = new Set();
  for (const cls of endedClasses) {
    const key = normaliseSubject(cls.code);
    if (!seenSubjects.has(key)) {
      seenSubjects.add(key);
      uniqueEnded.push(cls);
    }
  }

  // Local rating state: { [normaliseSubject(code)]: number }
  const [selectedStars, setSelectedStars] = useState({});
  const [submitting, setSubmitting] = useState({});
  const [submitted, setSubmitted] = useState(() => {
    // Pre-fill already-submitted ratings
    const s = {};
    (todayRatings || []).forEach(r => { s[normaliseSubject(r.subject)] = r.rating; });
    return s;
  });
  const [hovered, setHovered] = useState({});
  const [allDone, setAllDone] = useState(false);

  // Handle back gesture
  useEffect(() => {
    window.history.pushState({ panel: 'rate' }, '');
    const onPop = (e) => {
      if (!e.state?.panel) onClose();
    };
    window.addEventListener('popstate', onPop);
    return () => window.removeEventListener('popstate', onPop);
  }, [onClose]);

  const handleSubmit = async (cls) => {
    const key = normaliseSubject(cls.code);
    const stars = selectedStars[key];
    if (!stars || !studentId) return;

    setSubmitting(prev => ({ ...prev, [key]: true }));
    try {
      await submitRating({
        studentId,
        subject: cls.code,
        teacher: cls.teacher || '',
        rating: stars,
      });
      setSubmitted(prev => ({ ...prev, [key]: stars }));
      setSelectedStars(prev => { const n = { ...prev }; delete n[key]; return n; });
      onRatingSubmitted();

      // Check if all classes are now rated
      const newSubmitted = { ...submitted, [key]: stars };
      const allRated = uniqueEnded.every(c => newSubmitted[normaliseSubject(c.code)] !== undefined);
      if (allRated) {
        setAllDone(true);
        setTimeout(() => onClose(), 1600);
      }
    } catch (err) {
      console.error('[RatePanel] submit error:', err);
    } finally {
      setSubmitting(prev => ({ ...prev, [key]: false }));
    }
  };

  // Get subject display name from SUBJECT_META
  const getSubjectName = (code) => {
    const normKey = Object.keys(SUBJECT_META).find(k => normaliseSubject(k) === normaliseSubject(code));
    return normKey ? SUBJECT_META[normKey].name : '';
  };

  return (
    <div className="rate-panel-overlay" onClick={onClose}>
      <div className="rate-panel" onClick={e => e.stopPropagation()}>
        {/* ── Header ── */}
        <div className="rate-panel-header">
          <button
            className="rate-panel-back-btn"
            onClick={onClose}
            aria-label="Close panel"
          >
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round">
              <polyline points="15 18 9 12 15 6" />
            </svg>
            <span>Back</span>
          </button>
          <h3 className="rate-panel-title">Rate Today's Classes</h3>
          <div style={{ width: 44 }} />
        </div>

        {/* ── Content ── */}
        <div className="rate-panel-body">
          {allDone ? (
            <div className="rate-panel-done">
              <svg width="40" height="40" viewBox="0 0 24 24" fill="none" stroke="#10B981" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M22 11.08V12a10 10 0 1 1-5.93-9.14" />
                <polyline points="22 4 12 14.01 9 11.01" />
              </svg>
              <p>All classes rated!</p>
            </div>
          ) : uniqueEnded.length === 0 ? (
            <div className="rate-panel-empty">
              <svg width="36" height="36" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8">
                <circle cx="12" cy="12" r="10" />
                <path d="M12 6v6l4 2" />
              </svg>
              <p>No ended classes to rate yet.</p>
            </div>
          ) : (
            uniqueEnded.map(cls => {
              const key = normaliseSubject(cls.code);
              const alreadyRated = submitted[key] !== undefined;
              const currentStars = selectedStars[key] || 0;
              const hoveredStars = hovered[key] || 0;
              const displayStars = hoveredStars || currentStars;
              const isSubmitting = submitting[key];
              const subjectName = getSubjectName(cls.code);

              return (
                <div key={key} className={`rate-class-card${alreadyRated ? ' rate-class-card-done' : ''}`}>
                  <div className="rate-class-card-header">
                    <div className="rate-class-card-info">
                      <span className="rate-class-teacher">Rate {cls.teacher}'s Class</span>
                      <span className="rate-class-subject">{subjectName || cls.code}</span>
                      <span className="rate-class-code">{cls.code} · {cls.time.replace('-', ' – ').replace(/\./g, ':')}</span>
                    </div>
                    {alreadyRated && (
                      <div className="rate-class-done-badge">
                        <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="#10B981" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                          <polyline points="20 6 9 17 4 12" />
                        </svg>
                      </div>
                    )}
                  </div>

                  {alreadyRated ? (
                    <div className="rate-stars-row">
                      {[1, 2, 3, 4, 5].map(s => (
                        <svg key={s} width="26" height="26" viewBox="0 0 24 24"
                          fill={submitted[key] >= s ? '#F59E0B' : 'none'}
                          stroke={submitted[key] >= s ? '#F59E0B' : '#CBD5E1'}
                          strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"
                        >
                          <polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2" />
                        </svg>
                      ))}
                      <span className="rate-rated-label">{submitted[key]}/5</span>
                    </div>
                  ) : (
                    <>
                      <div className="rate-stars-row">
                        {[1, 2, 3, 4, 5].map(s => (
                          <button
                            key={s}
                            type="button"
                            className={`rate-star-btn${displayStars >= s ? ' rate-star-filled' : ''}`}
                            onMouseEnter={() => setHovered(prev => ({ ...prev, [key]: s }))}
                            onMouseLeave={() => setHovered(prev => ({ ...prev, [key]: 0 }))}
                            onClick={() => setSelectedStars(prev => ({ ...prev, [key]: s }))}
                            aria-label={`Rate ${s} star${s !== 1 ? 's' : ''}`}
                          >
                            <svg width="28" height="28" viewBox="0 0 24 24"
                              fill={displayStars >= s ? '#F59E0B' : 'none'}
                              stroke={displayStars >= s ? '#F59E0B' : '#94A3B8'}
                              strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"
                              style={{ transition: 'fill 0.15s, stroke 0.15s' }}
                            >
                              <polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2" />
                            </svg>
                          </button>
                        ))}
                      </div>
                      {currentStars > 0 && (
                        <button
                          type="button"
                          className="rate-submit-btn"
                          onClick={() => handleSubmit(cls)}
                          disabled={isSubmitting}
                        >
                          {isSubmitting ? 'Submitting…' : 'Submit Rating'}
                        </button>
                      )}
                    </>
                  )}
                </div>
              );
            })
          )}
        </div>
      </div>
    </div>
  );
}
