import React, { useMemo, useState } from 'react';
import { SUBJECT_META, getSubjectMeta } from '../explore/ClassCountPanel';

const DAYS = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday'];
const TIMES = ['8.00-8.50', '9.00-9.50', '10.00-10.50', '11.00-11.50', '12.00-12.50', '1.00-2.00', '2.00-2.50', '3.00-3.50'];
const SUBJECT_TONES = { 'H-401': 'blue', 'H-402': 'violet', 'H-403': 'violet', 'H-404': 'coral', 'H-405': 'gold', 'H-406': 'rose', 'H-407': 'blue', 'H-408': 'coral' };

export function formatRoutineTime(timeStr) {
  if (!timeStr) return '';
  const parts = String(timeStr).split('-');
  if (parts.length !== 2) return timeStr;
  const to12h = (s) => {
    const [h, m = '00'] = s.trim().split('.');
    let hour = parseInt(h, 10);
    if (isNaN(hour)) return s.trim();
    const isPM = hour === 12 || (hour >= 1 && hour <= 6);
    return `${hour}:${m.padStart(2, '0')} ${isPM ? 'PM' : 'AM'}`;
  };
  return `${to12h(parts[0])} – ${to12h(parts[1])}`;
}

const DEFAULT_SCHEDULE = {
  Sunday: [null, null, { code: 'H-406', room: '402', teacher: 'JAK' }, { code: 'H-405', room: '402', teacher: 'MI' }, { code: 'H-405', room: '402', teacher: 'MI' }, 'break', null, null],
  Monday: [null, null, { code: 'H-402', room: '402', teacher: 'FA' }, { code: 'H-401', room: '436', teacher: 'BH' }, { code: 'H-401', room: '436', teacher: 'BH' }, 'break', { code: 'H-408', room: '401', teacher: 'JHK' }, { code: 'H-408', room: '401', teacher: 'JHK' }],
  Tuesday: [{ code: 'H-405', room: '402', teacher: 'MI' }, { code: 'H-404', room: '402', teacher: 'KKS' }, { code: 'H-404', room: '402', teacher: 'KKS' }, { code: 'H-406', room: '406', teacher: 'JAK' }, { code: 'H-403', room: '427', teacher: 'FTZ' }, 'break', { code: 'H-407', room: '402', teacher: 'NS' }, null],
  Wednesday: [null, { code: 'H-402', room: '402', teacher: 'FA' }, { code: 'H-408', room: '402', teacher: 'JHK' }, { code: 'H-401', room: '402', teacher: 'BH' }, { code: 'H-403', room: '427', teacher: 'FTZ' }, 'break', { code: 'H-403', room: '427', teacher: 'FTZ' }, null],
  Thursday: [null, { code: 'H-404', room: '402', teacher: 'KKS' }, { code: 'H-404', room: '402', teacher: 'KKS' }, { code: 'H-407', room: '402', teacher: 'NS' }, { code: 'H-407', room: '402', teacher: 'NS' }, 'break', null, null],
};

const norm = (value = '') => value.replace(/[\s-]/g, '').toLowerCase();
const sameClass = (a, b) => a && b && a !== 'break' && b !== 'break' && norm(a.code) === norm(b.code) && String(a.room || '').replace(/^r\.?\s*/i, '').toLowerCase() === String(b.room || '').replace(/^r\.?\s*/i, '').toLowerCase() && String(a.teacher || '').toLowerCase() === String(b.teacher || '').toLowerCase();
const toneFor = (code = '') => SUBJECT_TONES[Object.keys(SUBJECT_TONES).find((item) => norm(item) === norm(code))] || 'coral';
function mergeDay(slots) {
  const result = [];
  for (let index = 0; index < slots.length;) {
    const item = slots[index];
    if (!item) { index += 1; continue; }
    if (item === 'break') { result.push({ type: 'break', time: TIMES[index], index }); index += 1; continue; }
    let end = index;
    while (end + 1 < slots.length && sameClass(item, slots[end + 1])) end += 1;
    result.push({ ...item, type: 'class', start: index, end, time: end === index ? TIMES[index] : `${TIMES[index].split('-')[0]}-${TIMES[end].split('-')[1]}`, tone: toneFor(item.code) });
    index = end + 1;
  }
  return result;
}
function parseTime(time) { return time.split('-').map((value) => { const [rawHour, rawMinute = '0'] = value.trim().split('.'); let hour = Number(rawHour); if (hour >= 1 && hour <= 5) hour += 12; return hour * 60 + Number(rawMinute); }); }

