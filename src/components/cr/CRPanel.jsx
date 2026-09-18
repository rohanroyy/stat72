import React, { useState, useEffect, useCallback, useMemo, useRef } from 'react';
import {
  fetchCRAnnouncements, postCRAnnouncement, deleteCRAnnouncement,
  fetchHolidays, addHoliday, updateHoliday, deleteHoliday,
  fetchTodayOverride, saveTodayOverride, clearTodayOverride,
  fetchWeekOverride, saveWeekOverride, resetWeekOverride,
  weekOverrideDaysLeft,
} from '../../services/crService';
import { DAYS_OF_WEEK, TIME_SLOTS, DEFAULT_ROUTINE } from '../../services/routineService';
import {
  fetchTodayConfirmations,
  getCourseClassTotals,
  confirmClass,
  unconfirmClass,
  subscribeToConfirmations,
} from '../../services/classConfirmationService';

// ── Constants ─────────────────────────────────────────────────────────────────
const CLASS_DAYS = DAYS_OF_WEEK.map(d => d.day);
const SUBJECT_OPTIONS = ['H 401','H 402','H 403','H-404','H-405','H 406','H-407','H 408'];

// Ordered list of all known subjects for the class count board
const ALL_SUBJECTS = ['H 401','H 402','H 403','H-404','H-405','H 406','H-407','H 408'];

function getTodayDayName() {
  return ['Sunday','Monday','Tuesday','Wednesday','Thursday','Friday','Saturday'][new Date().getDay()];
}
function getTodayStr() {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`;
}
function fmtDate(str) {
  if (!str) return '';
  try {
    return new Date(str + 'T00:00:00').toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
  } catch { return str; }
}
function fmtDateShort(str) {
  if (!str) return '';
  try {
    return new Date(str + 'T00:00:00').toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
  } catch { return str; }
}
function relTime(iso) {
  if (!iso) return '';
  const d = Date.now() - new Date(iso).getTime();
  const m = Math.floor(d / 60000);
  if (m < 1) return 'just now';
  if (m < 60) return `${m}m ago`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h}h ago`;
  return `${Math.floor(h/24)}d ago`;
}
function makeSlotId() {
  return `s_${Date.now()}_${Math.random().toString(36).slice(2,6)}`;
}
function getDefaultSlotsForDay(day) {
  return DEFAULT_ROUTINE.filter(r => r.day === day).sort((a,b) => (a.startTime||'').localeCompare(b.startTime||''));
}

/**
 * Format time "08:00" → "8:00 AM"
 */
function fmtTime(t) {
  if (!t) return '';
  const [h, m] = t.split(':').map(Number);
  const ampm = h >= 12 ? 'PM' : 'AM';
  const hh = h % 12 || 12;
  return `${hh}:${String(m).padStart(2,'0')} ${ampm}`;
}

/**
 * Returns true if the given endTime (HH:MM) has already passed for today.
 */
function isClassEnded(endTime) {
  if (!endTime) return false;
  const [h, m] = endTime.split(':').map(Number);
  const now = new Date();
  const end = new Date();
  end.setHours(h, m, 0, 0);
  return now >= end;
}

/**
 * Build confirmation items from today's routine slots.
 * Groups consecutive same-subject entries into a single item.
 * - 2 consecutive same-subject slots → class_count = 2 (double slot, e.g. 11:00-12:50)
 * - 1 slot alone → class_count = 1 (single, e.g. 11:00-11:50)
 */
function buildConfirmItems(routineList) {
  const today = getTodayDayName();
  const todaySlots = (routineList || [])
    .filter(r => r.day === today && r.subject)
    .sort((a, b) => (a.startTime || '').localeCompare(b.startTime || ''));

  const items = [];
  let i = 0;
  while (i < todaySlots.length) {
    const curr = todaySlots[i];
    const next = todaySlots[i + 1];
    // Double-slot: next slot exists AND has same subject AND starts after current ends
    if (next && next.subject === curr.subject) {
      items.push({
        subject: curr.subject,
        teacher: curr.teacher || '',
        room: curr.room || '',
        startTime: curr.startTime,
        endTime: next.endTime,
        slotKey: `${curr.startTime}-${next.endTime}`,
        defaultCount: 2,
        label: `${fmtTime(curr.startTime)} – ${fmtTime(next.endTime)}`,
        slots: [curr, next],
      });
      i += 2;
    } else {
      items.push({
        subject: curr.subject,
        teacher: curr.teacher || '',
        room: curr.room || '',
        startTime: curr.startTime,
        endTime: curr.endTime,
        slotKey: `${curr.startTime}-${curr.endTime}`,
        defaultCount: 1,
        label: `${fmtTime(curr.startTime)} – ${fmtTime(curr.endTime)}`,
        slots: [curr],
      });
      i += 1;
    }
  }
  return items;
}

