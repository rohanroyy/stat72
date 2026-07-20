import React, { useState, useEffect, useRef } from "react";
import { supabase, isSupabaseConfigured } from "../../lib/supabase";

export default function Dashboard({ student: initialStudent, exams = [], onProfileUpdate, onLogout }) {
  const [student, setStudent] = useState(initialStudent);
  const [showProfileModal, setShowProfileModal] = useState(false);
  const [isEditing, setIsEditing] = useState(false);
  const [editForm, setEditForm] = useState({ ...initialStudent });
  const [editError, setEditError] = useState("");
  const [saveLoading, setSaveLoading] = useState(false);

  const [moodChoices, setMoodChoices] = useState(["?? Happy", "?? Tired", "?? Motivated", "?? Study Mode", "?? Stressed"]);
  const [moodDropdownOpen, setMoodDropdownOpen] = useState(false);
  const moodDropdownRef = useRef(null);

  const [profilePic, setProfilePic] = useState(() => {
    try { return localStorage.getItem("bahattor_profile_pic_" + (initialStudent?.id)) || null; } catch { return null; }
  });
  const [picPreview, setPicPreview] = useState(null);
  const picInputRef = useRef(null);

  useEffect(() => { setStudent(initialStudent); setEditForm(initialStudent); }, [initialStudent]);

  useEffect(() => {
    let active = true;
    async function loadMoodChoices() {
      try {
        if (isSupabaseConfigured()) {
          const { data } = await supabase.from("app_settings").select("value").eq("key", "mood_choices").maybeSingle();
          if (data?.value && Array.isArray(data.value.choices) && active) setMoodChoices(data.value.choices);
        } else {
          const stored = localStorage.getItem("bahattor_mood_choices");
          if (stored && active) { const p = JSON.parse(stored); if (Array.isArray(p)) setMoodChoices(p); }
        }
      } catch (err) { console.error(err); }
    }
    loadMoodChoices();
    return () => { active = false; };
  }, []);

  useEffect(() => {
    const handler = (e) => {
      if (moodDropdownRef.current && !moodDropdownRef.current.contains(e.target)) setMoodDropdownOpen(false);
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, []);

  const persistStudentUpdate = async (updatedFields) => {
    if (isSupabaseConfigured()) {
      const { error } = await supabase.from("students").update(updatedFields).eq("id", student.id);
      if (error) throw error;
    } else {
      const rawMock = localStorage.getItem("bahattor_mock_students") || "[]";
      const mockStudents = JSON.parse(rawMock);
      const idx = mockStudents.findIndex(s => s.id === student.id);
      if (idx !== -1) { mockStudents[idx] = { ...mockStudents[idx], ...updatedFields }; localStorage.setItem("bahattor_mock_students", JSON.stringify(mockStudents)); }
      localStorage.setItem("bahattor_logged_in_student", JSON.stringify({ ...student, ...updatedFields }));
    }
  };

  const handleMoodSelect = async (moodValue) => {
    setMoodDropdownOpen(false);
    const updatedFields = { mood: moodValue, mood_selected_at: new Date().toISOString() };
    try {
      await persistStudentUpdate(updatedFields);
      const updated = { ...student, ...updatedFields };
      setStudent(updated); onProfileUpdate(updated);
    } catch (err) { console.error(err); }
  };

  const handleClearMood = async () => {
    const updatedFields = { mood: null, mood_selected_at: null };
    try {
      await persistStudentUpdate(updatedFields);
      const updated = { ...student, ...updatedFields };
      setStudent(updated); onProfileUpdate(updated);
    } catch (err) { console.error(err); }
  };

  const handlePicChange = (e) => {
    const file = e.target.files[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (ev) => setPicPreview(ev.target.result);
    reader.readAsDataURL(file);
  };

  const applyPicSave = (pic) => {
    if (!pic) return;
    localStorage.setItem("bahattor_profile_pic_" + student.id, pic);
    setProfilePic(pic);
    setPicPreview(null);
  };

  const handleRemovePic = () => {
    localStorage.removeItem("bahattor_profile_pic_" + student.id);
    setProfilePic(null); setPicPreview(null);
  };

  const handleEditChange = (e) => {
    const { name, value } = e.target;
    setEditForm(prev => ({ ...prev, [name]: value }));
  };

  const handleSaveProfile = async (e) => {
    e.preventDefault();
    setEditError("");
    setSaveLoading(true);
    if (picPreview) applyPicSave(picPreview);
    const { name, dob, gender, class_roll, session, phone_number } = editForm;
    if (!name || !dob || !gender || !class_roll || !session || !phone_number) {
      setEditError("All fields are required."); setSaveLoading(false); return;
    }
    try {
      const updatedFields = { name: name.trim(), dob, gender, class_roll: class_roll.trim(), session: session.trim(), phone_number: phone_number.trim() };
      await persistStudentUpdate(updatedFields);
      const updated = { ...student, ...updatedFields };
      setStudent(updated); onProfileUpdate(updated); setIsEditing(false);
    } catch (err) {
      setEditError(err.message || "Failed to update profile.");
    } finally { setSaveLoading(false); }
  };

  const today = new Date();
  const dateNum = today.getDate();
  const monthName = today.toLocaleDateString("en-US", { month: "long" });
  const yearNum = today.getFullYear();
  const dayName = today.toLocaleDateString("en-US", { weekday: "long" });

  const todayStr = today.toISOString().split("T")[0];
  const upcomingExams = exams.filter(e => e.date >= todayStr).sort((a, b) => a.date.localeCompare(b.date));
  const nextExam = upcomingExams[0];
  let remainingDays = null, progressPct = 0;
  if (nextExam) {
    const examDate = new Date(nextExam.date + "T00:00:00");
    const todayMidnight = new Date(today.getFullYear(), today.getMonth(), today.getDate());
    remainingDays = Math.ceil((examDate - todayMidnight) / (1000 * 60 * 60 * 24));
    progressPct = Math.max(0, Math.min(100, ((30 - remainingDays) / 30) * 100));
  }

  const initials = student.name
    ? student.name.split(" ").map(n => n[0]).join("").slice(0, 2).toUpperCase()
    : "ST";

  const displayPic = picPreview || profilePic;

  return (
    <div className="dash-page">
      {/* Header */}
      <div className="dash-header-card">
        <div className="dash-header-left">
          <div
            className="dash-avatar-lg"
            onClick={() => { setIsEditing(false); setEditForm({ ...student }); setShowProfileModal(true); }}
            title="View Profile"
          >
            {displayPic
              ? <img src={displayPic} alt="Profile" className="dash-avatar-img" />
              : <span>{initials}</span>
            }
          </div>
          <div className="dash-header-info">
            <h2 className="dash-name">{student.name}</h2>
            <p className="dash-meta">Roll: <strong>{student.class_roll}</strong></p>
            <p className="dash-meta">Reg: <strong>{student.registration_number}</strong></p>
          </div>
        </div>
        <div className="dash-header-right">
          <button className="dash-view-profile-btn" onClick={() => { setIsEditing(false); setEditForm({ ...student }); setShowProfileModal(true); }}>
            View Profile
          </button>
          <button className="dash-logout-btn" onClick={onLogout}>Logout</button>
        </div>
      </div>

      {/* Row 1: Date + Mood 50/50 */}
      <div className="dash-row dash-row-half">
        <div className="dash-card dash-card-date">
          <span className="dash-card-section-label">Today</span>
          <div className="date-day-num">{dateNum}</div>
          <div className="date-day-name">{dayName}</div>
          <div className="date-month-year">{monthName} {yearNum}</div>
        </div>

        <div className="dash-card dash-card-mood">
          <div className="mood-header">
            <span className="dash-card-section-label">Mood</span>
            {student.mood && (
              <button className="mood-change-btn" onClick={handleClearMood}>Change</button>
            )}
          </div>
          {student.mood ? (
            <div className="mood-selected-display">
              <span className="mood-selected-text">{student.mood}</span>
            </div>
          ) : (
            <div className="mood-picker-wrapper" ref={moodDropdownRef}>
              <button className="mood-dropdown-trigger" onClick={() => setMoodDropdownOpen(o => !o)}>
                <span>How are you feeling?</span>
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"
                  style={{ transform: moodDropdownOpen ? "rotate(180deg)" : "none", transition: "transform 0.2s ease", flexShrink: 0 }}>
                  <polyline points="6 9 12 15 18 9" />
                </svg>
              </button>
              {moodDropdownOpen && (
                <div className="mood-dropdown-menu">
                  {moodChoices.map((mood, idx) => (
                    <button key={idx} className="mood-dropdown-item" onClick={() => handleMoodSelect(mood)}>
                      {mood}
                    </button>
                  ))}
                </div>
              )}
            </div>
          )}
        </div>
      </div>

      {/* Row 2: Upcoming Events */}
      <div className="dash-row">
        <div className="dash-card dash-card-full dash-card-countdown">
          <span className="dash-card-section-label">Next Exam</span>
          {nextExam ? (
            <div className="countdown-inner">
              <div className="countdown-left">
                <span className="countdown-subject-text">{nextExam.subject}</span>
                <span className="countdown-date-text">
                  {new Date(nextExam.date + "T00:00:00").toLocaleDateString("en-US", { weekday: "short", month: "long", day: "numeric", year: "numeric" })}
                </span>
                {nextExam.time && <span className="countdown-time-text">{nextExam.time}{nextExam.duration ? ` · ${nextExam.duration}` : ""}</span>}
                {nextExam.room && <span className="countdown-room-text">?? {nextExam.room}</span>}
              </div>
              <div className="countdown-right">
                {remainingDays === 0 ? (
                  <span className="days-today-badge">TODAY</span>
                ) : (
                  <div className="days-num-wrapper">
                    <span className="days-big-num">{remainingDays}</span>
                    <span className="days-unit-label">days left</span>
                  </div>
                )}
                <div className="countdown-bar-track">
                  <div className="countdown-bar-fill" style={{ width: remainingDays === 0 ? "100%" : `${progressPct}%` }} />
                </div>
              </div>
            </div>
          ) : (
            <div className="countdown-empty">
              <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8">
                <circle cx="12" cy="12" r="10" /><polyline points="12 6 12 12 16 14" />
              </svg>
              <span>No upcoming exams scheduled</span>
            </div>
          )}
        </div>
      </div>

      {/* Row 3: Assignments */}
      <div className="dash-row">
        <div className="dash-card dash-card-full dash-card-assignments">
          <span className="dash-card-section-label">Assignments</span>
          <div className="assignments-placeholder">
            <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
              <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
              <polyline points="14 2 14 8 20 8" />
              <line x1="16" y1="13" x2="8" y2="13" /><line x1="16" y1="17" x2="8" y2="17" />
            </svg>
            <p>No assignments yet</p>
          </div>
        </div>
      </div>

      {/* Profile Modal */}
      {showProfileModal && (
        <div className="modal-overlay" onClick={() => { setShowProfileModal(false); setIsEditing(false); setPicPreview(null); }}>
          <div className="modal-card" onClick={e => e.stopPropagation()}>
            <div className="modal-header">
              <h3>{isEditing ? "Edit Profile" : "Student Profile"}</h3>
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
                      {profilePic || picPreview ? "Change Photo" : "Add Photo"}
                    </button>
                    {(profilePic || picPreview) && (
                      <button type="button" className="pic-remove-btn" onClick={handleRemovePic}>Remove</button>
                    )}
                    <input ref={picInputRef} type="file" accept="image/*" style={{ display: "none" }} onChange={handlePicChange} />
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
                  <button type="submit" className="btn-save" disabled={saveLoading}>{saveLoading ? "Saving..." : "Save Changes"}</button>
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
                  { label: "Registration Number", value: student.registration_number },
                  { label: "DU Student Email", value: student.email },
                  { label: "Class Roll", value: student.class_roll },
                  { label: "Date of Birth", value: new Date(student.dob).toLocaleDateString("en-US", { month: "long", day: "numeric", year: "numeric" }) },
                  { label: "Gender", value: student.gender },
                  { label: "Phone Number", value: student.phone_number },
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