/** Given a day name, return the nearest date (today or next occurrence) as a YYYY-MM-DD string. */
function getDateStrForDayName(dayName) {
  const dayIndex = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'].indexOf(dayName);
  if (dayIndex === -1) return null;
  const now = new Date();
  const diff = (dayIndex - now.getDay() + 7) % 7;
  const target = new Date(now);
  target.setDate(now.getDate() + diff);
  return `${target.getFullYear()}-${String(target.getMonth() + 1).padStart(2, '0')}-${String(target.getDate()).padStart(2, '0')}`;
}

/** Check if a YYYY-MM-DD date falls on any holiday. */
function findHolidayForDate(dateStr, holidays) {
  if (!dateStr || !holidays.length) return null;
  return holidays.find(h => {
    if (!h.date) return false;
    if (h.isRange && h.endDate) return dateStr >= h.date && dateStr <= h.endDate;
    return dateStr === h.date;
  }) || null;
}

const CalendarIcon = () => <svg viewBox="0 0 24 24" aria-hidden="true"><rect x="3" y="4" width="18" height="17" rx="3" /><path d="M8 2v4M16 2v4M3 10h18" /></svg>;
const GridIcon = () => <svg viewBox="0 0 24 24" aria-hidden="true"><rect x="3" y="3" width="7" height="7" rx="1" /><rect x="14" y="3" width="7" height="7" rx="1" /><rect x="3" y="14" width="7" height="7" rx="1" /><rect x="14" y="14" width="7" height="7" rx="1" /></svg>;
const PinIcon = () => <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M20 10c0 5.5-8 12-8 12S4 15.5 4 10a8 8 0 1 1 16 0Z" /><circle cx="12" cy="10" r="2.5" /></svg>;
const UserIcon = () => <svg viewBox="0 0 24 24" aria-hidden="true"><circle cx="12" cy="7" r="4" /><path d="M4 21c.7-4 3.3-6 8-6s7.3 2 8 6" /></svg>;
const ChevronIcon = () => <svg viewBox="0 0 24 24" aria-hidden="true"><path d="m9 18 6-6-6-6" /></svg>;