// ── Minimal Icons (inline, no deps) ──────────────────────────────────────────
const Ico = {
  back: <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><polyline points="15 18 9 12 15 6"/></svg>,
  trash: <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polyline points="3 6 5 6 21 6"/><path d="M19 6v14a2 2 0 01-2 2H7a2 2 0 01-2-2V6m3 0V4a2 2 0 012-2h4a2 2 0 012 2v2"/></svg>,
  edit: <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M11 4H4a2 2 0 00-2 2v14a2 2 0 002 2h14a2 2 0 002-2v-7"/><path d="M18.5 2.5a2.121 2.121 0 013 3L12 15l-4 1 1-4 9.5-9.5z"/></svg>,
  plus: <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round"><line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/></svg>,
  check: <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round"><polyline points="20 6 9 17 4 12"/></svg>,
  x: <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>,
  chevDown: <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><polyline points="6 9 12 15 18 9"/></svg>,
  warn: <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/></svg>,
  announce: <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><path d="M4 13.5V10a2 2 0 0 1 2-2h2l7-4v16l-7-4H6a2 2 0 0 1-2-2.5Z"/><path d="M8 16l1 4h3"/></svg>,
  calendar: <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><rect x="3" y="4" width="18" height="17" rx="3"/><path d="M8 2v4M16 2v4M3 10h18"/></svg>,
  today: <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="9"/><path d="M12 7v5l3 2"/></svg>,
  week: <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><rect x="3" y="4" width="18" height="17" rx="3"/><path d="M3 10h18M8 2v4M16 2v4M8 14h.01M12 14h.01M16 14h.01M8 17h.01M12 17h.01"/></svg>,
  confirm: <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><path d="M9 11l3 3L22 4"/><path d="M21 12v7a2 2 0 01-2 2H5a2 2 0 01-2-2V5a2 2 0 012-2h11"/></svg>,
  clock: <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/></svg>,
  undo: <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polyline points="1 4 1 10 7 10"/><path d="M3.51 15a9 9 0 1 0 .49-3.96"/></svg>,
  book: <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><path d="M2 3h6a4 4 0 0 1 4 4v14a3 3 0 0 0-3-3H2z"/><path d="M22 3h-6a4 4 0 0 0-4 4v14a3 3 0 0 1 3-3h7z"/></svg>,
};

// ── Toast ─────────────────────────────────────────────────────────────────────
function Toast({ msg, type }) {
  if (!msg) return null;
  return (
    <div className={`cr2-toast cr2-toast-${type||'ok'}`}>
      {type === 'err' ? Ico.warn : Ico.check}
      <span>{msg}</span>
    </div>
  );
}

// ── Section Header ────────────────────────────────────────────────────────────
function SectionHead({ label, count }) {
  return (
    <div className="cr2-section-head">
      <span className="cr2-section-label">{label}</span>
      {count != null && <span className="cr2-section-count">{count}</span>}
    </div>
  );
}

// ── Collapsible accordion block ───────────────────────────────────────────────
function Accordion({ title, tag, children, defaultOpen = false }) {
  const [open, setOpen] = useState(defaultOpen);
  return (
    <div className={`cr2-accordion ${open ? 'cr2-accordion-open' : ''}`}>
      <button className="cr2-accordion-btn" onClick={() => setOpen(v => !v)}>
        <div className="cr2-accordion-left">
          <span className="cr2-accordion-tag">{tag}</span>
          <span className="cr2-accordion-title">{title}</span>
        </div>
        <span className={`cr2-accordion-arrow ${open ? 'open' : ''}`}>{Ico.chevDown}</span>
      </button>
      {open && <div className="cr2-accordion-body">{children}</div>}
    </div>
  );
}

// ── Slot Editor ───────────────────────────────────────────────────────────────
function SlotEditor({ day, currentSlots, baseSlots, onChange }) {
  const [menuOpen, setMenuOpen] = useState(false);
  const menuRef = useRef(null);
  useEffect(() => {
    if (!menuOpen) return;
    const fn = e => { if (menuRef.current && !menuRef.current.contains(e.target)) setMenuOpen(false); };
    document.addEventListener('mousedown', fn);
    return () => document.removeEventListener('mousedown', fn);
  }, [menuOpen]);

  const addSlot = ts => {
    const def = baseSlots.find(s => s.startTime === ts.start);
    const slot = def ? { ...def, id: makeSlotId() } : {
      id: makeSlotId(), day, dayIndex: DAYS_OF_WEEK.find(d=>d.day===day)?.dayIndex??0,
      timeSlot: `${ts.start.replace(':','.')}-${ts.end.replace(':','.')}`,
      startTime: ts.start, endTime: ts.end, subject:'', teacher:'', room:'', notes:'', sortOrder: TIME_SLOTS.findIndex(t=>t.id===ts.id),
    };
    onChange([...currentSlots, slot].sort((a,b)=>(a.startTime||'').localeCompare(b.startTime||'')));
    setMenuOpen(false);
  };

  const available = TIME_SLOTS.filter(t => !t.isLunch && !currentSlots.some(s => s.startTime === t.start));

  return (
    <div className="cr2-slot-editor">
      {currentSlots.length === 0 && (
        <p className="cr2-empty-msg">No classes. Use the button below to add slots.</p>
      )}
      {currentSlots.map((slot, i) => (
        <div className="cr2-slot-row" key={slot.id || i}>
          <div className="cr2-slot-time">
            {TIME_SLOTS.find(t => t.start === slot.startTime)?.label || slot.startTime}
          </div>
          <div className="cr2-slot-inputs">
            <select className="cr2-sel" value={slot.subject} onChange={e=>onChange(currentSlots.map((s,j)=>j===i?{...s,subject:e.target.value}:s))}>
              <option value="">No class</option>
              {SUBJECT_OPTIONS.map(s => <option key={s} value={s}>{s}</option>)}
            </select>
            <input className="cr2-inp" placeholder="Teacher" value={slot.teacher} onChange={e=>onChange(currentSlots.map((s,j)=>j===i?{...s,teacher:e.target.value}:s))} />
            <input className="cr2-inp" placeholder="Room" value={slot.room} onChange={e=>onChange(currentSlots.map((s,j)=>j===i?{...s,room:e.target.value}:s))} />
          </div>
          <button className="cr2-slot-del" onClick={()=>onChange(currentSlots.filter((_,j)=>j!==i))} aria-label="Remove">×</button>
        </div>
      ))}
      <div className="cr2-add-slot-wrap" ref={menuRef}>
        <button className="cr2-add-slot-btn" onClick={() => setMenuOpen(v=>!v)}>
          {Ico.plus} Add time slot
        </button>
        {menuOpen && (
          <div className="cr2-slot-menu">
            {available.length === 0
              ? <div className="cr2-slot-menu-none">All slots added</div>
              : available.map(ts => (
                <button key={ts.id} className="cr2-slot-menu-item" onClick={() => addSlot(ts)}>
                  {ts.label}
                </button>
              ))
            }
          </div>
        )}
      </div>
    </div>
  );
}

