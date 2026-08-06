import React, { useState, useEffect } from 'react';
import ExamDetailPanel from './ExamDetailPanel';

const DOW_LABELS = ['S', 'M', 'T', 'W', 'T', 'F', 'S'];
const MONTH_NAMES = [
  'January', 'February', 'March', 'April', 'May', 'June',
  'July', 'August', 'September', 'October', 'November', 'December'
];

/** Format a Date object to YYYY-MM-DD string in local time */
function toDateStr(date) {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, '0');
  const d = String(date.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}

/** Check if two dates are the same local calendar day */
function sameDay(a, b) {
  return a.getFullYear() === b.getFullYear() &&
    a.getMonth() === b.getMonth() &&
    a.getDate() === b.getDate();
}

/** Build month grid cells including leading and trailing dates */
function buildMonthGrid(year, month) {
  const firstDay = new Date(year, month, 1).getDay();
  const daysInMonth = new Date(year, month + 1, 0).getDate();
  const daysInPrevMonth = new Date(year, month, 0).getDate();

  const cells = [];
  // Prev month leading days
  for (let i = firstDay - 1; i >= 0; i--) {
    cells.push({ date: new Date(year, month - 1, daysInPrevMonth - i), current: false });
  }
  // Current month days
  for (let d = 1; d <= daysInMonth; d++) {
    cells.push({ date: new Date(year, month, d), current: true });
  }
  // Next month trailing days
  let trailing = 1;
  while (cells.length % 7 !== 0) {
    cells.push({ date: new Date(year, month + 1, trailing++), current: false });
  }
  return cells;
}

/** Build 7-day strip for the week containing the selected date */
function buildWeekStrip(date) {
  const dayOfWeek = date.getDay();
  const sunday = new Date(date);
  sunday.setDate(date.getDate() - dayOfWeek);
  
  return Array.from({ length: 7 }, (_, i) => {
    const d = new Date(sunday);
    d.setDate(sunday.getDate() + i);
    return d;
  });
}

/** Sort exams: upcoming/current first (chronological), past last (chronological) */
function sortExams(list, todayStr) {
  return [...list].sort((a, b) => {
    const aIsPast = a.date < todayStr;
    const bIsPast = b.date < todayStr;

    if (aIsPast && !bIsPast) return 1;  // a goes below b
    if (!aIsPast && bIsPast) return -1; // a goes above b

    // Same category: sort chronologically by date
    if (a.date !== b.date) {
      return a.date.localeCompare(b.date);
    }
    // If same date, sort chronologically by time
    return (a.time || '').localeCompare(b.time || '');
  });
}

