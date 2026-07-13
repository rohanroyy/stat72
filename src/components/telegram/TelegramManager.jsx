import React, { useState, useEffect, useRef } from 'react';
import {
  getTelegramData,
  syncTelegramUpdates,
  getTelegramConfig,
  getTopicName,
} from '../../services/telegramService';

import TopBar from '../layout/TopBar';
import Breadcrumb from '../filemanager/Breadcrumb';
import SectionLabel from '../filemanager/SectionLabel';
import FolderRow from '../filemanager/FolderRow';
import FileRow from '../filemanager/FileRow';
import FilterPills from '../filemanager/FilterPills';
import { EmptyState, ErrorState, LoadingSkeleton } from '../filemanager/EmptyState';

const POLL_INTERVAL = 30000;

export default function TelegramManager({ onOpenFile, onRegisterRefresh }) {
  // Read config fresh on each render — config is passed through App state
  const { token, chatId } = getTelegramConfig();

  const [folders, setFolders] = useState([]);
  const [files, setFiles] = useState([]);
  const [loading, setLoading] = useState(true);
  const [syncing, setSyncing] = useState(false);
  const [error, setError] = useState(null);
  const [lastUpdated, setLastUpdated] = useState(null);
  const [activeFilter, setActiveFilter] = useState('all');

  // Navigation State
  const [breadcrumbs, setBreadcrumbs] = useState([
    { id: 'root', name: 'Telegram Forums' }
  ]);

  const currentFolderId = breadcrumbs[breadcrumbs.length - 1].id;
  const isRoot = currentFolderId === 'root';

  // Use refs so polling closure always reads latest token/chatId
  const tokenRef = useRef(token);
  const chatIdRef = useRef(chatId);
  tokenRef.current = token;
  chatIdRef.current = chatId;

  // Core sync function — reads fresh config via refs
  const doSync = async (showLoading = false) => {
    const currentToken = tokenRef.current;
    const currentChatId = chatIdRef.current;

    if (!currentToken || !currentChatId) {
      setLoading(false);
      return;
    }

    if (showLoading) {
      setLoading(true);
    } else {
      setSyncing(true);
    }
    setError(null);

    try {
      const result = await syncTelegramUpdates(currentToken, currentChatId);
      // Apply custom name overrides on top of auto-detected names
      const namedFolders = result.folders.map(f => ({
        ...f,
        name: getTopicName(f.id),
      }));
      setFolders(namedFolders);
      setFiles(result.files);
      setLastUpdated(new Date());
    } catch (err) {
      console.error('Telegram sync error:', err);
      // On failure, still load whatever is cached locally
      const cached = getTelegramData();
      setFolders(cached.folders);
      setFiles(cached.files);
      if (cached.folders.length === 0 && cached.files.length === 0) {
        setError(err.message || 'Failed to connect to Telegram. Check your bot token and chat ID.');
      }
    } finally {
      setLoading(false);
      setSyncing(false);
    }
  };

  // Load cached data immediately on mount, then sync
  useEffect(() => {
    // Show cached data instantly, applying any custom topic name overrides
    const cached = getTelegramData();
    const namedFolders = cached.folders.map(f => ({
      ...f,
      name: getTopicName(f.id),
    }));
    setFolders(namedFolders);
    setFiles(cached.files);

    if (!token || !chatId) {
      setLoading(false);
      return;
    }

    // Kick off initial sync (show loading skeleton only if no cached data)
    doSync(cached.folders.length === 0 && cached.files.length === 0);

    // Setup polling every 30s
    const interval = setInterval(() => {
      doSync(false);
    }, POLL_INTERVAL);

    // Refetch on tab focus
    const handleVisibility = () => {
      if (document.visibilityState === 'visible') {
        doSync(false);
      }
    };
    document.addEventListener('visibilitychange', handleVisibility);

    return () => {
      clearInterval(interval);
      document.removeEventListener('visibilitychange', handleVisibility);
    };
    // Only re-run when token/chatId change (config was updated)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [token, chatId]);


  const handleRefresh = () => {
    doSync(true);
  };

  // Register with parent pull-to-refresh system
  useEffect(() => {
    if (onRegisterRefresh) {
      onRegisterRefresh(() => {
        doSync(true);
        return new Promise(resolve => setTimeout(resolve, 1500));
      });
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [onRegisterRefresh]);

  // Navigation
  const handleNavigateToFolder = (id, name) => {
    setBreadcrumbs(prev => [...prev, { id, name }]);
    setActiveFilter('all');
  };

  const handleNavigateBack = () => {
    if (breadcrumbs.length > 1) {
      setBreadcrumbs(prev => prev.slice(0, -1));
    }
  };

  const handleNavigateBreadcrumb = (index) => {
    setBreadcrumbs(prev => prev.slice(0, index + 1));
  };

  const [historyFolders, setHistoryFolders] = useState([]);
  const [historyFiles, setHistoryFiles] = useState([]);

  // Fetch public/telegram_history.json if available
  useEffect(() => {
    async function loadHistoryFile() {
      try {
        const res = await fetch('/telegram_history.json');
        if (res.ok) {
          const data = await res.json();
          if (data.folders) setHistoryFolders(data.folders);
          if (data.files) setHistoryFiles(data.files);
        }
      } catch (err) {
        console.log('History file load skipped:', err);
      }
    }
    loadHistoryFile();
  }, []);

  // Merge lists (live synced + CLI fetched history)
  const allFolders = [...folders];
  historyFolders.forEach(hf => {
    if (!allFolders.some(f => String(f.id) === String(hf.id))) {
      allFolders.push(hf);
    }
  });

  const allFiles = [...files];
  historyFiles.forEach(hf => {
    if (!allFiles.some(f => String(f.id) === String(hf.id) || (f.uniqueId && f.uniqueId === hf.uniqueId))) {
      allFiles.push(hf);
    }
  });

  // Derive display lists using merged data
  const visibleFolders = isRoot ? allFolders : [];

  // Files inside a topic: match by the topic's ID in the file's parents array
  const topicFiles = isRoot
    ? []
    : allFiles.filter(f => Array.isArray(f.parents) && f.parents.some(p => String(p) === String(currentFolderId)));

  const filteredFiles = activeFilter === 'all'
    ? topicFiles
    : topicFiles.filter(f => f.fileType === activeFilter);

  // Count items per folder
  const folderCounts = {};
  allFolders.forEach(folder => {
    folderCounts[folder.id] = allFiles.filter(
      f => Array.isArray(f.parents) && f.parents.some(p => String(p) === String(folder.id))
    ).length;
  });

  const showFolders = visibleFolders.length > 0;
  const showFiles = filteredFiles.length > 0;
  const isEmpty = !showFolders && !showFiles && !loading;

  const titleText = isRoot ? 'Telegram Files' : breadcrumbs[breadcrumbs.length - 1].name;


  return (
    <>
      <TopBar
        title="Telegram"
        lastUpdated={lastUpdated}
        loading={loading}
        onRefresh={handleRefresh}
      />

      <div style={{ padding: '0 8px' }}>
        {/* Header bar — only visible when viewing a specific topic folder */}
        {!isRoot && (
          <div
            style={{
              padding: '16px 16px 8px 16px',
              display: 'flex',
              alignItems: 'center',
              gap: '12px',
            }}
          >
            <button className="header-back-btn" onClick={handleNavigateBack}>
              Back
            </button>
            <h2
              className="body-l"
              style={{ fontWeight: '600', fontSize: '18px', display: 'flex', alignItems: 'center', gap: '8px', margin: 0 }}
            >
              {titleText}
              {syncing && <span className="syncing-indicator-dot" />}
            </h2>
          </div>
        )}

        {/* Breadcrumb Trail */}
        <Breadcrumb breadcrumbs={breadcrumbs} onNavigate={handleNavigateBreadcrumb} />



        {/* Filter Pills — only inside a topic folder */}
        {!isRoot && topicFiles.length > 0 && (
          <FilterPills
            activeFilter={activeFilter}
            onFilterChange={setActiveFilter}
            filesCount={topicFiles.length}
          />
        )}

        {/* Error state */}
        {error && !loading && (
          <ErrorState error={error} onRetry={handleRefresh} />
        )}

        {/* Content */}
        {loading && visibleFolders.length === 0 && topicFiles.length === 0 ? (
          <LoadingSkeleton />
        ) : isEmpty ? (
          <div style={{ padding: '48px 24px', textAlign: 'center', color: 'var(--text-tertiary)' }}>
            <svg width="40" height="40" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" style={{ color: 'var(--text-tertiary)', marginBottom: '16px' }}>
              <circle cx="12" cy="12" r="10" />
              <line x1="12" y1="8" x2="12" y2="12" />
              <line x1="12" y1="16" x2="12.01" y2="16" />
            </svg>
            <div style={{ fontSize: '16px', fontWeight: '600', color: 'var(--text-secondary)', marginBottom: '8px' }}>
              {isRoot ? 'No topics found yet' : 'No files in this topic yet'}
            </div>
            <div style={{ fontSize: '13px', lineHeight: '1.6' }}>
              {isRoot
                ? 'Send a file inside any topic in your Telegram group, then press the refresh button to sync.'
                : 'Send a file inside this topic in your Telegram group, then press the refresh button.'}
            </div>
          </div>
        ) : (
          <>
            {showFolders && (
              <>
                <SectionLabel label="Group Topics" />
                <div className="file-list">
                  {visibleFolders.map(folder => (
                    <FolderRow
                      key={folder.id}
                      folder={folder}
                      itemCount={folderCounts[folder.id]}
                      onClick={handleNavigateToFolder}
                    />
                  ))}
                </div>
              </>
            )}

            {showFiles && (
              <>
                <SectionLabel label="Files" />
                <div className="file-list">
                  {filteredFiles.map(file => (
                    <FileRow
                      key={file.id}
                      file={file}
                      onClick={onOpenFile}
                    />
                  ))}
                </div>
              </>
            )}
          </>
        )}
      </div>
    </>
  );
}