function buildSchedule(items) {
  if (!items || !items.length) return DEFAULT_SCHEDULE;
  const startIndex = {
    '08:00': 0, '8:00': 0, '8.00': 0, '08:00:00': 0, '8:00:00': 0,
    '09:00': 1, '9:00': 1, '9.00': 1, '09:00:00': 1, '9:00:00': 1,
    '10:00': 2, '10.00': 2, '10:00:00': 2,
    '11:00': 3, '11.00': 3, '11:00:00': 3,
    '12:00': 4, '12.00': 4, '12:00:00': 4,
    '13:00': 5, '1:00': 5, '1.00': 5, '13:00:00': 5, '01:00:00': 5, '1:00:00': 5,
    '14:00': 6, '2:00': 6, '2.00': 6, '14:00:00': 6, '02:00:00': 6, '2:00:00': 6,
    '15:00': 7, '3:00': 7, '3.00': 7, '15:00:00': 7, '03:00:00': 7, '3:00:00': 7,
  };
  const slotIndexMap = {
    '8.00-8.50': 0, '8:00-8:50': 0, '8:00 - 8:50': 0,
    '9.00-9.50': 1, '9:00-9:50': 1, '9:00 - 9:50': 1,
    '10.00-10.50': 2, '10:00-10:50': 2, '10:00 - 10:50': 2,
    '11.00-11.50': 3, '11:00-11:50': 3, '11:00 - 11:50': 3,
    '12.00-12.50': 4, '12:00-12.50': 4, '12:00 - 12:50': 4,
    '1.00-2.00': 5, '1:00-2:00': 5, '1:00 - 2:00': 5,
    '2.00-2.50': 6, '2:00-2:50': 6, '2:00 - 2:50': 6,
    '3.00-3.50': 7, '3:00-3:50': 7, '3:00 - 3:50': 7,
  };
  const built = Object.fromEntries(DAYS.map((day) => [day, [null, null, null, null, null, 'break', null, null]]));
  items.forEach((item) => {
    let index = startIndex[String(item.startTime || '').trim()];
    if (index === undefined && item.timeSlot) {
      index = slotIndexMap[String(item.timeSlot).trim()];
    }
    if (built[item.day] && index !== undefined && index !== 5) {
      built[item.day][index] = {
        code: item.subject,
        room: String(item.room || '').replace(/^r\.?\s*/i, ''),
        teacher: item.teacher || ''
      };
    }
  });
  return built;
}

export default function RoutinePage({ routineList = [], baseRoutineList = [], holidays = [] }) {
  const now = new Date();
  const todayName = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'][now.getDay()];
  const [selectedDay, setSelectedDay] = useState(DAYS.includes(todayName) ? todayName : 'Sunday');
  const [view, setView] = useState('day');
  const [showDefaultRoutine, setShowDefaultRoutine] = useState(false);

  const effectiveSchedule = useMemo(() => buildSchedule(routineList), [routineList]);
  const defaultSchedule = useMemo(() => {
    if (baseRoutineList && baseRoutineList.length) {
      return buildSchedule(baseRoutineList);
    }
    return DEFAULT_SCHEDULE;
  }, [baseRoutineList]);

  const activeSchedule = showDefaultRoutine ? defaultSchedule : effectiveSchedule;
  const activeHolidays = showDefaultRoutine ? [] : holidays;

  const dailyItems = useMemo(() => mergeDay(activeSchedule[selectedDay]), [activeSchedule, selectedDay]);
  const currentMinutes = now.getHours() * 60 + now.getMinutes();
  const selectedIsToday = selectedDay === todayName;

  // Derive the calendar date for the selected day and check if it's a holiday
  const selectedDayDateStr = getDateStrForDayName(selectedDay);
  const selectedDayHoliday = findHolidayForDate(selectedDayDateStr, activeHolidays);

  return <main className="routine-page-root">
    <header className="routine-header-v2">
      <div className="routine-header-content">
        <div className="routine-heading">
          <h1>Class routine</h1>
        </div>
        <div className="routine-view-switch" aria-label="Routine view">
          <button className={view === 'day' ? 'is-active' : ''} onClick={() => setView('day')} aria-pressed={view === 'day'}>
            <CalendarIcon /><span>Daily</span>
          </button>
          <button className={view === 'week' ? 'is-active' : ''} onClick={() => setView('week')} aria-pressed={view === 'week'}>
            <GridIcon /><span>Weekly</span>
          </button>
        </div>
      </div>
      {view === 'day' && (
        <div className="routine-day-strip" role="tablist" aria-label="Choose a day">
          {DAYS.map((day) => (
            <button
              key={day}
              className={`routine-day-button ${selectedDay === day ? 'is-active' : ''} ${day === todayName ? 'is-today' : ''}`}
              onClick={() => setSelectedDay(day)}
              role="tab"
              aria-selected={selectedDay === day}
            >
              <span>{day.slice(0, 3)}</span>
            </button>
          ))}
        </div>
      )}
    </header>
    <section className="routine-scroll-area">
      <div className="routine-content-v2">
        {view === 'day' ? (
          <DailyView
            items={dailyItems}
            selectedDay={selectedDay}
            isToday={selectedIsToday}
            currentMinutes={currentMinutes}
            holiday={selectedDayHoliday}
            isDefaultMode={showDefaultRoutine}
            onToggleMode={setShowDefaultRoutine}
          />
        ) : (
          <WeeklyView
            schedule={activeSchedule}
            todayName={todayName}
            holidays={activeHolidays}
            isDefaultMode={showDefaultRoutine}
            onToggleMode={setShowDefaultRoutine}
            onSelectDay={(day) => {
              setSelectedDay(day);
              setView('day');
            }}
          />
        )}
      </div>
    </section>
  </main>;
}