// ── ANNOUNCEMENT SECTION ──────────────────────────────────────────────────────
function AnnouncementSection({ crStudent }) {
  const [title, setTitle] = useState('');
  const [body, setBody] = useState('');
  const [list, setList] = useState([]);
  const [posting, setPosting] = useState(false);
  const [toast, setToast] = useState({ msg:'', type:'' });

  const flash = (msg, type='ok') => { setToast({msg,type}); setTimeout(()=>setToast({msg:'',type:''}),3000); };

  useEffect(() => { fetchCRAnnouncements().then(setList).catch(console.error); }, []);

  const submit = async e => {
    e.preventDefault();
    if (!title.trim()) return;
    setPosting(true);
    try {
      const updated = await postCRAnnouncement({ title, body, crStudent });
      setList(updated); setTitle(''); setBody('');
      flash('Posted — all students notified');
    } catch(err) { flash(err.message||'Failed', 'err'); }
    finally { setPosting(false); }
  };

  const del = async id => {
    const updated = await deleteCRAnnouncement(id);
    setList(updated); flash('Deleted');
  };

  return (
    <div className="cr2-section-body">
      <form className="cr2-form" onSubmit={submit}>
        <input className="cr2-input" value={title} onChange={e=>setTitle(e.target.value)}
          placeholder="Announcement title…" maxLength={120} required />
        <textarea className="cr2-textarea" value={body} onChange={e=>setBody(e.target.value)}
          placeholder="Details (optional)" rows={3} maxLength={500} />
        <Toast msg={toast.msg} type={toast.type} />
        <button className="cr2-btn-primary" type="submit" disabled={posting || !title.trim()}>
          {posting ? 'Posting…' : 'Post to all students'}
        </button>
      </form>

      {list.length > 0 && (
        <>
          <SectionHead label="Posted" count={list.length} />
          <div className="cr2-list">
            {list.map(a => (
              <div className="cr2-list-row" key={a.id}>
                <div className="cr2-list-row-main">
                  <p className="cr2-list-row-title">{a.title}</p>
                  {a.body && <p className="cr2-list-row-sub">{a.body}</p>}
                  <span className="cr2-list-row-meta">{relTime(a.created_at)}</span>
                </div>
                <button className="cr2-icon-btn cr2-icon-btn-del" onClick={()=>del(a.id)} aria-label="Delete">{Ico.trash}</button>
              </div>
            ))}
          </div>
        </>
      )}
    </div>
  );
}

