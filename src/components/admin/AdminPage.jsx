import React, { useState, useEffect } from 'react';
import { extractFolderId } from '../../config/drive';
import {
  getTopicsMap,
  getCustomTopicNames,
  saveCustomTopicName,
  deleteCustomTopicName,
  applyCustomNamesToFolders,
} from '../../services/telegramService';
import { isSupabaseConfigured, supabase } from '../../lib/supabase';
import { fetchAllStudents, fetchBroadcastNotifications, sendBroadcastNotification, deleteBroadcastNotification } from '../../services/broadcastService';

const IS_SUBDOMAIN = window.location.hostname.startsWith('admin.');

export default function AdminPage({
  foldersList,
  onSaveFolders,
  apiKey,
  onSaveApiKey,
  telegramConfig,
  onSaveTelegramConfig,
  onClearTelegramConfig,
  onClose,
  onTelegramFoldersUpdated,
  examsList = [],
  onSaveExam,
  onDeleteExam,
}) {
  const [folderName, setFolderName] = useState('');
  const [folderLink, setFolderLink] = useState('');
  const [editingId, setEditingId] = useState(null);

  // States
  const [newApiKey, setNewApiKey] = useState(apiKey);
  const [apiSaveStatus, setApiSaveStatus] = useState('');

  const [newTgToken, setNewTgToken] = useState(telegramConfig?.token || '');
  const [newTgChatId, setNewTgChatId] = useState(telegramConfig?.chatId || '');
  const [tgSaveStatus, setTgSaveStatus] = useState('');

  const [topicsMap, setTopicsMap] = useState({});
  const [customNames, setCustomNames] = useState({});
  const [newThreadId, setNewThreadId] = useState('');
  const [newTopicName, setNewTopicName] = useState('');
  const [topicSaveStatus, setTopicSaveStatus] = useState('');

  // Exam form fields (list comes from parent prop)
  const [examSubject, setExamSubject] = useState('');
  const [examDate, setExamDate] = useState('');
  const [examTime, setExamTime] = useState('');
  const [examDuration, setExamDuration] = useState('');
  const [examRoom, setExamRoom] = useState('');
  const [examNotes, setExamNotes] = useState('');
  const [examSaveStatus, setExamSaveStatus] = useState('');

  // Notifications Panel states
  const [students, setStudents] = useState([]);
  const [broadcasts, setBroadcasts] = useState([]);
  const [notifTitle, setNotifTitle] = useState('');
  const [notifBody, setNotifBody] = useState('');
  const [notifTargetType, setNotifTargetType] = useState('all'); // 'all' | 'custom'
  const [selectedStudentIds, setSelectedStudentIds] = useState([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [notifSendStatus, setNotifSendStatus] = useState('');

  useEffect(() => {
    fetchAllStudents().then(setStudents).catch(err => console.error('Failed to load students:', err));
    fetchBroadcastNotifications().then(setBroadcasts).catch(err => console.error('Failed to load broadcasts:', err));
  }, []);

  const filteredStudents = students.filter(s => {
    const q = searchQuery.toLowerCase().trim();
    if (!q) return true;
    return (s.name || '').toLowerCase().includes(q) ||
           (s.class_roll || '').toLowerCase().includes(q) ||
           (s.registration_number || '').toLowerCase().includes(q);
  });

  const handleToggleStudentSelect = (id) => {
    setSelectedStudentIds(prev => 
      prev.includes(id) ? prev.filter(x => x !== id) : [...prev, id]
    );
  };

  const handleSendNotification = async (e) => {
    e.preventDefault();
    if (!notifTitle.trim() || !notifBody.trim()) return;
    if (notifTargetType === 'custom' && selectedStudentIds.length === 0) return;

    setNotifSendStatus('Sending...');
    try {
      const finalTarget = notifTargetType === 'all' ? 'all' : selectedStudentIds;
      const updated = await sendBroadcastNotification(notifTitle, notifBody, finalTarget);
      setBroadcasts(updated);
      setNotifTitle('');
      setNotifBody('');
      setSelectedStudentIds([]);
      setNotifSendStatus('Success: Notification published!');
      
      setTimeout(() => setNotifSendStatus(''), 4000);
    } catch (err) {
      console.error(err);
      setNotifSendStatus(`Error: ${err.message || 'Failed to send'}`);
    }
  };

  const handleDeleteNotification = async (id) => {
    if (!window.confirm('Are you sure you want to delete this notification permanently from the database?')) {
      return;
    }
    try {
      const updated = await deleteBroadcastNotification(id);
      setBroadcasts(updated);
    } catch (err) {
      console.error(err);
      alert(`Failed to delete notification: ${err.message || 'unknown error'}`);
    }
  };

  const getTargetTooltip = (target) => {
    if (target === 'all') return 'Broadcast to all registered devices';
    if (Array.isArray(target)) {
      return target.map(tid => students.find(s => s.id === tid)?.name || 'Unknown student').join(', ');
    }
    return students.find(s => s.id === target)?.name || 'Selected user';
  };


  // Storage Bridge Sync state
  const [bridgeReady, setBridgeReady] = useState(!IS_SUBDOMAIN);

  const getRootDomainUrl = () => {
    const host = window.location.host;
    const protocol = window.location.protocol;
    if (host.startsWith('admin.')) {
      return `${protocol}//${host.substring(6)}`;
    }
    return `${protocol}//${host}`;
  };

  const handleBridgeLoad = () => {
    const iframe = document.getElementById('storage-bridge');
    if (!iframe) return;

    const keys = [
      'studydock_exams',
      'studydock_configured_folders',
      'studydock_api_key',
      'telegram_token_key',
      'telegram_chat_id_key',
      'telegram_custom_topic_names',
      'telegram_synced_data'
    ];

    keys.forEach(k => {
      iframe.contentWindow.postMessage({ action: 'get', key: k }, getRootDomainUrl());
    });
  };

  const syncToBridge = (key, value) => {
    if (!IS_SUBDOMAIN) return;
    const iframe = document.getElementById('storage-bridge');
    if (iframe) {
      iframe.contentWindow.postMessage({ action: 'set', key, value }, getRootDomainUrl());
    }
  };

  const syncClearToBridge = (key) => {
    if (!IS_SUBDOMAIN) return;
    const iframe = document.getElementById('storage-bridge');
    if (iframe) {
      iframe.contentWindow.postMessage({ action: 'clear', key }, getRootDomainUrl());
    }
  };

  // Synchronize items from root domain on mount
  useEffect(() => {
    if (!IS_SUBDOMAIN) return;

    const keys = [
      'studydock_exams',
      'studydock_configured_folders',
      'studydock_api_key',
      'telegram_token_key',
      'telegram_chat_id_key',
      'telegram_custom_topic_names',
      'telegram_synced_data'
    ];
    let loadedCount = 0;

    const handleMessage = (e) => {
      if (e.origin !== getRootDomainUrl()) return;
      const { action, key, value } = e.data;

      if (action === 'get_result' && keys.includes(key)) {
        if (value !== null) {
          localStorage.setItem(key, value);
        } else {
          localStorage.removeItem(key);
        }
        loadedCount++;
        if (loadedCount >= keys.length) {
          // Re-initialize state with synced data (exams come via prop from parent)
          setNewApiKey(localStorage.getItem('studydock_api_key') || '');
          setNewTgToken(localStorage.getItem('telegram_token_key') || '');
          setNewTgChatId(localStorage.getItem('telegram_chat_id_key') || '');
          setTopicsMap(getTopicsMap());
          setCustomNames(getCustomTopicNames());
          try {
            const rawFolders = localStorage.getItem('studydock_configured_folders');
            if (rawFolders) {
              onSaveFolders(JSON.parse(rawFolders));
            }
          } catch (err) {}
          setBridgeReady(true);
        }
      }
    };

    window.addEventListener('message', handleMessage);
    return () => window.removeEventListener('message', handleMessage);
  }, [onSaveFolders]);

  const refreshTopicState = () => {
    setTopicsMap(getTopicsMap());
    setCustomNames(getCustomTopicNames());
  };

  useEffect(() => {
    if (bridgeReady) {
      setTopicsMap(getTopicsMap());
      setCustomNames(getCustomTopicNames());
    }
  }, [telegramConfig?.chatId, bridgeReady]);

  // ── Drive Folders ─────────────────────────────────────────────────────────
  const handleFolderSubmit = async (e) => {
    e.preventDefault();
    const name = folderName.trim();
    const link = folderLink.trim();
    if (!name || !link) return;

    const extractedId = extractFolderId(link);
    if (!extractedId) {
      alert('Invalid Google Drive Link or Folder ID.');
      return;
    }

    let updated;
    if (editingId) {
      updated = foldersList.map((f) =>
        f.id === editingId
          ? { ...f, name, driveLink: link, folderId: extractedId }
          : f
      );
      setEditingId(null);
    } else {
      const newFolder = {
        id: `folder-${Date.now()}`,
        name,
        driveLink: link,
        folderId: extractedId,
      };
      updated = [...foldersList, newFolder];
    }

    try {
      await onSaveFolders(updated);
      syncToBridge('studydock_configured_folders', JSON.stringify(updated));
      setFolderName('');
      setFolderLink('');
    } catch (err) {
      alert(`Failed to save folder: ${err.message}`);
    }
  };

  const handleEditInit = (folder) => {
    setEditingId(folder.id);
    setFolderName(folder.name);
    setFolderLink(folder.driveLink || folder.folderId);
  };

  const handleDelete = async (id) => {
    if (confirm('Delete this drive folder link?')) {
      const updated = foldersList.filter((f) => f.id !== id);
      try {
        await onSaveFolders(updated);
        syncToBridge('studydock_configured_folders', JSON.stringify(updated));
      } catch (err) {
        alert(`Failed to delete folder: ${err.message}`);
      }
    }
  };

  const handleCancelEdit = () => {
    setEditingId(null);
    setFolderName('');
    setFolderLink('');
  };

  // ── API Key ───────────────────────────────────────────────────────────────
  const handleApiKeySubmit = async (e) => {
    e.preventDefault();
    const trimmed = newApiKey.trim();
    try {
      await onSaveApiKey(trimmed);
      syncToBridge('studydock_api_key', trimmed);
      setApiSaveStatus('Saved to database!');
      setTimeout(() => setApiSaveStatus(''), 2000);
    } catch (err) {
      setApiSaveStatus(`Error: ${err.message}`);
      setTimeout(() => setApiSaveStatus(''), 4000);
    }
  };

  // ── Telegram Config ───────────────────────────────────────────────────────
  const handleTelegramSubmit = async (e) => {
    e.preventDefault();
    const token = newTgToken.trim();
    const chatId = newTgChatId.trim();
    try {
      await onSaveTelegramConfig(token, chatId);
      syncToBridge('telegram_token_key', token);
      syncToBridge('telegram_chat_id_key', chatId);
      setTgSaveStatus('Saved to database!');
      setTimeout(() => setTgSaveStatus(''), 2000);
    } catch (err) {
      setTgSaveStatus(`Error: ${err.message}`);
      setTimeout(() => setTgSaveStatus(''), 4000);
    }
  };

  const handleResetTelegram = () => {
    if (confirm('Delete all synced Telegram files and reset config?')) {
      onClearTelegramConfig();
      syncClearToBridge('telegram_token_key');
      syncClearToBridge('telegram_chat_id_key');
      syncClearToBridge('telegram_synced_data');
      setNewTgToken('');
      setNewTgChatId('');
      setTopicsMap({});
      setCustomNames({});
      setTgSaveStatus('Reset complete.');
      setTimeout(() => setTgSaveStatus(''), 2000);
    }
  };

  // ── Topic Name Overrides ──────────────────────────────────────────────────
  const allKnownThreadIds = Array.from(
    new Set([...Object.keys(topicsMap), ...Object.keys(customNames)])
  ).filter(id => id !== 'topic-general');

  const handleSaveTopicName = async (e) => {
    e.preventDefault();
    const tid = newThreadId.trim();
    const tname = newTopicName.trim();
    if (!tid || !tname) return;

    await saveCustomTopicName(tid, tname);
    syncToBridge('telegram_custom_topic_names', localStorage.getItem('studydock_telegram_custom_names') || '');

    const updated = applyCustomNamesToFolders();
    if (onTelegramFoldersUpdated) onTelegramFoldersUpdated(updated);
    syncToBridge('telegram_synced_data', localStorage.getItem('studydock_telegram_data') || '');

    refreshTopicState();
    setNewThreadId('');
    setNewTopicName('');
    setTopicSaveStatus('Topic name saved!');
    setTimeout(() => setTopicSaveStatus(''), 2000);
  };

  const handleDeleteTopicName = async (threadId) => {
    await deleteCustomTopicName(threadId);
    syncToBridge('telegram_custom_topic_names', localStorage.getItem('studydock_telegram_custom_names') || '');

    const updated = applyCustomNamesToFolders();
    if (onTelegramFoldersUpdated) onTelegramFoldersUpdated(updated);
    syncToBridge('telegram_synced_data', localStorage.getItem('studydock_telegram_data') || '');

    refreshTopicState();
  };

  const getEffectiveName = (tid) => {
    if (customNames[tid]) return { name: customNames[tid], source: 'custom' };
    if (topicsMap[tid]) return { name: topicsMap[tid], source: 'auto' };
    return { name: `Thread ${tid}`, source: 'fallback' };
  };

  // ── Exam Schedule ──────────────────────────────────────────────────────────
  const handleExamSubmit = async (e) => {
    e.preventDefault();
    if (!examSubject.trim() || !examDate) return;
    try {
      const updated = await onSaveExam({
        subject: examSubject.trim(),
        date: examDate,
        time: examTime.trim(),
        duration: examDuration.trim(),
        room: examRoom.trim(),
        notes: examNotes.trim(),
      });
      syncToBridge('studydock_exams', JSON.stringify(updated || []));

      setExamSubject(''); setExamDate(''); setExamTime('');
      setExamDuration(''); setExamRoom(''); setExamNotes('');
      setExamSaveStatus('Exam saved to database!');
      setTimeout(() => setExamSaveStatus(''), 3000);
    } catch (err) {
      setExamSaveStatus(`Error: ${err.message}`);
      setTimeout(() => setExamSaveStatus(''), 5000);
    }
  };

  const handleDeleteExam = async (id) => {
    try {
      const updated = await onDeleteExam(id);
      syncToBridge('studydock_exams', JSON.stringify(updated || []));
    } catch (err) {
      alert(`Failed to delete exam: ${err.message}`);
    }
  };

  return (
    <div className="admin-container">
      {/* Single background storage synchronizer bridge iframe — kept mounted */}
      {IS_SUBDOMAIN && (
        <iframe
          id="storage-bridge"
          src={`${getRootDomainUrl()}/storage_bridge.html`}
          style={{ display: 'none' }}
          onLoad={handleBridgeLoad}
        />
      )}

      {!bridgeReady ? (
        <div className="setup-card" style={{ textAlign: 'center', padding: '40px', margin: '40px auto', maxWidth: '480px' }}>
          <div className="pdf-loading-spinner" style={{ margin: '0 auto 16px', borderTopColor: 'var(--accent)' }}></div>
          <h2>Syncing Security Storage...</h2>
          <p style={{ marginTop: '8px' }}>Reading synchronized configurations from main domain...</p>
        </div>
      ) : (
        <>
          <div className="admin-header">
            <h2 className="admin-header-title">Admin Dashboard</h2>
            <button className="header-back-btn" onClick={onClose}>
              Exit Admin
            </button>
          </div>

      <div style={{
        margin: '0 0 20px 0',
        padding: '12px 16px',
        background: 'var(--bg-surface)',
        border: '1px solid var(--border-hairline)',
        borderRadius: 'var(--radius-sm)',
        fontSize: '12.5px',
        color: 'var(--text-secondary)',
        lineHeight: '1.6'
      }}>
        <strong>Admin URL:</strong> Open <code>https://stat72du.vercel.app/?admin=true</code> (or <code>?page=admin</code>). Locally: <code>http://localhost:5173/?admin=true</code>. Share only with authorized personnel.
      </div>

      {/* ── Admin Notification Panel ────────────────────────────── */}
      <section className="admin-section" id="admin-notification-section">
        <h3 className="admin-section-title">
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{ color: 'var(--accent)' }}>
            <path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9" />
            <path d="M13.73 21a2 2 0 0 1-3.46 0" />
          </svg>
          Send Push Notifications
        </h3>
        
        <form onSubmit={handleSendNotification}>
          <div className="admin-form-grid" style={{ gap: '16px' }}>
            <div className="admin-form-group" style={{ gridColumn: 'span 2' }}>
              <label className="admin-label">Recipients</label>
              <div style={{ display: 'flex', gap: '16px', marginBottom: '8px' }}>
                <label style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '13px', cursor: 'pointer', color: 'var(--text-main)' }}>
                  <input
                    type="radio"
                    name="notifTargetType"
                    value="all"
                    checked={notifTargetType === 'all'}
                    onChange={() => { setNotifTargetType('all'); setSelectedStudentIds([]); }}
                  />
                  All Users (Broadcast)
                </label>
                <label style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '13px', cursor: 'pointer', color: 'var(--text-main)' }}>
                  <input
                    type="radio"
                    name="notifTargetType"
                    value="custom"
                    checked={notifTargetType === 'custom'}
                    onChange={() => setNotifTargetType('custom')}
                  />
                  Select Multiple Users
                </label>
              </div>

              {notifTargetType === 'custom' && (
                <div style={{
                  background: 'var(--bg-surface-2)',
                  border: '1px solid var(--border-hairline)',
                  borderRadius: 'var(--radius-sm)',
                  padding: '12px',
                  maxHeight: '240px',
                  display: 'flex',
                  flexDirection: 'column',
                  gap: '8px',
                  marginTop: '4px'
                }}>
                  <input
                    type="text"
                    className="admin-input"
                    placeholder="Search students by name, roll, or registration..."
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    style={{ marginBottom: '4px', height: '36px', fontSize: '12.5px' }}
                  />
                  
                  <div style={{ overflowY: 'auto', flexGrow: 1, display: 'flex', flexDirection: 'column', gap: '6px', paddingRight: '4px' }}>
                    {filteredStudents.length === 0 ? (
                      <div style={{ fontSize: '12.5px', color: 'var(--text-tertiary)', textAlign: 'center', padding: '8px' }}>
                        No matching students found
                      </div>
                    ) : (
                      filteredStudents.map(student => {
                        const isChecked = selectedStudentIds.includes(student.id);
                        return (
                          <label
                            key={student.id}
                            style={{
                              display: 'flex',
                              alignItems: 'center',
                              gap: '8px',
                              fontSize: '12.5px',
                              cursor: 'pointer',
                              color: isChecked ? 'var(--accent)' : 'var(--text-main)',
                              background: isChecked ? 'rgba(232, 71, 43, 0.04)' : 'transparent',
                              padding: '4px 6px',
                              borderRadius: '4px',
                              transition: 'background 100ms ease'
                            }}
                          >
                            <input
                              type="checkbox"
                              checked={isChecked}
                              onChange={() => handleToggleStudentSelect(student.id)}
                            />
                            <span style={{ fontWeight: isChecked ? '600' : 'normal' }}>
                              {student.name}
                            </span>
                            <span style={{ fontSize: '11px', color: 'var(--text-tertiary)' }}>
                              (Roll: {student.class_roll} • Reg: {student.registration_number})
                            </span>
                          </label>
                        );
                      })
                    )}
                  </div>
                  
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderTop: '1px solid var(--border-hairline)', paddingTop: '8px', fontSize: '11.5px', color: 'var(--text-secondary)' }}>
                    <span>Selected: {selectedStudentIds.length} student(s)</span>
                    {selectedStudentIds.length > 0 && (
                      <button
                        type="button"
                        onClick={() => setSelectedStudentIds([])}
                        style={{ background: 'none', border: 'none', color: 'var(--accent)', fontWeight: '600', cursor: 'pointer', padding: 0 }}
                      >
                        Clear All
                      </button>
                    )}
                  </div>
                </div>
              )}
            </div>
            
            <div className="admin-form-group" style={{ gridColumn: 'span 2' }}>
              <label className="admin-label" htmlFor="notif-title">Notification Title *</label>
              <input
                id="notif-title"
                className="admin-input"
                type="text"
                placeholder="e.g. Class Rescheduled"
                value={notifTitle}
                onChange={(e) => setNotifTitle(e.target.value)}
                required
              />
            </div>

            <div className="admin-form-group" style={{ gridColumn: 'span 2' }}>
              <label className="admin-label" htmlFor="notif-body">Notification Message *</label>
              <textarea
                id="notif-body"
                className="admin-input"
                placeholder="Type your message here..."
                value={notifBody}
                onChange={(e) => setNotifBody(e.target.value)}
                style={{
                  minHeight: '80px',
                  padding: '12px',
                  fontFamily: 'inherit',
                  resize: 'vertical',
                  background: 'var(--bg-surface-2)',
                  border: '1px solid var(--border-hairline)',
                  color: 'var(--text-main)',
                  borderRadius: 'var(--radius-sm)'
                }}
                required
              />
            </div>
          </div>

          <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginTop: '16px' }}>
            <button
              type="submit"
              className="admin-btn"
              disabled={!notifTitle.trim() || !notifBody.trim() || (notifTargetType === 'custom' && selectedStudentIds.length === 0)}
            >
              Send Notification
            </button>
            {notifSendStatus && (
              <span style={{
                color: notifSendStatus.startsWith('Error') ? 'var(--accent)' : 'var(--gold-600)',
                fontSize: '13px',
                fontWeight: '500'
              }}>
                {notifSendStatus}
              </span>
            )}
          </div>
        </form>

        {/* Broadcast History list */}
        {broadcasts.length > 0 && (
          <div style={{ marginTop: '24px' }}>
            <h4 style={{ fontSize: '13px', color: 'var(--text-secondary)', marginBottom: '12px', fontWeight: '600' }}>
              Recent Notification Log
            </h4>
            <div className="admin-folders-list">
              {broadcasts.map((b) => {
                const targetStudent = students.find(s => s.id === b.target);
                const targetLabel = b.target === 'all' 
                  ? 'All Users' 
                  : Array.isArray(b.target)
                    ? `${b.target.length} Selected Users`
                    : targetStudent 
                      ? `${targetStudent.name} (Roll: ${targetStudent.class_roll})`
                      : 'Selected User';

                return (
                  <div key={b.id} className="admin-folder-row-item" style={{ alignItems: 'flex-start' }}>
                    <div className="admin-folder-info" style={{ gap: '2px' }}>
                      <div className="admin-folder-title" style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                        <span>{b.title}</span>
                        <span 
                          style={{
                            fontSize: '10px',
                            background: b.target === 'all' ? 'rgba(232, 71, 43, 0.1)' : 'rgba(82,0,224,0.1)',
                            color: b.target === 'all' ? 'var(--accent)' : 'var(--navy-400)',
                            padding: '2px 6px',
                            borderRadius: '4px',
                            fontWeight: '600',
                            cursor: 'help'
                          }}
                          title={getTargetTooltip(b.target)}
                        >
                          {targetLabel}
                        </span>
                      </div>
                      <div style={{ fontSize: '12.5px', color: 'var(--text-secondary)', marginTop: '4px' }}>{b.body}</div>
                      <div className="admin-folder-link" style={{ fontSize: '11px', marginTop: '4px' }}>
                        Sent at: {new Date(b.created_at).toLocaleString()}
                      </div>
                    </div>
                    <div className="admin-actions" style={{ alignSelf: 'center' }}>
                      <button
                        className="admin-icon-btn delete"
                        onClick={() => handleDeleteNotification(b.id)}
                        aria-label="Delete notification permanently"
                        title="Delete permanently"
                      >
                        <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                          <polyline points="3 6 5 6 21 6" />
                          <path d="M19 6v14a2 2 0 01-2 2H7a2 2 0 01-2-2V6m3 0V4a2 2 0 012-2h4a2 2 0 012 2v2" />
                        </svg>
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        )}
      </section>

      {/* ── Google API Key ───────────────────────────────────────────── */}
      <section className="admin-section">
        <h3 className="admin-section-title">
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <rect x="3" y="11" width="18" height="11" rx="2" ry="2" />
            <path d="M7 11V7a5 5 0 0110 0v4" />
          </svg>
          Google Drive API Settings
        </h3>
        <form onSubmit={handleApiKeySubmit} className="admin-form-grid">
          <div className="admin-form-group">
            <label className="admin-label" htmlFor="api-key-input">Google Cloud API Key</label>
            <input
              id="api-key-input"
              className="admin-input"
              type="text"
              value={newApiKey}
              onChange={(e) => setNewApiKey(e.target.value)}
              placeholder="AIzaSy..."
              spellCheck="false"
              autoComplete="off"
            />
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
            <button type="submit" className="admin-btn">Save API Key</button>
            {apiSaveStatus && (
              <span className="caption" style={{ color: apiSaveStatus.startsWith('Error:') ? 'var(--accent)' : 'var(--gold-600)' }}>
                {apiSaveStatus}
              </span>
            )}
          </div>
        </form>
      </section>

      {/* ── Telegram Config ──────────────────────────────────────────── */}
      <section className="admin-section">
        <h3 className="admin-section-title">
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <line x1="22" y1="2" x2="11" y2="13" />
            <polygon points="22 2 15 22 11 13 2 9 22 2" />
          </svg>
          Telegram Integration Config
        </h3>
        <form onSubmit={handleTelegramSubmit} className="admin-form-grid">
          <div className="admin-form-group">
            <label className="admin-label" htmlFor="tg-token-input">Bot API Token</label>
            <input
              id="tg-token-input"
              className="admin-input"
              type="text"
              value={newTgToken}
              onChange={(e) => setNewTgToken(e.target.value)}
              placeholder="8887541572:AAGT..."
              spellCheck="false"
              autoComplete="off"
            />
          </div>
          <div className="admin-form-group">
            <label className="admin-label" htmlFor="tg-chat-id-input">Group Chat ID</label>
            <input
              id="tg-chat-id-input"
              className="admin-input"
              type="text"
              value={newTgChatId}
              onChange={(e) => setNewTgChatId(e.target.value)}
              placeholder="e.g. -1002244668800"
              spellCheck="false"
              autoComplete="off"
            />
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
            <button type="submit" className="admin-btn">Save Telegram Config</button>
            <button type="button" className="admin-btn admin-btn-secondary" onClick={handleResetTelegram}>
              Reset Sync
            </button>
            {tgSaveStatus && (
              <span className="caption" style={{ color: tgSaveStatus.startsWith('Error:') ? 'var(--accent)' : 'var(--gold-600)' }}>
                {tgSaveStatus}
              </span>
            )}
          </div>
        </form>
      </section>

      {/* ── Topic Name Overrides ─────────────────────────────────────── */}
      <section className="admin-section">
        <h3 className="admin-section-title">
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M4 19.5A2.5 2.5 0 0 1 6.5 17H20" />
            <path d="M6.5 2H20v20H6.5A2.5 2.5 0 0 1 4 19.5v-15A2.5 2.5 0 0 1 6.5 2z" />
          </svg>
          Telegram Folder Names Override
        </h3>

        {allKnownThreadIds.length === 0 ? (
          <p className="caption" style={{ color: 'var(--text-tertiary)', padding: '8px 0 16px' }}>
            No topics auto-detected yet. You can manually pre-define Thread ID naming configurations below.
          </p>
        ) : (
          <div className="admin-folders-list" style={{ marginBottom: '20px' }}>
            {allKnownThreadIds.map((tid) => {
              const { name, source } = getEffectiveName(tid);
              return (
                <div key={tid} className="admin-folder-row-item">
                  <div className="admin-folder-info">
                    <div className="admin-folder-title">{name}</div>
                    <div className="admin-folder-link">Thread ID: {tid}</div>
                  </div>
                  <span style={{
                    fontSize: '9px',
                    fontWeight: '600',
                    letterSpacing: '0.06em',
                    padding: '2px 7px',
                    borderRadius: '4px',
                    display: 'inline-block',
                    background: source === 'custom'
                      ? 'rgba(82,0,224,0.15)'
                      : source === 'auto'
                        ? 'rgba(0,180,100,0.15)'
                        : 'var(--bg-surface-2)',
                    color: source === 'custom'
                      ? 'var(--navy-400)'
                      : source === 'auto'
                        ? '#22c55e'
                        : 'var(--text-tertiary)',
                  }}>
                    {source === 'custom' ? 'CUSTOM' : source === 'auto' ? 'AUTO' : 'ID'}
                  </span>
                  <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '6px' }}>
                    {customNames[tid] && (
                      <button
                        className="admin-icon-btn delete"
                        title="Remove custom name"
                        onClick={() => handleDeleteTopicName(tid)}
                      >
                        <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                          <polyline points="3 6 5 6 21 6" />
                          <path d="M19 6v14a2 2 0 01-2 2H7a2 2 0 01-2-2V6m3 0V4a2 2 0 012-2h4a2 2 0 012 2v2" />
                        </svg>
                      </button>
                    )}
                    <button
                      className="admin-icon-btn"
                      title={`Edit name for thread ${tid}`}
                      onClick={() => { setNewThreadId(tid); setNewTopicName(name !== `Thread ${tid}` ? name : ''); }}
                    >
                      <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                        <path d="M11 4H4a2 2 0 00-2 2v14a2 2 0 002 2h14a2 2 0 002-2v-7" />
                        <path d="M18.5 2.5a2.121 2.121 0 113 3L12 15l-4 1 1-4 9.5-9.5z" />
                      </svg>
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        )}

        <form onSubmit={handleSaveTopicName} className="admin-form-grid">
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 2fr', gap: '12px' }}>
            <div className="admin-form-group" style={{ marginBottom: 0 }}>
              <label className="admin-label" htmlFor="topic-thread-id">Thread ID</label>
              <input
                id="topic-thread-id"
                className="admin-input"
                type="text"
                value={newThreadId}
                onChange={(e) => setNewThreadId(e.target.value)}
                placeholder="e.g. 9"
                spellCheck="false"
              />
            </div>
            <div className="admin-form-group" style={{ marginBottom: 0 }}>
              <label className="admin-label" htmlFor="topic-name-input">Custom Name</label>
              <input
                id="topic-name-input"
                className="admin-input"
                type="text"
                value={newTopicName}
                onChange={(e) => setNewTopicName(e.target.value)}
                placeholder="e.g. Physics Notes"
              />
            </div>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
            <button
              type="submit"
              className="admin-btn"
              disabled={!newThreadId.trim() || !newTopicName.trim()}
            >
              Save Topic Name
            </button>
            {topicSaveStatus && (
              <span className="caption" style={{ color: 'var(--gold-600)' }}>{topicSaveStatus}</span>
            )}
          </div>
        </form>
      </section>

      {/* ── Drive Folder Links ───────────────────────────────────────── */}
      <section className="admin-section">
        <h3 className="admin-section-title">
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M22 19a2 2 0 01-2 2H4a2 2 0 01-2-2V5a2 2 0 012-2h5l2 3h9a2 2 0 012 2z" />
            <line x1="12" y1="11" x2="12" y2="17" />
            <line x1="9" y1="14" x2="15" y2="14" />
          </svg>
          {editingId ? 'Edit Drive Folder' : 'Add Drive Folder'}
        </h3>
        <form onSubmit={handleFolderSubmit} className="admin-form-grid">
          <div className="admin-form-group">
            <label className="admin-label" htmlFor="folder-name-input">Folder Name</label>
            <input
              id="folder-name-input"
              className="admin-input"
              type="text"
              value={folderName}
              onChange={(e) => setFolderName(e.target.value)}
              placeholder="e.g. Physics I"
              required
            />
          </div>
          <div className="admin-form-group">
            <label className="admin-label" htmlFor="folder-link-input">Google Drive Share Link or Folder ID</label>
            <input
              id="folder-link-input"
              className="admin-input"
              type="text"
              value={folderLink}
              onChange={(e) => setFolderLink(e.target.value)}
              placeholder="https://drive.google.com/drive/folders/..."
              spellCheck="false"
              required
            />
          </div>
          <div style={{ display: 'flex', gap: '8px' }}>
            <button type="submit" className="admin-btn">
              {editingId ? 'Update Folder' : 'Add Folder'}
            </button>
            {editingId && (
              <button type="button" className="admin-btn admin-btn-secondary" onClick={handleCancelEdit}>
                Cancel
              </button>
            )}
          </div>
        </form>
      </section>

      {/* ── Configured Folders List ──────────────────────────────────── */}
      <section className="admin-section">
        <h3 className="admin-section-title">
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M14 2H6a2 2 0 00-2 2v16a2 2 0 002 2h12a2 2 0 002-2V8z" />
            <polyline points="14 2 14 8 20 8" />
            <line x1="16" y1="13" x2="8" y2="13" />
            <line x1="16" y1="17" x2="8" y2="17" />
          </svg>
          Configured Folders ({foldersList.length})
        </h3>
        {foldersList.length === 0 ? (
          <p className="caption" style={{ color: 'var(--text-tertiary)', textAlign: 'center', padding: '16px 0' }}>
            No folders configured yet.
          </p>
        ) : (
          <div className="admin-folders-list">
            {foldersList.map((folder) => (
              <div key={folder.id} className="admin-folder-row-item">
                <div className="admin-folder-info">
                  <div className="admin-folder-title">{folder.name}</div>
                  <div className="admin-folder-link">{folder.driveLink || folder.folderId}</div>
                </div>
                <div className="admin-actions">
                  <button
                    className="admin-icon-btn"
                    onClick={() => handleEditInit(folder)}
                    aria-label="Edit folder"
                    title="Edit"
                  >
                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                      <path d="M11 4H4a2 2 0 00-2 2v14a2 2 0 002 2h14a2 2 0 002-2v-7" />
                      <path d="M18.5 2.5a2.121 2.121 0 113 3L12 15l-4 1 1-4 9.5-9.5z" />
                    </svg>
                  </button>
                  <button
                    className="admin-icon-btn delete"
                    onClick={() => handleDelete(folder.id)}
                    aria-label="Delete folder"
                    title="Delete"
                  >
                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                      <polyline points="3 6 5 6 21 6" />
                      <path d="M19 6v14a2 2 0 01-2 2H7a2 2 0 01-2-2V6m3 0V4a2 2 0 012-2h4a2 2 0 012 2v2" />
                    </svg>
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </section>

      {/* ── Exam Schedule Management ──────────────────────────────── */}
      <section className="admin-section" id="exam-schedule-section">
        <h3 className="admin-section-title">
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <rect x="3" y="4" width="18" height="18" rx="2" ry="2" />
            <line x1="16" y1="2" x2="16" y2="6" /><line x1="8" y1="2" x2="8" y2="6" /><line x1="3" y1="10" x2="21" y2="10" />
          </svg>
          Exam Schedule
        </h3>
        <form onSubmit={handleExamSubmit}>
          <div className="admin-form-grid">
            <div className="admin-form-group">
              <label className="admin-label" htmlFor="exam-subject">Subject / Exam Name *</label>
              <input id="exam-subject" className="admin-input" type="text" placeholder="e.g. Physics Final" value={examSubject} onChange={e => setExamSubject(e.target.value)} required />
            </div>
            <div className="admin-form-group">
              <label className="admin-label" htmlFor="exam-date">Date *</label>
              <input id="exam-date" className="admin-input" type="date" value={examDate} onChange={e => setExamDate(e.target.value)} required />
            </div>
            <div className="admin-form-group">
              <label className="admin-label" htmlFor="exam-time">Time</label>
              <input id="exam-time" className="admin-input" type="time" value={examTime} onChange={e => setExamTime(e.target.value)} />
            </div>
            <div className="admin-form-group">
              <label className="admin-label" htmlFor="exam-duration">Duration</label>
              <input id="exam-duration" className="admin-input" type="text" placeholder="e.g. 3 hours" value={examDuration} onChange={e => setExamDuration(e.target.value)} />
            </div>
            <div className="admin-form-group">
              <label className="admin-label" htmlFor="exam-room">Room / Venue</label>
              <input id="exam-room" className="admin-input" type="text" placeholder="e.g. Hall A, Room 302" value={examRoom} onChange={e => setExamRoom(e.target.value)} />
            </div>
            <div className="admin-form-group">
              <label className="admin-label" htmlFor="exam-notes">Notes</label>
              <input id="exam-notes" className="admin-input" type="text" placeholder="Any extra info" value={examNotes} onChange={e => setExamNotes(e.target.value)} />
            </div>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginTop: '16px' }}>
            <button type="submit" className="admin-btn" id="exam-save-btn">Save & Publish to Calendar</button>
            {examSaveStatus && (
              <span style={{ color: 'var(--accent)', fontSize: '13px', fontWeight: '500' }}>{examSaveStatus}</span>
            )}
          </div>
        </form>

        {/* Exam list */}
        {examsList.length > 0 && (
          <div style={{ marginTop: '20px' }}>
            <div style={{ fontSize: '13px', color: 'var(--text-tertiary)', marginBottom: '10px', fontFamily: 'var(--font-mono)' }}>
              {examsList.length} exam{examsList.length !== 1 ? 's' : ''} scheduled
            </div>
            <div className="admin-folders-list">
              {examsList.map((exam) => (
                <div key={exam.id} className="admin-folder-row-item">
                  <div className="admin-folder-info">
                    <div className="admin-folder-title">{exam.subject}</div>
                    <div className="admin-folder-link">
                      {exam.date}{exam.time ? ` · ${exam.time}` : ''}{exam.duration ? ` · ${exam.duration}` : ''}{exam.room ? ` · ${exam.room}` : ''}
                    </div>
                  </div>
                  <div className="admin-actions">
                    <button
                      className="admin-icon-btn delete"
                      onClick={() => handleDeleteExam(exam.id)}
                      aria-label="Delete exam"
                      title="Delete"
                    >
                      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                        <polyline points="3 6 5 6 21 6" />
                        <path d="M19 6v14a2 2 0 01-2 2H7a2 2 0 01-2-2V6m3 0V4a2 2 0 012-2h4a2 2 0 012 2v2" />
                      </svg>
                    </button>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}
      </section>
      </>
      )}
    </div>
  );
}
