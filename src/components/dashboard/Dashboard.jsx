import React, { useState, useEffect } from 'react';
import { supabase, isSupabaseConfigured } from '../../lib/supabase';

export default function Dashboard({ student: initialStudent, exams = [], onProfileUpdate, onLogout }) {
  const [student, setStudent] = useState(initialStudent);
  const [showProfileModal, setShowProfileModal] = useState(false);
  const [isEditing, setIsEditing] = useState(false);
  const [editForm, setEditForm] = useState({ ...initialStudent });
  const [editError, setEditError] = useState('');
  const [saveLoading, setSaveLoading] = useState(false);

  // Mood State
  const [moodChoices, setMoodChoices] = useState(['😊 Happy', '😴 Tired', '🔥 Motivated', '📚 Study Mode', '🤯 Stressed']);
  const [moodTimer, setMoodTimer] = useState('');

  // Sync state if initialStudent changes
  useEffect(() => {
    setStudent(initialStudent);
    setEditForm(initialStudent);
  }, [initialStudent]);

  // Load configured mood choices from database/local storage
  useEffect(() => {
    let active = true;
    async function loadMoodChoices() {
      try {
        if (isSupabaseConfigured()) {
          const { data, error } = await supabase
            .from('app_settings')
            .select('value')
            .eq('key', 'mood_choices')
            .maybeSingle();

          if (error) throw error;
          if (data && data.value && Array.isArray(data.value.choices)) {
            if (active) setMoodChoices(data.value.choices);
          }
        } else {
          const stored = localStorage.getItem('bahattor_mood_choices');
          if (stored) {
            const parsed = JSON.parse(stored);
            if (Array.isArray(parsed) && active) setMoodChoices(parsed);
          }
        }
      } catch (err) {
        console.error('Failed to load mood choices:', err);
      }
    }
    loadMoodChoices();
    return () => { active = false; };
  }, []);

  // Check and update mood expiration countdown
  useEffect(() => {
    if (!student.mood || !student.mood_selected_at) {
      setMoodTimer('');
      return;
    }

    const interval = setInterval(() => {
      const selectedTime = new Date(student.mood_selected_at).getTime();
      const diffMs = (selectedTime + 12 * 60 * 60 * 1000) - Date.now();

      if (diffMs <= 0) {
        // Mood expired
        setMoodTimer('');
        handleClearMood();
        clearInterval(interval);
      } else {
        const hours = Math.floor(diffMs / (1000 * 60 * 60));
        const minutes = Math.floor((diffMs % (1000 * 60 * 60)) / (1000 * 60));
        setMoodTimer(`${hours}h ${minutes}m left`);
      }
    }, 1000);

    return () => clearInterval(interval);
  }, [student.mood, student.mood_selected_at]);

  const handleMoodSelect = async (moodValue) => {
    const nowISO = new Date().toISOString();
    const updatedFields = {
      mood: moodValue,
      mood_selected_at: nowISO,
    };

    try {
      if (isSupabaseConfigured()) {
        const { error } = await supabase
          .from('students')
          .update(updatedFields)
          .eq('id', student.id);

        if (error) throw error;
      } else {
        // Mock offline updates
        const rawMock = localStorage.getItem('bahattor_mock_students') || '[]';
        const mockStudents = JSON.parse(rawMock);
        const index = mockStudents.findIndex(s => s.id === student.id);
        if (index !== -1) {
          mockStudents[index] = { ...mockStudents[index], ...updatedFields };
          localStorage.setItem('bahattor_mock_students', JSON.stringify(mockStudents));
        }
        localStorage.setItem('bahattor_logged_in_student', JSON.stringify({ ...student, ...updatedFields }));
      }

      const newStudentState = { ...student, ...updatedFields };
      setStudent(newStudentState);
      onProfileUpdate(newStudentState);
    } catch (err) {
      console.error('Failed to save mood:', err);
    }
  };

  const handleClearMood = async () => {
    const updatedFields = {
      mood: null,
      mood_selected_at: null,
    };

    try {
      if (isSupabaseConfigured()) {
        await supabase
          .from('students')
          .update(updatedFields)
          .eq('id', student.id);
      } else {
        // Mock offline updates
        const rawMock = localStorage.getItem('bahattor_mock_students') || '[]';
        const mockStudents = JSON.parse(rawMock);
        const index = mockStudents.findIndex(s => s.id === student.id);
        if (index !== -1) {
          mockStudents[index] = { ...mockStudents[index], ...updatedFields };
          localStorage.setItem('bahattor_mock_students', JSON.stringify(mockStudents));
        }
        localStorage.setItem('bahattor_logged_in_student', JSON.stringify({ ...student, ...updatedFields }));
      }

      const newStudentState = { ...student, ...updatedFields };
      setStudent(newStudentState);
      onProfileUpdate(newStudentState);
    } catch (err) {
      console.error('Failed to clear mood:', err);
    }
  };

  // Profile Edit logic
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
      const updatedFields = {
        name: name.trim(),
        dob: dob,
        gender: gender,
        class_roll: class_roll.trim(),
        session: session.trim(),
        phone_number: phone_number.trim(),
      };

      if (isSupabaseConfigured()) {
        const { error } = await supabase
          .from('students')
          .update(updatedFields)
          .eq('id', student.id);

        if (error) throw error;
      } else {
        // Mock updates
        const rawMock = localStorage.getItem('bahattor_mock_students') || '[]';
        const mockStudents = JSON.parse(rawMock);
        const index = mockStudents.findIndex(s => s.id === student.id);
        if (index !== -1) {
          mockStudents[index] = { ...mockStudents[index], ...updatedFields };
          localStorage.setItem('bahattor_mock_students', JSON.stringify(mockStudents));
        }
        localStorage.setItem('bahattor_logged_in_student', JSON.stringify({ ...student, ...updatedFields }));
      }

      const newStudentState = { ...student, ...updatedFields };
      setStudent(newStudentState);
      onProfileUpdate(newStudentState);
      setIsEditing(false);
      setShowProfileModal(false);
    } catch (err) {
      console.error('Save profile error:', err);
      setEditError(err.message || 'Failed to update profile.');
    } finally {
      setSaveLoading(false);
    }
  };

  // Date constants
  const today = new Date();
  const dateNum = today.getDate();
  const monthName = today.toLocaleDateString('en-US', { month: 'short' });
  const yearName = today.getFullYear();
  const dayName = today.toLocaleDateString('en-US', { weekday: 'long' });

  // Countdown Widget Math
  const todayStr = today.toISOString().split('T')[0];
  const upcomingExams = exams
    .filter(e => e.date >= todayStr)
    .sort((a, b) => a.date.localeCompare(b.date));

  const nextExam = upcomingExams[0];
  let remainingDays = null;
  let progressPct = 0;

  if (nextExam) {
    const examDate = new Date(nextExam.date + 'T00:00:00');
    const todayMidnight = new Date(today.getFullYear(), today.getMonth(), today.getDate());
    const diffTime = examDate.getTime() - todayMidnight.getTime();
    remainingDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));

    // Assume 30 days is the maximum visual countdown tracker span
    progressPct = Math.max(0, Math.min(100, ((30 - remainingDays) / 30) * 100));
  }

  // Avatar Initials
  const initials = student.name
    ? student.name.split(' ').map(n => n[0]).join('').slice(0, 2).toUpperCase()
    : 'ST';

  return (
    <div className="dashboard-container">
      {/* 1. Header Profile block */}
      <div className="dash-profile-card">
        <div className="dash-profile-main">
          <div className="dash-avatar">{initials}</div>
          <div className="dash-profile-info">
            <h2 className="dash-student-name">{student.name}</h2>
            <p className="dash-student-meta">Roll: {student.class_roll} · Reg: {student.registration_number}</p>
          </div>
        </div>
        <div className="dash-profile-actions">
          <button 
            type="button" 
            className="dash-action-link"
            onClick={() => {
              setIsEditing(false);
              setEditForm({ ...student });
              setShowProfileModal(true);
            }}
          >
            View Profile
          </button>
          <button type="button" className="dash-logout-btn" onClick={onLogout}>
            Logout
          </button>
        </div>
      </div>

      {/* 2. Grid Widgets Layout */}
      <div className="dash-widgets-grid">
        {/* Widget A: Today's Date */}
        <div className="dash-widget widget-date">
          <div className="widget-date-header">
            <span className="widget-date-month">{monthName} {yearName}</span>
          </div>
          <div className="widget-date-body">
            <span className="widget-date-daynum">{dateNum}</span>
            <span className="widget-date-dayname">{dayName}</span>
          </div>
        </div>

        {/* Widget B: Today's Mood */}
        <div className="dash-widget widget-mood">
          <h3 className="widget-title">How's your mood today?</h3>
          {student.mood ? (
            <div className="widget-mood-active">
              <div className="mood-active-content">
                <span className="mood-active-text">Feeling: <strong>{student.mood}</strong></span>
                {moodTimer && <span className="mood-active-expiry">{moodTimer}</span>}
              </div>
              <button type="button" className="mood-clear-btn" onClick={handleClearMood}>
                Change Mood
              </button>
            </div>
          ) : (
            <div className="widget-mood-selector">
              {moodChoices.map((moodOption, idx) => (
                <button
                  key={idx}
                  type="button"
                  className="mood-pill"
                  onClick={() => handleMoodSelect(moodOption)}
                >
                  {moodOption}
                </button>
              ))}
            </div>
          )}
        </div>

        {/* Widget C: Next Event Countdown */}
        <div className="dash-widget widget-countdown">
          <h3 className="widget-title">Next Exam / Event</h3>
          {nextExam ? (
            <div className="widget-countdown-content">
              <div className="countdown-event-details">
                <span className="countdown-subject">{nextExam.subject}</span>
                <span className="countdown-date">{new Date(nextExam.date).toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' })}</span>
              </div>
              
              <div className="countdown-timer-visual">
                <div className="countdown-days-number">
                  {remainingDays === 0 ? (
                    <span className="days-glowing">TODAY</span>
                  ) : remainingDays === 1 ? (
                    <>
                      <span className="days-num">1</span>
                      <span className="days-label">Day Left</span>
                    </>
                  ) : (
                    <>
                      <span className="days-num">{remainingDays}</span>
                      <span className="days-label">Days Left</span>
                    </>
                  )}
                </div>
                
                {/* Visual Progress bar */}
                <div className="countdown-progress-track">
                  <div 
                    className="countdown-progress-fill" 
                    style={{ width: `${remainingDays === 0 ? 100 : progressPct}%` }}
                  />
                </div>
              </div>
            </div>
          ) : (
            <div className="widget-countdown-empty">
              <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <circle cx="12" cy="12" r="10" />
                <polyline points="12 6 12 12 16 14" />
              </svg>
              <span>No exams scheduled</span>
            </div>
          )}
        </div>

        {/* Widget D: Assignments Section */}
        <div className="dash-widget widget-assignments">
          <h3 className="widget-title">Assignments</h3>
          <div className="assignments-empty-state">
            <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
              <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
              <polyline points="14 2 14 8 20 8" />
              <line x1="16" y1="13" x2="8" y2="13" />
              <line x1="16" y1="17" x2="8" y2="17" />
              <polyline points="10 9 9 9 8 9" />
            </svg>
            <p>No assignments scheduled</p>
          </div>
        </div>
      </div>

      {/* 3. Profile details modal */}
      {showProfileModal && (
        <div className="modal-overlay" onClick={() => setShowProfileModal(false)}>
          <div className="modal-card profile-modal-card" onClick={e => e.stopPropagation()}>
            <div className="modal-header">
              <h3>{isEditing ? 'Edit Profile' : 'Student Profile'}</h3>
              <button 
                type="button" 
                className="modal-close-btn"
                onClick={() => setShowProfileModal(false)}
              >
                &times;
              </button>
            </div>

            {isEditing ? (
              <form onSubmit={handleSaveProfile} className="profile-edit-form">
                {editError && <div className="auth-error">{editError}</div>}
                
                <div className="form-row">
                  <div className="setup-input-group">
                    <label className="setup-label">Name</label>
                    <input
                      name="name"
                      className="setup-input"
                      type="text"
                      value={editForm.name}
                      onChange={handleEditChange}
                      required
                    />
                  </div>
                  <div className="setup-input-group">
                    <label className="setup-label">Date of Birth</label>
                    <input
                      name="dob"
                      className="setup-input"
                      type="date"
                      value={editForm.dob}
                      onChange={handleEditChange}
                      required
                    />
                  </div>
                </div>

                <div className="form-row">
                  <div className="setup-input-group">
                    <label className="setup-label">Gender</label>
                    <select
                      name="gender"
                      className="setup-input"
                      value={editForm.gender}
                      onChange={handleEditChange}
                      required
                    >
                      <option value="Male">Male</option>
                      <option value="Female">Female</option>
                      <option value="Other">Other</option>
                    </select>
                  </div>
                  <div className="setup-input-group">
                    <label className="setup-label">Class Roll</label>
                    <input
                      name="class_roll"
                      className="setup-input"
                      type="text"
                      value={editForm.class_roll}
                      onChange={handleEditChange}
                      required
                    />
                  </div>
                </div>

                <div className="form-row">
                  <div className="setup-input-group">
                    <label className="setup-label">Session</label>
                    <input
                      name="session"
                      className="setup-input"
                      type="text"
                      value={editForm.session}
                      onChange={handleEditChange}
                      required
                    />
                  </div>
                  <div className="setup-input-group">
                    <label className="setup-label">Phone Number</label>
                    <input
                      name="phone_number"
                      className="setup-input"
                      type="tel"
                      value={editForm.phone_number}
                      onChange={handleEditChange}
                      required
                    />
                  </div>
                </div>

                <div className="profile-uneditable-notice">
                  <p>Registration Number and DU Student Email cannot be edited. Contact administrators for changes.</p>
                </div>

                <div className="form-actions">
                  <button 
                    type="button" 
                    className="btn-cancel" 
                    onClick={() => setIsEditing(false)}
                    disabled={saveLoading}
                  >
                    Cancel
                  </button>
                  <button 
                    type="submit" 
                    className="btn-save" 
                    disabled={saveLoading}
                  >
                    {saveLoading ? 'Saving...' : 'Save Changes'}
                  </button>
                </div>
              </form>
            ) : (
              <div className="profile-view-details">
                <div className="detail-item">
                  <span className="detail-label">Name</span>
                  <span className="detail-value">{student.name}</span>
                </div>
                <div className="detail-item">
                  <span className="detail-label">Registration Number</span>
                  <span className="detail-value">{student.registration_number}</span>
                </div>
                <div className="detail-item">
                  <span className="detail-label">DU Student Email</span>
                  <span className="detail-value">{student.email}</span>
                </div>
                <div className="detail-item">
                  <span className="detail-label">Class Roll</span>
                  <span className="detail-value">{student.class_roll}</span>
                </div>
                <div className="detail-item">
                  <span className="detail-label">Session</span>
                  <span className="detail-value">{student.session}</span>
                </div>
                <div className="detail-item">
                  <span className="detail-label">Date of Birth</span>
                  <span className="detail-value">{new Date(student.dob).toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' })}</span>
                </div>
                <div className="detail-item">
                  <span className="detail-label">Gender</span>
                  <span className="detail-value">{student.gender}</span>
                </div>
                <div className="detail-item">
                  <span className="detail-label">Phone Number</span>
                  <span className="detail-value">{student.phone_number}</span>
                </div>

                <button 
                  type="button" 
                  className="profile-edit-trigger" 
                  onClick={() => setIsEditing(true)}
                >
                  Edit Profile
                </button>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
