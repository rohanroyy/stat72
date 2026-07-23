import React, { useState, useEffect, useRef } from 'react';
import { supabase, isSupabaseConfigured } from '../../lib/supabase';

// Motivational quotes shown in header
const QUOTES = [
  'Small steps today, big results tomorrow.',
  'Focus on progress, not perfection.',
  'Every expert was once a beginner.',
  'Study hard, dream big, achieve more.',
  'Consistency beats talent every time.',
  'Your future self will thank you.',
  'One page at a time, one day at a time.',
];

export default function Dashboard({ student: initialStudent, exams = [], onProfileUpdate, onLogout, onChangeTab }) {
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

  // Pick a stable daily quote
  const quote = QUOTES[new Date().getDate() % QUOTES.length];

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
  const dateNum  = today.getDate();
  const monthName = today.toLocaleDateString('en-US', { month: 'short' });
  const yearNum   = today.getFullYear();
  const dayName   = today.toLocaleDateString('en-US', { weekday: 'short' });

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
              const isToday  = daysLeft === 0;
              const parsed   = parseExamSubject(exam);

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