// ── HOLIDAY SECTION ───────────────────────────────────────────────────────────
function HolidaySection() {
  const [list, setList] = useState([]);
  const [loading, setLoading] = useState(true);
  const [form, setForm] = useState({ type: 'single', date: '', startDate: '', endDate: '', label: '', note: '' });
  const [editId, setEditId] = useState(null);
  const [saving, setSaving] = useState(false);
  const [toast, setToast] = useState({ msg:'', type:'' });

  const flash = (msg, type='ok') => { setToast({msg,type}); setTimeout(()=>setToast({msg:'',type:''}),3000); };

  useEffect(() => { fetchHolidays().then(setList).catch(console.error).finally(()=>setLoading(false)); }, []);

  const resetForm = () => { setForm({ type:'single', date:'', startDate:'', endDate:'', label:'', note:'' }); setEditId(null); };

  const submit = async e => {
    e.preventDefault();
    const isSingle = form.type === 'single';
    const date = isSingle ? form.date : form.startDate;
    const endDate = isSingle ? form.date : form.endDate;
    if (!date || !form.label.trim()) return;
    if (!isSingle && form.endDate < form.startDate) { flash('End date must be after start date', 'err'); return; }
    setSaving(true);
    try {
      let updated;
      const payload = { date, endDate, label: form.label, note: form.note, isRange: !isSingle };
      if (editId) {
        updated = await updateHoliday(editId, payload);
        flash('Updated');
      } else {
        updated = await addHoliday(payload);
        flash('Holiday added');
      }
      setList(updated); resetForm();
    } catch(err) { flash(err.message||'Failed','err'); }
    finally { setSaving(false); }
  };

  const startEdit = h => {
    setEditId(h.id);
    const isRange = !!h.isRange;
    setForm({
      type: isRange ? 'range' : 'single',
      date: isRange ? '' : (h.date || ''),
      startDate: isRange ? (h.date || '') : '',
      endDate: isRange ? (h.endDate || '') : '',
      label: h.label || '',
      note: h.note || '',
    });
  };

  const del = async id => {
    const updated = await deleteHoliday(id);
    setList(updated); flash('Deleted');
  };

  const dayCount = h => {
    if (!h.isRange || !h.endDate || !h.date) return null;
    const diff = (new Date(h.endDate) - new Date(h.date)) / 86400000;
    return Math.round(diff) + 1;
  };

  return (
    <div className="cr2-section-body">
      <form className="cr2-form" onSubmit={submit}>
        <div className="cr2-toggle-row">
          <button type="button"
            className={`cr2-toggle-btn ${form.type === 'single' ? 'active' : ''}`}
            onClick={() => setForm(f => ({ ...f, type: 'single' }))}
          >Single day</button>
          <button type="button"
            className={`cr2-toggle-btn ${form.type === 'range' ? 'active' : ''}`}
            onClick={() => setForm(f => ({ ...f, type: 'range' }))}
          >Vacation / Range</button>
        </div>

        {form.type === 'single' ? (
          <div className="cr2-form-row">
            <div className="cr2-field">
              <span className="cr2-field-label">Date</span>
              <input className="cr2-input" type="date" value={form.date} onChange={e=>setForm(f=>({...f,date:e.target.value}))} required />
            </div>
            <div className="cr2-field cr2-field-grow">
              <span className="cr2-field-label">Name</span>
              <input className="cr2-input" value={form.label} onChange={e=>setForm(f=>({...f,label:e.target.value}))} placeholder="e.g. Eid al-Fitr" maxLength={80} required />
            </div>
          </div>
        ) : (
          <>
            <div className="cr2-form-row">
              <div className="cr2-field">
                <span className="cr2-field-label">From</span>
                <input className="cr2-input" type="date" value={form.startDate} onChange={e=>setForm(f=>({...f,startDate:e.target.value}))} required />
              </div>
              <div className="cr2-field">
                <span className="cr2-field-label">To</span>
                <input className="cr2-input" type="date" value={form.endDate} min={form.startDate} onChange={e=>setForm(f=>({...f,endDate:e.target.value}))} required />
              </div>
            </div>
            <div className="cr2-field">
              <span className="cr2-field-label">Vacation name</span>
              <input className="cr2-input" value={form.label} onChange={e=>setForm(f=>({...f,label:e.target.value}))} placeholder="e.g. Winter Break" maxLength={80} required />
            </div>
          </>
        )}

        <input className="cr2-input cr2-input-muted" value={form.note} onChange={e=>setForm(f=>({...f,note:e.target.value}))} placeholder="Note (optional)" maxLength={200} />

        <Toast msg={toast.msg} type={toast.type} />
        <div className="cr2-btn-row">
          <button className="cr2-btn-primary" type="submit" disabled={saving}>
            {saving ? 'Saving…' : (editId ? 'Update' : '+ Add holiday')}
          </button>
          {editId && <button className="cr2-btn-ghost" type="button" onClick={resetForm}>Cancel</button>}
        </div>
      </form>

      {loading ? (
        <div className="cr2-loading">Loading…</div>
      ) : list.length === 0 ? (
        <p className="cr2-empty-msg">No holidays added yet.</p>
      ) : (
        <>
          <SectionHead label="Holidays" count={list.length} />
          <div className="cr2-list">
            {list.map(h => {
              const dc = dayCount(h);
              return (
                <div className="cr2-list-row" key={h.id}>
                  <div className="cr2-hol-stripe" />
                  <div className="cr2-list-row-main">
                    <div className="cr2-hol-top">
                      <p className="cr2-list-row-title">{h.label}</p>
                      {h.isRange && dc && <span className="cr2-hol-range-badge">{dc}d</span>}
                    </div>
                    <span className="cr2-list-row-meta">
                      {h.isRange && h.endDate
                        ? `${fmtDateShort(h.date)} – ${fmtDateShort(h.endDate)}`
                        : fmtDate(h.date)
                      }
                      {h.note && ` · ${h.note}`}
                    </span>
                  </div>
                  <div className="cr2-row-actions">
                    <button className="cr2-icon-btn" onClick={()=>startEdit(h)} aria-label="Edit">{Ico.edit}</button>
                    <button className="cr2-icon-btn cr2-icon-btn-del" onClick={()=>del(h.id)} aria-label="Delete">{Ico.trash}</button>
                  </div>
                </div>
              );
            })}
          </div>
        </>
      )}
    </div>
  );
}

