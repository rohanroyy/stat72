import React, { useState, useEffect, useRef } from 'react';
import ConfusionPanel from '../calendar/ConfusionPanel';
import { fetchPostCount, subscribeToConfusions } from '../../services/confusionService';

export default function CourseDetailPage({ course, currentUser, onBack }) {
  const [confusionOpen, setConfusionOpen] = useState(false);
  const [confusionCount, setConfusionCount] = useState(null);
  const courseId = `course_${course.code}`;
  const courseName = `Stat ${course.code}: ${course.name}`;
  const onCloseRef = useRef(onBack);
  const uploadFolder = (() => { try { return localStorage.getItem('bahattor_suggestion_upload_folder') || ''; } catch { return ''; } })();
  useEffect(() => { onCloseRef.current = onBack; }, [onBack]);
  useEffect(() => { fetchPostCount(courseId).then(setConfusionCount).catch(() => setConfusionCount(0)); }, [courseId]);
  useEffect(() => { const unsub = subscribeToConfusions(courseId, () => fetchPostCount(courseId).then(setConfusionCount).catch(() => {})); return unsub; }, [courseId]);
  useEffect(() => { window.history.pushState({ courseDetailPanel: true, courseId }, ''); const onPopState = (event) => { if (event.state?.viewerOpen || event.state?.confusionPanel || event.state?.courseDetailPanel) return; onCloseRef.current(); }; window.addEventListener('popstate', onPopState); return () => window.removeEventListener('popstate', onPopState); }, [courseId]);
  return <>
    <main className="course-dossier">
      <header className="course-dossier-hero">
        <div className="course-dossier-nav"><button onClick={onBack} className="course-dossier-back" aria-label="Back to course catalog"><svg width="19" height="19" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.3" strokeLinecap="round" strokeLinejoin="round"><path d="m15 18-6-6 6-6" /></svg></button><span>বাহাত্তর</span><span>Course file</span></div>
        <div className="course-dossier-code">STAT <strong>{course.code.replace('H-', '')}</strong></div><h1>{course.name}</h1><div className="course-dossier-rule" /><p>4th Year Honours · Department of Statistics</p>
      </header>
      <div className="course-dossier-body">
        <section className="course-facts" aria-label="Course facts"><div className="course-fact"><span>Credit load</span><strong>{course.credits}<small> credits</small></strong></div><div className="course-fact"><span>Course code</span><strong>H-{course.code.replace('H-', '')}</strong></div></section>
        <section className="course-dossier-section"><p className="course-dossier-kicker">Teaching</p><div className="course-instructor"><span className="course-instructor-avatar" aria-hidden="true">{(course.teacher || '?').slice(0, 2)}</span><div><span>Instructor</span><strong>{course.teacher || 'To be announced'}</strong></div></div></section>
        <section className="course-dossier-section course-dossier-about"><p className="course-dossier-kicker">About this course</p><p>{course.name} is part of your 4th Year Honours curriculum. Use this space to keep the course conversation and shared questions together.</p></section>
      </div>
      {!confusionOpen && (
        <button
          className="cf-edp-fab course-detail-fab"
          onClick={() => setConfusionOpen(true)}
          aria-label="Open Confusions"
          title="Confusions"
        >
          <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z" />
          </svg>
          <span className="cf-edp-fab-label">Confusions</span>
          {confusionCount > 0 && (
            <span className="cf-edp-fab-badge" aria-label={`${confusionCount} doubts`}>
              {confusionCount > 99 ? '99+' : confusionCount}
            </span>
          )}
        </button>
      )}
    </main>
    {confusionOpen && <ConfusionPanel examId={courseId} examName={courseName} currentUser={currentUser} suggestionUploadFolder={uploadFolder} onClose={() => setConfusionOpen(false)} />}
  </>;
}
