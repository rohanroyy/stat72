import React, { useMemo, useState } from 'react';

const DAYS = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday'];
const TIMES = ['8.00-8.50', '9.00-9.50', '10.00-10.50', '11.00-11.50', '12.00-12.50', '1.00-2.00', '2.00-2.50', '3.00-3.50'];
const SUBJECT_TONES = { 'H-401': 'blue', 'H-402': 'violet', 'H-403': 'violet', 'H-404': 'coral', 'H-405': 'gold', 'H-406': 'rose', 'H-407': 'blue', 'H-408': 'coral' };
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

const CalendarIcon = () => <svg viewBox="0 0 24 24" aria-hidden="true"><rect x="3" y="4" width="18" height="17" rx="3"/><path d="M8 2v4M16 2v4M3 10h18"/></svg>;
const GridIcon = () => <svg viewBox="0 0 24 24" aria-hidden="true"><rect x="3" y="3" width="7" height="7" rx="1"/><rect x="14" y="3" width="7" height="7" rx="1"/><rect x="3" y="14" width="7" height="7" rx="1"/><rect x="14" y="14" width="7" height="7" rx="1"/></svg>;
const PinIcon = () => <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M20 10c0 5.5-8 12-8 12S4 15.5 4 10a8 8 0 1 1 16 0Z"/><circle cx="12" cy="10" r="2.5"/></svg>;
const UserIcon = () => <svg viewBox="0 0 24 24" aria-hidden="true"><circle cx="12" cy="7" r="4"/><path d="M4 21c.7-4 3.3-6 8-6s7.3 2 8 6"/></svg>;
const ChevronIcon = () => <svg viewBox="0 0 24 24" aria-hidden="true"><path d="m9 18 6-6-6-6"/></svg>;

export default function RoutinePage({ routineList = [] }) {
  const now = new Date();
  const todayName = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'][now.getDay()];
  const [selectedDay, setSelectedDay] = useState(DAYS.includes(todayName) ? todayName : 'Sunday');
  const [view, setView] = useState('day');
  const schedule = useMemo(() => {
    if (!routineList.length) return DEFAULT_SCHEDULE;
    const startIndex = { '08:00': 0, '8:00': 0, '8.00': 0, '09:00': 1, '9:00': 1, '9.00': 1, '10:00': 2, '10.00': 2, '11:00': 3, '11.00': 3, '12:00': 4, '12.00': 4, '14:00': 6, '2:00': 6, '2.00': 6, '15:00': 7, '3:00': 7, '3.00': 7 };
    const built = Object.fromEntries(DAYS.map((day) => [day, [null, null, null, null, null, 'break', null, null]]));
    routineList.forEach((item) => { const index = startIndex[String(item.startTime || '').trim()]; if (built[item.day] && index !== undefined && index !== 5) built[item.day][index] = { code: item.subject, room: String(item.room || '').replace(/^r\.?\s*/i, ''), teacher: item.teacher || '' }; });
    return built;
  }, [routineList]);
  const dailyItems = useMemo(() => mergeDay(schedule[selectedDay]), [schedule, selectedDay]);
  const currentMinutes = now.getHours() * 60 + now.getMinutes();
  const selectedIsToday = selectedDay === todayName;
  return <main className="routine-page-root">
    <header className="routine-header-v2"><div className="routine-header-content"><div className="routine-heading"><h1>Class routine</h1></div><div className="routine-view-switch" aria-label="Routine view"><button className={view === 'day' ? 'is-active' : ''} onClick={() => setView('day')} aria-pressed={view === 'day'}><CalendarIcon /><span>Daily</span></button><button className={view === 'week' ? 'is-active' : ''} onClick={() => setView('week')} aria-pressed={view === 'week'}><GridIcon /><span>Weekly</span></button></div></div>
      {view === 'day' && <div className="routine-day-strip" role="tablist" aria-label="Choose a day">{DAYS.map((day) => <button key={day} className={`routine-day-button ${selectedDay === day ? 'is-active' : ''} ${day === todayName ? 'is-today' : ''}`} onClick={() => setSelectedDay(day)} role="tab" aria-selected={selectedDay === day}><span>{day.slice(0, 3)}</span></button>)}</div>}
    </header>
    <section className="routine-scroll-area"><div className="routine-content-v2">{view === 'day' ? <DailyView items={dailyItems} selectedDay={selectedDay} isToday={selectedIsToday} currentMinutes={currentMinutes} /> : <WeeklyView schedule={schedule} todayName={todayName} onSelectDay={(day) => { setSelectedDay(day); setView('day'); }} />}</div></section>
  </main>;
}

function DailyView({ items, selectedDay, isToday, currentMinutes }) {
  const classes = items.filter((item) => item.type === 'class');
  return <><div className="routine-day-summary"><div><span>{isToday ? 'Today' : selectedDay}</span><strong>{classes.length} {classes.length === 1 ? 'class' : 'classes'}</strong></div></div>
    {items.length ? <div className="routine-timeline-v2">{items.map((item, index) => item.type === 'break' ? <div className="routine-break-v2" key={`break-${index}`}><span>1.00–2.00 PM</span><div><b>Lunch break</b></div></div> : <ClassCard key={`${item.code}-${index}`} item={item} isLive={isToday && (() => { const [start, end] = parseTime(item.time); return currentMinutes >= start && currentMinutes < end; })()} />)}</div> : <div className="routine-empty-v2"><CalendarIcon /><h2>No classes</h2></div>}</>;
}
function ClassCard({ item, isLive }) {
  const periodCount = item.end - item.start + 1;
  return <article className={`routine-class-v2 tone-${item.tone} ${isLive ? 'is-live' : ''}`} style={{ '--period-count': periodCount }} aria-label={`${item.code}, ${item.time}, ${periodCount} ${periodCount === 1 ? 'period' : 'periods'}`}><div className="routine-time-v2"><span>{item.time}</span>{isLive && <b><i />Now</b>}</div><div className="routine-class-main"><div className="routine-subject-line"><h2>{item.code}</h2>{periodCount > 1 && <span>{periodCount} periods</span>}</div><div className="routine-details-v2">{item.teacher && <span><UserIcon />{item.teacher}</span>}{item.room && <span><PinIcon />Room {item.room}</span>}</div></div></article>;
}
function WeeklyView({ schedule, todayName, onSelectDay }) { return <div className="routine-week-v2"><div className="routine-week-intro"><h2>Weekly routine</h2></div><div className="routine-week-grid">{DAYS.map((day) => { const items = mergeDay(schedule[day]).filter((item) => item.type === 'class'); return <button key={day} className={`routine-week-day ${day === todayName ? 'is-today' : ''}`} onClick={() => onSelectDay(day)}><div className="routine-week-day-head"><div><span>{day.slice(0, 3)}</span><strong>{day === todayName ? 'Today' : `${items.length} classes`}</strong></div><em aria-hidden="true"><ChevronIcon /></em></div><div className="routine-week-list">{items.length ? items.map((item, index) => { const periodCount = item.end - item.start + 1; return <div className={`routine-week-item tone-${item.tone}`} style={{ '--period-count': periodCount }} key={`${item.code}-${index}`}><span>{item.time}</span><b>{item.code}</b><small>{item.room ? `R. ${item.room}` : 'Room TBA'}</small></div>; }) : <p>No classes</p>}</div></button>; })}</div></div>; }