export default function ExamCalendar({
  onAddExam,
  exams: examsProp = [],
  currentUser = null,
  topperIds = [],
  foldersList = [],
  onOpenFile = null,
  suggestionUploadFolder = '',
  initialExamId = null,
  highlightSuggId = null,
  highlightConfusionId = null,
}) {
  const today = new Date();
  const [currentMonth, setCurrentMonth] = useState(
    new Date(today.getFullYear(), today.getMonth(), 1)
  );
  const [selectedDate, setSelectedDate] = useState(today);
  const [viewMode, setViewMode] = useState('month'); // 'month' | 'week'
  const [selectedExam, setSelectedExam] = useState(null); // exam detail panel
  // Track which suggestion to highlight — only active on deep-link arrival;
  // cleared when user manually opens a different exam so re-opens don't re-highlight
  const [activeHighlightSuggId, setActiveHighlightSuggId] = useState(highlightSuggId);

  // Use prop directly — parent (AppMain) owns the source of truth
  const exams = examsProp;
  const examDates = new Set(exams.map(e => e.date));

  // Deep-link: auto-open the exam panel once exams are loaded
  const deepLinkHandled = React.useRef(false);
  useEffect(() => {
    if (!initialExamId || deepLinkHandled.current || exams.length === 0) return;
    const target = exams.find(e => e.id === initialExamId);
    if (!target) return;
    deepLinkHandled.current = true;
    // Navigate calendar view to that exam's date
    const parts = target.date.split('-');
    if (parts.length === 3) {
      const d = new Date(parseInt(parts[0], 10), parseInt(parts[1], 10) - 1, parseInt(parts[2], 10));
      setSelectedDate(d);
      setCurrentMonth(new Date(d.getFullYear(), d.getMonth(), 1));
      setViewMode('week');
    }
    setSelectedExam(target);
  }, [initialExamId, exams]);

  const selectedDateStr = toDateStr(selectedDate);
  const todayStr = toDateStr(today);

  // Month filtering helper (timezone-safe split parsing)
  const activeYear = currentMonth.getFullYear();
  const activeMonth = currentMonth.getMonth();

  const getMonthExams = () => {
    return exams.filter(exam => {
      const parts = exam.date.split('-');
      if (parts.length < 3) return false;
      const ey = parseInt(parts[0], 10);
      const em = parseInt(parts[1], 10) - 1;
      return ey === activeYear && em === activeMonth;
    });
  };

  const monthlyExamsList = sortExams(getMonthExams(), todayStr);
  const dailyExamsList = sortExams(exams.filter(e => e.date === selectedDateStr), todayStr);

  const monthGrid = buildMonthGrid(activeYear, activeMonth);
  const weekStrip = buildWeekStrip(selectedDate);

  const prevMonth = () => setCurrentMonth(m => new Date(m.getFullYear(), m.getMonth() - 1, 1));
  const nextMonth = () => setCurrentMonth(m => new Date(m.getFullYear(), m.getMonth() + 1, 1));

  const handleMonthDayClick = (cell) => {
    setSelectedDate(cell.date);
    if (!cell.current) {
      setCurrentMonth(new Date(cell.date.getFullYear(), cell.date.getMonth(), 1));
    }
    setViewMode('week');
  };

  const handleWeekDayClick = (date) => {
    setSelectedDate(date);
  };

  const backToMonth = () => {
    setViewMode('month');
    setCurrentMonth(new Date(selectedDate.getFullYear(), selectedDate.getMonth(), 1));
  };

  const handleExamCardClick = (exam) => {
    // Sync URL before ExamDetailPanel mounts (avoids effects ordering issue)
    const url = new URL(window.location.href);
    url.searchParams.set('e', exam.id);
    url.searchParams.delete('s'); // no suggestion highlight on manual open
    window.history.replaceState({ tab: 'calendar', examId: exam.id }, '', url.toString());
    setActiveHighlightSuggId(null); // don't highlight on manual open
    setSelectedExam(exam);
  };

  const handleMonthExamCardClick = (exam) => {
    // In month view: also navigate the calendar to that date
    const parts = exam.date.split('-');
    if (parts.length === 3) {
      const d = new Date(parseInt(parts[0], 10), parseInt(parts[1], 10) - 1, parseInt(parts[2], 10));
      setSelectedDate(d);
      setCurrentMonth(new Date(d.getFullYear(), d.getMonth(), 1));
      setViewMode('week');
    }
    // Sync URL before ExamDetailPanel mounts
    const url = new URL(window.location.href);
    url.searchParams.set('e', exam.id);
    url.searchParams.delete('s');
    window.history.replaceState({ tab: 'calendar', examId: exam.id }, '', url.toString());
    setActiveHighlightSuggId(null);
    setSelectedExam(exam);
  };

  const handleCloseDetail = () => {
    setSelectedExam(null);
    // Clean deep-link params from URL so closing is reflected in address bar
    const url = new URL(window.location.href);
    ['e', 's', 'exam', 'sugg', 'tab'].forEach(k => url.searchParams.delete(k));
    window.history.replaceState({ tab: 'calendar' }, '', url.toString());
  };

  return (
    <>
      <div className="exam-calendar-page">
        {/* Month/Header Nav */}
        <div className="cal-header">
          <button
            className="cal-month-title"
            style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-primary)' }}
            onClick={viewMode === 'week' ? backToMonth : undefined}
            title={viewMode === 'week' ? 'Back to month view' : ''}
          >
            {MONTH_NAMES[activeMonth]} {activeYear}
          </button>
          {onAddExam && (
            <button
              className="cal-add-btn"
              onClick={() => onAddExam(selectedDateStr)}
              aria-label="Add exam"
            >
              +
            </button>
          )}
        </div>

        {/* Month nav row (only visible in month view) */}
        {viewMode === 'month' && (
          <div className="cal-nav-row">
            <button className="cal-nav-btn" onClick={prevMonth} aria-label="Previous month">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <polyline points="15 18 9 12 15 6" />
              </svg>
            </button>
            <button className="cal-nav-btn" onClick={nextMonth} aria-label="Next month">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <polyline points="9 18 15 12 9 6" />
              </svg>
            </button>
          </div>
        )}

        {/* Week back-to-month view toggle link */}
        {viewMode === 'week' && (
          <div className="cal-view-toggle">
            <button className="cal-view-toggle-btn" onClick={backToMonth} aria-label="Show full month" title="Show full month">
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{ display: 'block' }}>
                <rect x="3" y="4" width="18" height="18" rx="2" ry="2" />
                <line x1="16" y1="2" x2="16" y2="6" />
                <line x1="8" y1="2" x2="8" y2="6" />
                <line x1="3" y1="10" x2="21" y2="10" />
                <path d="M8 14h.01M12 14h.01M16 14h.01M8 18h.01M12 18h.01M16 18h.01" strokeWidth="3" />
              </svg>
            </button>
          </div>
        )}

        {/* Day-of-week header (ONLY rendered in month view, week view has DOW inside cells) */}
        {viewMode === 'month' && (
          <div className="cal-dow-row">
            {DOW_LABELS.map((d, i) => (
              <div key={i} className="cal-dow-cell">{d}</div>
            ))}
          </div>
        )}

        {/* Calendar body selection */}
        {viewMode === 'month' ? (
          <div className="cal-month-grid">
            {monthGrid.map((cell, idx) => {
              const ds = toDateStr(cell.date);
              const isSelected = sameDay(cell.date, selectedDate);
              const isToday = sameDay(cell.date, today);
              const hasExams = examDates.has(ds);
              return (
                <div
                  key={idx}
                  className={`cal-day-cell ${!cell.current ? 'other-month' : ''} ${isSelected ? 'selected' : ''} ${isToday && !isSelected ? 'today' : ''}`}
                  onClick={() => handleMonthDayClick(cell)}
                >
                  <div className="cal-day-num">{cell.date.getDate()}</div>
                  <div className="cal-dot-row">
                    {hasExams && <span className="cal-exam-dot" />}
                  </div>
                </div>
              );
            })}
          </div>
        ) : (
          <div className="cal-week-strip">
            {weekStrip.map((date, idx) => {
              const ds = toDateStr(date);
              const isSelected = sameDay(date, selectedDate);
              const isToday = sameDay(date, today);
              const hasExams = examDates.has(ds);
              return (
                <div
                  key={idx}
                  className={`cal-week-cell ${isSelected ? 'selected' : ''} ${isToday && !isSelected ? 'today' : ''}`}
                  onClick={() => handleWeekDayClick(date)}
                  style={{ position: 'relative' }}
                >
                  <span className="cal-week-dow">{DOW_LABELS[date.getDay()]}</span>
                  <span className="cal-week-num">{date.getDate()}</span>
                  {hasExams && (
                    <span
                      className="cal-exam-dot"
                      style={{
                        position: 'absolute',
                        bottom: '6px',
                        background: isSelected ? '#FFFFFF' : 'var(--accent)',
                      }}
                    />
                  )}
                </div>
              );
            })}
          </div>
        )}

        {/* bottom Sheet */}
        <div className="cal-exam-sheet">
          <div className="cal-exam-sheet-header">
            <span className="cal-exam-sheet-title">
              {viewMode === 'month' ? `Exams in ${MONTH_NAMES[activeMonth]} ${activeYear}` : `Exams for ${selectedDate.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}`}
            </span>
          </div>

          {viewMode === 'month' ? (
            /* Month View: List all exams of the month */
            monthlyExamsList.length === 0 ? (
              <div className="cal-empty-exams">
                <div className="cal-empty-exams-icon">
                  <svg width="36" height="36" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" style={{ color: 'var(--text-card-muted)' }}>
                    <rect x="3" y="4" width="18" height="18" rx="2" ry="2" />
                    <line x1="16" y1="2" x2="16" y2="6" />
                    <line x1="8" y1="2" x2="8" y2="6" />
                    <line x1="3" y1="10" x2="21" y2="10" />
                  </svg>
                </div>
                <div className="cal-empty-exams-text">No exams this month</div>
                <div className="cal-empty-exams-sub">Use the arrows above to switch months</div>
              </div>
            ) : (
              <div className="cal-exam-list">
                {monthlyExamsList.map((exam, idx) => {
                  const parts = exam.date.split('-');
                  const examDay = parts.length === 3 ? parseInt(parts[2], 10) : '';
                  const isPast = exam.date < todayStr;
                  return (
                    <div
                      key={exam.id}
                      className={`cal-exam-item ${isPast ? 'past' : ''}`}
                      onClick={() => handleMonthExamCardClick(exam)}
                      style={{ cursor: 'pointer' }}
                    >
                      <div className="cal-exam-num cal-exam-num-month">
                        {examDay}
                      </div>
                      <div className="cal-exam-body">
                        <div className="cal-exam-name">{exam.subject}</div>
                        <div className="cal-exam-meta">
                          {exam.time && <span>{exam.time}</span>}
                          {exam.time && exam.room && <span>·</span>}
                          {exam.room && <span>{exam.room}</span>}
                          {exam.notes && <span>· {exam.notes}</span>}
                        </div>
                      </div>
                      <div className="cal-exam-time" style={{ fontSize: '11px', color: 'var(--text-card-muted)' }}>
                        {MONTH_NAMES[activeMonth].slice(0, 3)} {examDay}
                      </div>
                    </div>
                  );
                })}
              </div>
            )
          ) : (
            /* Week View: List exams for selected date only */
            dailyExamsList.length === 0 ? (
              <div className="cal-empty-exams">
                <div className="cal-empty-exams-icon">
                  <svg width="36" height="36" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" style={{ color: 'var(--text-card-muted)' }}>
                    <rect x="3" y="4" width="18" height="18" rx="2" ry="2" />
                    <line x1="16" y1="2" x2="16" y2="6" />
                    <line x1="8" y1="2" x2="8" y2="6" />
                    <line x1="3" y1="10" x2="21" y2="10" />
                  </svg>
                </div>
                <div className="cal-empty-exams-text">No exams scheduled</div>
                <div className="cal-empty-exams-sub">
                  {selectedDateStr === todayStr ? 'Nothing today - relax!' : 'No exams for this day'}
                </div>
              </div>
            ) : (
              <div className="cal-exam-list">
                {dailyExamsList.map((exam, idx) => {
                  const isPast = exam.date < todayStr;
                  return (
                    <div
                      key={exam.id}
                      className={`cal-exam-item ${isPast ? 'past' : ''}`}
                      onClick={() => handleExamCardClick(exam)}
                      style={{ cursor: 'pointer' }}
                    >
                      <div className="cal-exam-num cal-exam-num-week">
                        {idx + 1}
                      </div>
                      <div className="cal-exam-body">
                        <div className="cal-exam-name">{exam.subject}</div>
                        <div className="cal-exam-meta">
                          {exam.duration && <span>{exam.duration}</span>}
                          {exam.duration && exam.room && <span>·</span>}
                          {exam.room && <span>{exam.room}</span>}
                          {exam.notes && <span>· {exam.notes}</span>}
                        </div>
                      </div>
                      <div className="cal-exam-time">{exam.time}</div>
                    </div>
                  );
                })}
              </div>
            )
          )}
        </div>
      </div>

      {/* Exam Detail Panel — renders as overlay when an exam is selected */}
      {selectedExam && (
        <ExamDetailPanel
          exam={selectedExam}
          currentUser={currentUser}
          topperIds={topperIds}
          foldersList={foldersList}
          onOpenFile={onOpenFile}
          suggestionUploadFolder={suggestionUploadFolder}
          highlightSuggId={activeHighlightSuggId}
          highlightConfusionId={highlightConfusionId}
          onClose={handleCloseDetail}
        />
      )}
    </>
  );
}