// ── TODAY SCHEDULE SECTION ────────────────────────────────────────────────────
function TodaySection({ crStudent, routineList, onSaved }) {
  const todayDay = getTodayDayName();
  const isClassDay = CLASS_DAYS.includes(todayDay);

  const buildSlots = useCallback(() => {
    const from = (routineList||[]).filter(r=>r.day===todayDay).sort((a,b)=>(a.startTime||'').localeCompare(b.startTime||''));
    return (from.length ? from : getDefaultSlotsForDay(todayDay)).map(r=>({...r,id:makeSlotId()}));
  }, [routineList, todayDay]);

  const [slots, setSlots] = useState(buildSlots);
  const [override, setOverride] = useState(null);
  const [saving, setSaving] = useState(false);
  const [toast, setToast] = useState({ msg:'', type:'' });
  const flash = (msg,type='ok') => { setToast({msg,type}); setTimeout(()=>setToast({msg:'',type:''}),4000); };

  useEffect(() => {
    fetchTodayOverride().then(d => {
      if (d) { setOverride(d); setSlots(d.slots.map(s=>({...s,id:makeSlotId()}))); }
    }).catch(console.error);
  }, []);

  const save = async () => {
    setSaving(true);
    try {
      const clean = slots.filter(s => s.subject);
      const r = await saveTodayOverride(clean, todayDay, crStudent);
      setOverride(r); flash('Saved — students notified'); onSaved?.();
    } catch(err) { flash(err.message||'Failed','err'); }
    finally { setSaving(false); }
  };

  const reset = async () => {
    if (!window.confirm(`Reset today's schedule to default?`)) return;
    await clearTodayOverride();
    setOverride(null); setSlots(buildSlots()); flash('Reset to default'); onSaved?.();
  };

  if (!isClassDay) {
    return (
      <div className="cr2-section-body">
        <p className="cr2-empty-msg" style={{textAlign:'center',padding:'16px 0'}}>{todayDay} is not a class day.</p>
      </div>
    );
  }

  return (
    <div className="cr2-section-body">
      {override && (
        <div className="cr2-override-bar">
          <span>Override active</span>
          <button className="cr2-override-reset" onClick={reset}>Reset</button>
        </div>
      )}
      <div className="cr2-day-label">Editing <strong>{todayDay}</strong> — today</div>
      <SlotEditor day={todayDay} currentSlots={slots} baseSlots={getDefaultSlotsForDay(todayDay)} onChange={setSlots} />
      <Toast msg={toast.msg} type={toast.type} />
      <button className="cr2-btn-primary cr2-btn-full" onClick={save} disabled={saving}>
        {saving ? 'Saving…' : 'Save & notify students'}
      </button>
    </div>
  );
}

// ── WEEK SCHEDULE SECTION ─────────────────────────────────────────────────────
function WeekSection({ crStudent, routineList, onSaved }) {
  const defaultDay = () => { const t = getTodayDayName(); return CLASS_DAYS.includes(t) ? t : 'Sunday'; };
  const [day, setDay] = useState(defaultDay);
  const [edits, setEdits] = useState({});
  const [weekOverride, setWeekOverride] = useState(null);
  const [saving, setSaving] = useState(false);
  const [toast, setToast] = useState({ msg:'', type:'' });
  const flash = (msg,type='ok') => { setToast({msg,type}); setTimeout(()=>setToast({msg:'',type:''}),4000); };

  useEffect(() => {
    fetchWeekOverride().then(d => {
      if (d) {
        setWeekOverride(d);
        const pre = {};
        Object.entries(d.days||{}).forEach(([k,v]) => { pre[k] = v.map(s=>({...s,id:makeSlotId()})); });
        setEdits(pre);
      }
    }).catch(console.error);
  }, []);

  const getSlots = d => {
    if (edits[d]) return edits[d];
    const from = (routineList||[]).filter(r=>r.day===d).sort((a,b)=>(a.startTime||'').localeCompare(b.startTime||''));
    return (from.length ? from : getDefaultSlotsForDay(d)).map(s=>({...s,id:makeSlotId()}));
  };

  const save = async () => {
    if (!Object.keys(edits).length) { flash('No changes yet', 'err'); return; }
    setSaving(true);
    try {
      const clean = {};
      Object.entries(edits).forEach(([d,slots]) => {
        clean[d] = slots.filter(s=>s.subject).map(({id,...r})=>({...r, id:`cw_${d.slice(0,3).toLowerCase()}_${r.startTime?.replace(':','')||Date.now()}`}));
      });
      const r = await saveWeekOverride(clean, crStudent);
      setWeekOverride(r); flash('Week saved — students notified'); onSaved?.();
    } catch(err) { flash(err.message||'Failed','err'); }
    finally { setSaving(false); }
  };

  const reset = async () => {
    if (!window.confirm(`Reset week to default schedule?`)) return;
    await resetWeekOverride();
    setWeekOverride(null); setEdits({}); flash('Reset to default'); onSaved?.();
  };

  const daysLeft = weekOverride ? weekOverrideDaysLeft(weekOverride) : null;

  return (
    <div className="cr2-section-body">
      {weekOverride && (
        <div className="cr2-override-bar">
          <span>Override active · resets in {daysLeft}d</span>
          <button className="cr2-override-reset" onClick={reset}>Reset now</button>
        </div>
      )}

      <div className="cr2-day-strip">
        {CLASS_DAYS.map(d => (
          <button key={d}
            className={`cr2-day-pill ${d===day?'active':''} ${edits[d]?'edited':''}`}
            onClick={()=>setDay(d)}
          >
            {d.slice(0,3)}
            {edits[d] && <span className="cr2-day-dot"/>}
          </button>
        ))}
      </div>

      <SlotEditor day={day} currentSlots={getSlots(day)} baseSlots={getDefaultSlotsForDay(day)}
        onChange={s => setEdits(prev=>({...prev,[day]:s}))} />
      <Toast msg={toast.msg} type={toast.type} />
      <button className="cr2-btn-primary cr2-btn-full" onClick={save} disabled={saving}>
        {saving ? 'Saving…' : 'Save week & notify students'}
      </button>
    </div>
  );
}