function DailyView({ items, selectedDay, isToday, currentMinutes, holiday, isDefaultMode }) {
  const classes = items.filter((item) => item.type === 'class');
  return <>
    <div className="routine-day-summary">
      <div>
        <span>{isToday ? 'Today' : selectedDay}</span>
        <strong>{holiday ? 'Holiday' : `${classes.length} ${classes.length === 1 ? 'class' : 'classes'}`}</strong>
      </div>
      {isDefaultMode && (
        <span className="routine-day-default-pill">Default routine</span>
      )}
    </div>
    {holiday ? (
      <div className="routine-holiday-banner">
        <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
          <rect x="3" y="4" width="18" height="17" rx="3" /><path d="M8 2v4M16 2v4M3 10h18" /><path d="M8 14h.01M12 14h.01M16 14h.01" />
        </svg>
        <div>
          <b>{holiday.label}</b>
          {holiday.note && <p>{holiday.note}</p>}
          <p style={{ opacity: 0.65, fontSize: '12px', marginTop: '2px' }}>No classes scheduled</p>
        </div>
      </div>
    ) : items.length ? (
      <div className="routine-timeline-v2">
        {items.map((item, index) => item.type === 'break' ? (
          <div className="routine-break-v2" key={`break-${index}`}>
            <span>1.00–2.00 PM</span>
            <div><b>Lunch break</b></div>
          </div>
        ) : (
          <ClassCard key={`${item.code}-${index}`} item={item} isLive={isToday && (() => { const [start, end] = parseTime(item.time); return currentMinutes >= start && currentMinutes < end; })()} />
        ))}
      </div>
    ) : (
      <div className="routine-empty-v2">
        <CalendarIcon />
        <h2>No classes</h2>
      </div>
    )}
  </>;
}

function ClassCard({ item, isLive }) {
  const periodCount = item.end - item.start + 1;
  const meta = getSubjectMeta(item.code);
  const teacher = item.teacher || meta.teacher || '';
  const room = item.room || meta.room || '';
  const cleanRoom = String(room).replace(/^r\.?\s*/i, '').replace(/^room\s*/i, '').trim();
  const formattedTime = (item.time || '').replace(/\./g, ':').replace('-', ' – ');

  return (
    <article
      className={`routine-class-v2 tone-${item.tone} ${isLive ? 'is-live' : ''}`}
      style={{ '--period-count': periodCount }}
      aria-label={`${item.code}, ${item.time}, ${periodCount} ${periodCount === 1 ? 'period' : 'periods'}`}
    >
      <div className="routine-time-v2">
        <span>{formattedTime}</span>
        {isLive && <b><i />{`Now`}</b>}
      </div>
      <div className="routine-class-main">
        <div className="routine-subject-line">
          <h2>{item.code}</h2>
          {periodCount > 1 && <span>{periodCount} periods</span>}
        </div>
        {meta.name && (
          <div className="routine-course-name">
            {meta.name}
          </div>
        )}
        {(teacher || cleanRoom) && (
          <div className="routine-details-v2">
            {teacher && <span><UserIcon />{teacher}</span>}
            {cleanRoom && <span><PinIcon />Room {cleanRoom}</span>}
          </div>
        )}
      </div>
    </article>
  );
}