// ── CONFIRM SECTION ───────────────────────────────────────────────────────────
function ConfirmSection({ crStudent, routineList }) {
  const [subTab, setSubTab] = useState('today'); // 'today' | 'totals'
  const [confirmations, setConfirmations] = useState([]);
  const [totals, setTotals] = useState({});
  const [loading, setLoading] = useState(true);
  const [totalsLoading, setTotalsLoading] = useState(true);
  // Per-item class count override: slotKey → 1 | 2
  const [countOverrides, setCountOverrides] = useState({});
  // Loading state per item
  const [busy, setBusy] = useState({});
  const [toast, setToast] = useState({ msg:'', type:'' });

  const flash = (msg, type='ok') => { setToast({msg,type}); setTimeout(()=>setToast({msg:'',type:''}),3500); };

  const today = getTodayStr();
  const todayDay = getTodayDayName();
  const isClassDay = CLASS_DAYS.includes(todayDay);

  // Build all confirmation items from today's effective routine
  const allItems = useMemo(() => buildConfirmItems(routineList), [routineList]);

  // Split into ended (confirmable) and upcoming
  const endedItems = useMemo(() => allItems.filter(item => isClassEnded(item.endTime)), [allItems]);
  const upcomingItems = useMemo(() => allItems.filter(item => !isClassEnded(item.endTime)), [allItems]);

  // Load confirmations for today
  const loadConfirmations = useCallback(async () => {
    try {
      const confs = await fetchTodayConfirmations();
      setConfirmations(confs);
    } catch (e) {
      console.error('[ConfirmSection] loadConfirmations:', e);
    } finally {
      setLoading(false);
    }
  }, []);

  // Load totals
  const loadTotals = useCallback(async () => {
    setTotalsLoading(true);
    try {
      const t = await getCourseClassTotals();
      setTotals(t);
    } catch (e) {
      console.error('[ConfirmSection] loadTotals:', e);
    } finally {
      setTotalsLoading(false);
    }
  }, []);

  useEffect(() => {
    loadConfirmations();
    loadTotals();
    // Subscribe to realtime changes
    const unsub = subscribeToConfirmations(() => {
      loadConfirmations();
      loadTotals();
    });
    return unsub;
  }, [loadConfirmations, loadTotals]);

  // Look up if an item is confirmed
  const getConfirmation = (slotKey) => confirmations.find(c => c.slot_key === slotKey) || null;
  const isConfirmed = (slotKey) => confirmations.some(c => c.slot_key === slotKey);

  const handleConfirm = async (item) => {
    const count = countOverrides[item.slotKey] ?? item.defaultCount;
    setBusy(p => ({ ...p, [item.slotKey]: true }));
    try {
      await confirmClass({
        date: today,
        subject: item.subject,
        slotKey: item.slotKey,
        startTime: item.startTime,
        endTime: item.endTime,
        classCount: count,
        crStudent,
      });
      await loadConfirmations();
      await loadTotals();
      flash(`${item.subject} confirmed ✓`);
    } catch (e) {
      flash(e.message || 'Failed to confirm', 'err');
    } finally {
      setBusy(p => ({ ...p, [item.slotKey]: false }));
    }
  };

  const handleUnconfirm = async (item) => {
    setBusy(p => ({ ...p, [item.slotKey]: true }));
    try {
      await unconfirmClass(today, item.subject, item.slotKey);
      await loadConfirmations();
      await loadTotals();
      flash('Confirmation removed');
    } catch (e) {
      flash(e.message || 'Failed', 'err');
    } finally {
      setBusy(p => ({ ...p, [item.slotKey]: false }));
    }
  };

  const toggleCount = (slotKey, defaultCount) => {
    setCountOverrides(p => {
      const current = p[slotKey] ?? defaultCount;
      return { ...p, [slotKey]: current === 2 ? 1 : 2 };
    });
  };

  // Max total for bar chart
  const maxTotal = Math.max(1, ...Object.values(totals));

  return (
    <div className="cr2-section-body cr-confirm-section">
      {/* Sub-tab switcher */}
      <div className="cr-confirm-subtab-row">
        <button
          className={`cr-confirm-subtab ${subTab === 'today' ? 'active' : ''}`}
          onClick={() => setSubTab('today')}
        >
          {Ico.clock}
          <span>Today's Classes</span>
        </button>
        <button
          className={`cr-confirm-subtab ${subTab === 'totals' ? 'active' : ''}`}
          onClick={() => setSubTab('totals')}
        >
          {Ico.book}
          <span>Class Count</span>
        </button>
      </div>

      <Toast msg={toast.msg} type={toast.type} />

      {/* ── TODAY'S CLASSES ── */}
      {subTab === 'today' && (
        <div className="cr-confirm-today">
          {!isClassDay ? (
            <div className="cr-confirm-empty">
              <div className="cr-confirm-empty-icon">📅</div>
              <p>{todayDay} is not a class day.</p>
            </div>
          ) : loading ? (
            <div className="cr2-loading">Loading today's classes…</div>
          ) : allItems.length === 0 ? (
            <div className="cr-confirm-empty">
              <div className="cr-confirm-empty-icon">📭</div>
              <p>No classes scheduled for today.</p>
              <span>Check the Today / Week tabs to set today's schedule.</span>
            </div>
          ) : (
            <>
              {/* Ended classes — confirmable */}
              {endedItems.length > 0 && (
                <>
                  <SectionHead label="Ended — ready to confirm" count={endedItems.length} />
                  <div className="cr-confirm-list">
                    {endedItems.map(item => {
                      const confirmed = isConfirmed(item.slotKey);
                      const conf = getConfirmation(item.slotKey);
                      const isBusy = busy[item.slotKey];
                      const displayCount = confirmed
                        ? (conf?.class_count ?? item.defaultCount)
                        : (countOverrides[item.slotKey] ?? item.defaultCount);

                      return (
                        <div
                          key={item.slotKey}
                          className={`cr-confirm-card ${confirmed ? 'cr-confirm-card-confirmed' : ''}`}
                        >
                          <div className="cr-confirm-card-header">
                            <div className="cr-confirm-card-left">
                              <span className="cr-confirm-subject">{item.subject}</span>
                              <span className="cr-confirm-time">{item.label}</span>
                              {item.teacher && <span className="cr-confirm-meta">{item.teacher}{item.room ? ` · ${item.room}` : ''}</span>}
                            </div>
                            <div className="cr-confirm-card-right">
                              {/* Class count badge + toggle */}
                              <button
                                className={`cr-confirm-count-badge ${displayCount === 2 ? 'double' : 'single'}`}
                                onClick={() => !confirmed && toggleCount(item.slotKey, item.defaultCount)}
                                disabled={confirmed}
                                title={confirmed ? 'Already confirmed — undo to change' : `Click to toggle: currently ${displayCount} class${displayCount > 1 ? 'es' : ''}`}
                                aria-label={`Class count: ${displayCount}. ${confirmed ? 'Confirmed' : 'Tap to toggle'}`}
                              >
                                ×{displayCount}
                              </button>
                            </div>
                          </div>

                          {confirmed && conf?.confirmed_by_name && (
                            <div className="cr-confirm-by">
                              {Ico.check}
                              <span>Confirmed by {conf.confirmed_by_name} · {relTime(conf.confirmed_at)}</span>
                            </div>
                          )}

                          <div className="cr-confirm-actions">
                            {confirmed ? (
                              <button
                                className="cr-confirm-undo-btn"
                                onClick={() => handleUnconfirm(item)}
                                disabled={isBusy}
                              >
                                {isBusy ? 'Undoing…' : <>{Ico.undo} Undo</>}
                              </button>
                            ) : (
                              <button
                                className="cr-confirm-btn"
                                onClick={() => handleConfirm(item)}
                                disabled={isBusy}
                              >
                                {isBusy ? 'Confirming…' : <>{Ico.check} Confirm class</>}
                              </button>
                            )}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </>
              )}

              {/* Upcoming classes — not yet ended */}
              {upcomingItems.length > 0 && (
                <>
                  <SectionHead label="Upcoming — not ended yet" count={upcomingItems.length} />
                  <div className="cr-confirm-list">
                    {upcomingItems.map(item => (
                      <div key={item.slotKey} className="cr-confirm-card cr-confirm-card-upcoming">
                        <div className="cr-confirm-card-header">
                          <div className="cr-confirm-card-left">
                            <span className="cr-confirm-subject">{item.subject}</span>
                            <span className="cr-confirm-time">{item.label}</span>
                            {item.teacher && <span className="cr-confirm-meta">{item.teacher}{item.room ? ` · ${item.room}` : ''}</span>}
                          </div>
                          <span className={`cr-confirm-count-badge ${item.defaultCount === 2 ? 'double' : 'single'} muted`}>
                            ×{item.defaultCount}
                          </span>
                        </div>
                        <div className="cr-upcoming-note">
                          {Ico.clock}
                          <span>Ends at {fmtTime(item.endTime)} — will be available for confirmation then</span>
                        </div>
                      </div>
                    ))}
                  </div>
                </>
              )}

              {endedItems.length === 0 && upcomingItems.length > 0 && (
                <div className="cr-confirm-empty" style={{ marginTop: '8px' }}>
                  <p style={{ fontSize: '13px', color: 'var(--text-tertiary)' }}>
                    No classes have ended yet today. Come back after {fmtTime(upcomingItems[0]?.endTime)}.
                  </p>
                </div>
              )}
            </>
          )}
        </div>
      )}

      {/* ── CLASS COUNT BOARD ── */}
      {subTab === 'totals' && (
        <div className="cr-confirm-totals">
          <p className="cr-totals-desc">
            Total classes confirmed per course across all dates.
          </p>
          {totalsLoading ? (
            <div className="cr2-loading">Loading totals…</div>
          ) : (
            <div className="cr-totals-grid">
              {ALL_SUBJECTS.map(subject => {
                const count = totals[subject] || 0;
                const pct = maxTotal > 0 ? (count / maxTotal) * 100 : 0;
                return (
                  <div key={subject} className="cr-totals-card">
                    <div className="cr-totals-card-top">
                      <span className="cr-totals-subject">{subject}</span>
                      <span className="cr-totals-count">{count}</span>
                    </div>
                    <div className="cr-totals-bar-track">
                      <div
                        className="cr-totals-bar-fill"
                        style={{ width: `${pct}%` }}
                      />
                    </div>
                    <span className="cr-totals-label">
                      {count === 0 ? 'No classes confirmed yet' : `${count} class${count !== 1 ? 'es' : ''} held`}
                    </span>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}
    </div>
  );
}

// ── ROOT CR PANEL ─────────────────────────────────────────────────────────────
export default function CRPanel({ crStudent, routineList = [], onBack, onOverrideSaved }) {
  const initials = (crStudent?.name||'CR').split(' ').map(n=>n[0]).join('').slice(0,2).toUpperCase();
  const [avatarError, setAvatarError] = useState(false);
  const avatarUrl = crStudent?.profile_picture || crStudent?.avatar || (() => {
    try {
      return localStorage.getItem('bahattor_profile_pic_' + crStudent?.id) || null;
    } catch {
      return null;
    }
  })();

  useEffect(() => {
    setAvatarError(false);
  }, [crStudent?.profile_picture, crStudent?.id]);

  const [activeTool, setActiveTool] = useState('announcement');
  const tools = [
    { id: 'announcement', label: 'Announce', icon: Ico.announce },
    { id: 'holiday', label: 'Holidays', icon: Ico.calendar },
    { id: 'today', label: 'Today', icon: Ico.today },
    { id: 'week', label: 'Week', icon: Ico.week },
    { id: 'confirm', label: 'Confirm', icon: Ico.confirm },
  ];
  const activeLabel = tools.find(tool => tool.id === activeTool)?.label;

  return (
    <div className="cr2-root cr3-root">
      <header className="cr2-topbar cr3-topbar">
        <button className="cr2-topbar-back" onClick={onBack} aria-label="Back">{Ico.back}</button>
        <div className="cr2-topbar-center">
          <span className="cr3-topbar-kicker">Class representative</span>
          <span className="cr2-topbar-title">Control centre</span>
        </div>
        {avatarUrl && !avatarError ? (
          <img
            src={avatarUrl}
            alt={crStudent?.name || 'CR'}
            className="cr2-topbar-avatar cr2-topbar-avatar-img"
            onError={() => setAvatarError(true)}
          />
        ) : (
          <div className="cr2-topbar-avatar" aria-hidden="true">{initials}</div>
        )}
      </header>
      <main className="cr3-shell">
        <nav className="cr3-tool-nav" aria-label="CR tools">
          {tools.map(tool => <button key={tool.id} className={`cr3-tool ${activeTool === tool.id ? 'is-active' : ''}`} onClick={() => setActiveTool(tool.id)} aria-current={activeTool === tool.id ? 'page' : undefined}><span>{tool.icon}</span><b>{tool.label}</b></button>)}
        </nav>
        <section className="cr3-workspace">
          <div className="cr3-workspace-head"><h1>{activeLabel}</h1></div>
          <div className="cr3-workspace-body">
            {activeTool === 'announcement' && <AnnouncementSection crStudent={crStudent} />}
            {activeTool === 'holiday' && <HolidaySection />}
            {activeTool === 'today' && <TodaySection crStudent={crStudent} routineList={routineList} onSaved={onOverrideSaved} />}
            {activeTool === 'week' && <WeekSection crStudent={crStudent} routineList={routineList} onSaved={onOverrideSaved} />}
            {activeTool === 'confirm' && <ConfirmSection crStudent={crStudent} routineList={routineList} />}
          </div>
        </section>
      </main>
    </div>
  );
}