function WeeklyView({ schedule, todayName, holidays, isDefaultMode, onToggleMode, onSelectDay }) {
  const todayCardRef = React.useRef(null);

  React.useEffect(() => {
    if (todayCardRef.current) {
      todayCardRef.current.scrollIntoView({ behavior: 'smooth', block: 'nearest', inline: 'center' });
    }
  }, []);

  return (
    <div className="routine-week-v2">
      <div className="routine-week-intro">
        <div className="routine-week-heading-group">
          <h2>Weekly routine</h2>
          <span className="routine-week-subhead">
            {isDefaultMode ? 'Original semester schedule' : 'Current live schedule'}
          </span>
        </div>
        <div className="routine-mode-switch" role="group" aria-label="Routine display mode">
          <button
            type="button"
            className={`routine-mode-btn ${!isDefaultMode ? 'is-active' : ''}`}
            onClick={() => onToggleMode(false)}
            aria-pressed={!isDefaultMode}
            title="Current schedule with vacations, holidays, and CR reschedules"
          >
            <span>Current</span>
          </button>
          <button
            type="button"
            className={`routine-mode-btn ${isDefaultMode ? 'is-active' : ''}`}
            onClick={() => onToggleMode(true)}
            aria-pressed={isDefaultMode}
            title="Default schedule without any vacations, holidays, or reschedules"
          >
            <span>Default</span>
          </button>
        </div>
      </div>

      <div className="routine-week-grid">
        {DAYS.map((day) => {
          const isToday = day === todayName;
          const dateStr = getDateStrForDayName(day);
          const holiday = findHolidayForDate(dateStr, holidays);
          const items = mergeDay(schedule[day]).filter((item) => item.type === 'class');
          return (
            <button
              key={day}
              ref={isToday ? todayCardRef : null}
              className={`routine-week-day ${isToday ? 'is-today' : ''} ${holiday ? 'is-holiday' : ''}`}
              onClick={() => onSelectDay(day)}
            >
              <div className="routine-week-day-head">
                <div>
                  <span>{day.slice(0, 3)}</span>
                  <strong>{isToday ? 'Today' : holiday ? 'Holiday' : `${items.length} classes`}</strong>
                </div>
                <em aria-hidden="true"><ChevronIcon /></em>
              </div>
              <div className="routine-week-list">
                {holiday ? (
                  <p className="routine-week-holiday-label">🎉 {holiday.label}</p>
                ) : items.length ? (
                  items.map((item, index) => {
                    const periodCount = item.end - item.start + 1;
                    const displayTime = formatRoutineTime(item.time);
                    return (
                      <div
                        className={`routine-week-item tone-${item.tone}`}
                        key={`${item.code}-${index}`}
                      >
                        <div className="routine-week-time-header">
                          <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                            <circle cx="12" cy="12" r="10" />
                            <polyline points="12 6 12 12 16 14" />
                          </svg>
                          <span className="routine-week-time-text">{displayTime}</span>
                          {periodCount > 1 && (
                            <span className="routine-week-period-badge">{periodCount} periods</span>
                          )}
                        </div>

                        <div className="routine-week-body">
                          <div className="routine-week-title-row">
                            <b className="routine-week-code">{item.code}</b>
                          </div>

                          <div className="routine-week-meta-row">
                            {item.teacher && (
                              <span className="routine-week-tag">
                                <UserIcon /> {item.teacher}
                              </span>
                            )}
                            <span className="routine-week-tag">
                              <PinIcon /> {item.room ? `Room ${item.room}` : 'Room TBA'}
                            </span>
                          </div>
                        </div>
                      </div>
                    );
                  })
                ) : (
                  <p className="routine-week-no-classes">No classes</p>
                )}
              </div>
            </button>
          );
        })}
      </div>
    </div>
  );
}
