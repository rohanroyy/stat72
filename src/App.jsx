import React, { useState, useCallback, useEffect } from 'react';
import BottomNav from './components/layout/BottomNav';
import RootFoldersList from './components/filemanager/RootFoldersList';
import FileManagerContainer from './components/filemanager/FileManagerContainer';
import AdminPage from './components/admin/AdminPage';
import AdminLogin from './components/admin/AdminLogin';
import ViewerModal from './components/viewers/ViewerModal';
import PDFViewer from './components/viewers/PDFViewer';
import ImageViewer from './components/viewers/ImageViewer';
import VideoViewer from './components/viewers/VideoViewer';
import ApiKeySetup from './components/setup/ApiKeySetup';
import TelegramSetup from './components/telegram/TelegramSetup';
import TelegramManager from './components/telegram/TelegramManager';
import ExamCalendar from './components/calendar/ExamCalendar';
import AnnouncementPage from './components/announcement/AnnouncementPage';
import { DEFAULT_FOLDERS, getApiKey, setRuntimeApiKey } from './config/drive';
import { getTelegramConfig, saveTelegramConfig, clearTelegramConfig } from './services/telegramService';
import { fetchExams, saveExam as saveExamToStorage, deleteExam as deleteExamFromStorage, subscribeToExams } from './services/examService';
import { fetchFolders, saveAllFolders, subscribeToFolders } from './services/foldersService';
import { saveGoogleApiKey, saveTelegramSettings, clearTelegramSettings, subscribeToSettings, fetchAppSettings } from './services/settingsService';
import { loadAppData } from './services/dataService';
import { isSupabaseConfigured } from './lib/supabase';

const STORAGE_API_KEY = 'studydock_api_key';
const STORAGE_FOLDERS_KEY = 'studydock_configured_folders';
const EXAMS_BROADCAST_CHANNEL = 'studydock_exams_sync';

export default function App() {
  const [bootState, setBootState] = useState({ loading: true, error: null, data: null });
  const [localApiKey, setLocalApiKey] = useState('');

  useEffect(() => {
    let cancelled = false;

    loadAppData()
      .then((data) => {
        if (cancelled) return;
        setLocalApiKey(data.settings.googleApiKey || '');
        setBootState({ loading: false, error: null, data });
      })
      .catch((err) => {
        if (cancelled) return;
        console.error('Failed to load app data:', err);
        setLocalApiKey(getApiKey());
        setBootState({
          loading: false,
          error: err.message,
          data: {
            exams: [],
            folders: DEFAULT_FOLDERS,
            settings: { googleApiKey: getApiKey(), telegram: { token: '', chatId: '' } },
            useLocalOnly: true,
          },
        });
      });

    return () => {
      cancelled = true;
    };
  }, []);

  const handleApiKeySubmit = useCallback(async (key) => {
    localStorage.setItem(STORAGE_API_KEY, key);
    setRuntimeApiKey(key);
    setLocalApiKey(key);
    if (isSupabaseConfigured()) {
      await saveGoogleApiKey(key);
    }
    window.location.reload();
  }, []);

  if (bootState.loading) {
    return (
      <div className="setup-screen">
        <div className="setup-logo">Bahattor</div>
        <div className="setup-card" style={{ textAlign: 'center' }}>
          <div className="pdf-loading-spinner" style={{ margin: '0 auto 16px', borderTopColor: 'var(--accent)' }} />
          <p>Loading from database...</p>
        </div>
      </div>
    );
  }

  if (bootState.error && isSupabaseConfigured()) {
    return (
      <div className="setup-screen">
        <div className="setup-logo">Bahattor</div>
        <div className="setup-card">
          <h2>Database Connection Failed</h2>
          <p style={{ color: 'var(--accent)', marginTop: '12px' }}>{bootState.error}</p>
          <p style={{ marginTop: '16px', color: 'var(--text-secondary)', lineHeight: 1.6 }}>
            Check that <code>VITE_SUPABASE_URL</code> matches your project (Settings → API in Supabase)
            and that you ran <code>supabase/schema.sql</code> in the SQL Editor.
          </p>
          <button
            type="button"
            className="setup-submit"
            style={{ marginTop: '20px' }}
            onClick={() => window.location.reload()}
          >
            Retry
          </button>
        </div>
      </div>
    );
  }

  const effectiveApiKey = import.meta.env.VITE_GOOGLE_API_KEY || localApiKey;
  const hasApiKey = !!effectiveApiKey;

  if (!hasApiKey) {
    return <ApiKeySetup onKeySubmit={handleApiKeySubmit} />;
  }

  return (
    <AppMain
      initialData={bootState.data}
      localApiKey={effectiveApiKey}
      onSaveApiKey={handleApiKeySubmit}
    />
  );
}

function AppMain({ initialData, localApiKey, onSaveApiKey }) {
  const [foldersList, setFoldersList] = useState(() => initialData?.folders || DEFAULT_FOLDERS);

  const [selectedRootFolder, setSelectedRootFolder] = useState(() => {
    try {
      const stored = localStorage.getItem('studydock_selected_folder');
      return stored ? JSON.parse(stored) : null;
    } catch {
      return null;
    }
  });

  // Active Navigation Tab: 'calendar' | 'files' | 'telegram' | 'announcement'
  const [activeTab, setActiveTab] = useState(() => {
    return localStorage.getItem('studydock_active_tab') || 'calendar';
  });

  const [tgConfig, setTgConfig] = useState(() => {
    if (initialData?.settings?.telegram?.chatId || initialData?.settings?.telegram?.token) {
      return initialData.settings.telegram;
    }
    return getTelegramConfig();
  });

  const [examsList, setExamsList] = useState(() => initialData?.exams || []);

  // Supabase realtime + cross-tab sync
  useEffect(() => {
    const reloadExams = () => {
      fetchExams().then(setExamsList).catch(console.error);
    };
    const reloadFolders = () => {
      fetchFolders().then(setFoldersList).catch(console.error);
    };
    const reloadSettings = async () => {
      try {
        const settings = await fetchAppSettings();
        if (settings.telegram) setTgConfig(settings.telegram);
        if (settings.googleApiKey) setRuntimeApiKey(settings.googleApiKey);
      } catch (err) {
        console.error(err);
      }
    };

    const unsubExams = subscribeToExams(reloadExams);
    const unsubFolders = subscribeToFolders(reloadFolders);
    const unsubSettings = subscribeToSettings(reloadSettings);

    return () => {
      unsubExams();
      unsubFolders();
      unsubSettings();
    };
  }, []);

  // BroadcastChannel: sync exam changes across all open tabs in real-time
  useEffect(() => {
    const channel = new BroadcastChannel(EXAMS_BROADCAST_CHANNEL);
    channel.onmessage = (e) => {
      if (e.data?.type === 'exams_updated') {
        fetchExams().then(setExamsList).catch(console.error);
      }
    };
    // Also listen to storage events (covers cross-tab from non-BroadcastChannel sources)
    const onStorage = (e) => {
      if (e.key === 'studydock_exams') fetchExams().then(setExamsList).catch(console.error);
    };
    window.addEventListener('storage', onStorage);
    return () => {
      channel.close();
      window.removeEventListener('storage', onStorage);
    };
  }, []);

  const handleSaveExam = useCallback(async (examData) => {
    const updated = await saveExamToStorage(examData);
    setExamsList(updated);
    try { new BroadcastChannel(EXAMS_BROADCAST_CHANNEL).postMessage({ type: 'exams_updated' }); } catch (_) {}
    return updated;
  }, []);

  const handleDeleteExam = useCallback(async (id) => {
    const updated = await deleteExamFromStorage(id);
    setExamsList(updated);
    try { new BroadcastChannel(EXAMS_BROADCAST_CHANNEL).postMessage({ type: 'exams_updated' }); } catch (_) {}
    return updated;
  }, []);

  // Admin access state — reactive so we can exit without a full reload
  const [isAdminHost, setIsAdminHost] = useState(() =>
    window.location.hostname.startsWith('admin.') ||
    window.location.search.includes('admin=true') ||
    window.location.search.includes('page=admin')
  );

  const [isAdminAuthenticated, setIsAdminAuthenticated] = useState(() => {
    return sessionStorage.getItem('studydock_admin_authenticated') === 'true';
  });

  const handleSaveFolders = async (updatedFolders) => {
    setFoldersList(updatedFolders);
    await saveAllFolders(updatedFolders);
  };

  const handleSelectRootFolder = (folder) => {
    setSelectedRootFolder(folder);
    if (folder) {
      localStorage.setItem('studydock_selected_folder', JSON.stringify(folder));
    } else {
      localStorage.removeItem('studydock_selected_folder');
    }
  };

  // ── Pull To Refresh Logic ──────────────────────────────────────────────────
  const [pullDistance, setPullDistance] = useState(0);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [isDragging, setIsDragging] = useState(false);
  const [refreshCallbacks, setRefreshCallbacks] = useState({});

  const startYRef = React.useRef(0);
  const activeDragRef = React.useRef(false);

  const registerRefreshCallback = useCallback((tab, cb) => {
    setRefreshCallbacks(prev => ({ ...prev, [tab]: cb }));
  }, []);

  // Sync calendar reload
  useEffect(() => {
    registerRefreshCallback('calendar', async () => {
      const exams = await fetchExams();
      setExamsList(exams);
      return new Promise(resolve => setTimeout(resolve, 800));
    });
  }, [registerRefreshCallback]);

  useEffect(() => {
    registerRefreshCallback('files-root', async () => {
      try {
        const folders = await fetchFolders();
        setFoldersList(folders);
      } catch (err) {
        console.error(err);
      }
      return new Promise(resolve => setTimeout(resolve, 600));
    });
  }, [registerRefreshCallback]);

  const handleTouchStart = (e) => {
    if (isRefreshing) return;
    
    // Header check
    const isHeader = e.target.closest('.topbar, .cal-header, .admin-header');
    if (!isHeader) {
      activeDragRef.current = false;
      return;
    }

    if (window.scrollY > 5) {
      activeDragRef.current = false;
      return;
    }

    activeDragRef.current = true;
    startYRef.current = e.touches[0].clientY;
    setIsDragging(true);
  };

  const handleTouchMove = (e) => {
    if (!activeDragRef.current || isRefreshing) return;

    const currentY = e.touches[0].clientY;
    const diff = currentY - startYRef.current;

    if (diff > 0) {
      const distance = Math.min(80, diff * 0.45);
      setPullDistance(distance);
      if (e.cancelable) {
        e.preventDefault();
      }
    } else {
      setPullDistance(0);
    }
  };

  const handleTouchEnd = async () => {
    if (!activeDragRef.current || isRefreshing) return;
    activeDragRef.current = false;
    setIsDragging(false);

    if (pullDistance >= 50) {
      setIsRefreshing(true);
      setPullDistance(50);

      let handlerKey = activeTab;
      if (activeTab === 'files' && !selectedRootFolder) {
        handlerKey = 'files-root';
      }

      const handler = refreshCallbacks[handlerKey];
      if (handler) {
        try {
          await handler();
        } catch (err) {
          console.error('Refresh error:', err);
        }
      } else {
        await new Promise(resolve => setTimeout(resolve, 800));
      }

      setIsRefreshing(false);
      setPullDistance(0);
    } else {
      setPullDistance(0);
    }
  };

  // Mouse fallback drag for testing on desktop browser simulators
  const handleMouseDown = (e) => {
    if (isRefreshing) return;
    const isHeader = e.target.closest('.topbar, .cal-header, .admin-header');
    if (!isHeader) return;
    if (window.scrollY > 5) return;

    activeDragRef.current = true;
    startYRef.current = e.clientY;
    setIsDragging(true);
  };

  const handleMouseMove = (e) => {
    if (!activeDragRef.current || isRefreshing) return;
    const diff = e.clientY - startYRef.current;
    if (diff > 0) {
      const distance = Math.min(80, diff * 0.45);
      setPullDistance(distance);
      if (e.cancelable) e.preventDefault();
    } else {
      setPullDistance(0);
    }
  };

  const handleMouseUp = () => {
    handleTouchEnd();
  };

  const [tgRefreshKey, setTgRefreshKey] = React.useState(0);

  const handleSaveTelegramConfig = async (token, chatId) => {
    saveTelegramConfig(token, chatId);
    setTgConfig({ token, chatId });
    if (isSupabaseConfigured()) {
      await saveTelegramSettings(token, chatId);
    }
  };

  const handleClearTelegramConfig = async () => {
    clearTelegramConfig();
    setTgConfig({ token: '', chatId: '' });
    setTgRefreshKey((k) => k + 1);
    if (isSupabaseConfigured()) {
      await clearTelegramSettings();
    }
  };

  const handleTelegramFoldersUpdated = () => {
    setTgRefreshKey(k => k + 1);
  };

  const [viewerFile, setViewerFile] = useState(null);

  const handleOpenFile = useCallback((file) => {
    setViewerFile(file);
  }, []);

  const handleCloseViewer = useCallback(() => {
    setViewerFile(null);
  }, []);

  const renderViewer = () => {
    if (!viewerFile) return null;

    if (viewerFile.tgFileId && !viewerFile.url) {
      return (
        <ViewerModal file={viewerFile} onClose={handleCloseViewer}>
          <div style={{
            display: 'flex', flexDirection: 'column', alignItems: 'center',
            justifyContent: 'center', height: '100%', gap: '16px',
            color: 'var(--text-secondary)', textAlign: 'center', padding: '32px',
          }}>
            <svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" style={{ color: 'var(--accent)' }}>
              <path d="M21 16V8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73l7 4a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16z" />
              <polyline points="3.27 6.96 12 12.01 20.73 6.96" />
              <line x1="12" y1="22.08" x2="12" y2="12" />
            </svg>
            <div style={{ fontSize: '17px', fontWeight: '600', color: 'var(--text-primary)' }}>
              File Too Large to Preview
            </div>
            <div style={{ fontSize: '13px', lineHeight: '1.7', maxWidth: '320px', color: 'var(--text-tertiary)' }}>
              This file exceeds Telegram's 20 MB Bot API download limit and cannot be previewed here.
              Open your Telegram group and download it directly from the topic.
            </div>
            <div style={{
              marginTop: '8px', fontSize: '12px', background: 'var(--bg-surface-2)',
              border: '1px solid var(--border-hairline)', borderRadius: 'var(--radius-sm)',
              padding: '8px 14px', color: 'var(--text-tertiary)', fontFamily: 'monospace',
              maxWidth: '100%', overflowX: 'auto',
            }}>
              {viewerFile.name} · {viewerFile.formattedSize}
            </div>
          </div>
        </ViewerModal>
      );
    }

    let ViewerComponent;
    switch (viewerFile.fileType) {
      case 'pdf':
        ViewerComponent = PDFViewer;
        break;
      case 'image':
        ViewerComponent = ImageViewer;
        break;
      case 'video':
        ViewerComponent = VideoViewer;
        break;
      default:
        if (viewerFile.url) {
          window.open(viewerFile.url, '_blank');
        } else if (viewerFile.id && !viewerFile.tgFileId) {
          window.open(`https://drive.google.com/file/d/${viewerFile.id}/view`, '_blank');
        }
        setViewerFile(null);
        return null;
    }

    return (
      <ViewerModal file={viewerFile} onClose={handleCloseViewer}>
        <ViewerComponent file={viewerFile} />
      </ViewerModal>
    );
  };

  const renderContent = () => {
    // If accessing admin area, render login or panel
    if (isAdminHost) {
      if (!isAdminAuthenticated) {
        return (
          <AdminLogin
            onLoginSuccess={() => {
              sessionStorage.setItem('studydock_admin_authenticated', 'true');
              setIsAdminAuthenticated(true);
            }}
          />
        );
      }
      return (
        <AdminPage
          foldersList={foldersList}
          onSaveFolders={handleSaveFolders}
          apiKey={localApiKey}
          onSaveApiKey={onSaveApiKey}
          telegramConfig={tgConfig}
          onSaveTelegramConfig={handleSaveTelegramConfig}
          onClearTelegramConfig={handleClearTelegramConfig}
          onTelegramFoldersUpdated={handleTelegramFoldersUpdated}
          examsList={examsList}
          onSaveExam={handleSaveExam}
          onDeleteExam={handleDeleteExam}
          onClose={() => {
            // Remove admin search params and switch to calendar view without reload
            const url = new URL(window.location);
            url.searchParams.delete('admin');
            url.searchParams.delete('page');
            window.history.replaceState({}, '', url);
            setIsAdminHost(false);
            setActiveTab('calendar');
            localStorage.setItem('studydock_active_tab', 'calendar');
          }}
        />
      );
    }

    if (activeTab === 'calendar') {
      return (
        <ExamCalendar
          exams={examsList}
          onAddExam={null} // No inline add button on calendar for general users
        />
      );
    }

    if (activeTab === 'announcement') {
      return <AnnouncementPage />;
    }

    if (activeTab === 'telegram') {
      if (!tgConfig.chatId) {
        return (
          <div style={{ padding: '40px 24px', textAlign: 'center', color: 'var(--text-secondary)' }}>
            <h2 className="body-l" style={{ fontWeight: '600' }}>Telegram Sync is not configured</h2>
            <p className="caption" style={{ color: 'var(--text-tertiary)', marginTop: '8px' }}>
              Please check back later or contact your administrator.
            </p>
          </div>
        );
      }
      return (
        <TelegramManager
          key={`${tgConfig.token}::${tgConfig.chatId}::${tgRefreshKey}`}
          onOpenFile={handleOpenFile}
          onRegisterRefresh={(cb) => registerRefreshCallback('telegram', cb)}
        />
      );
    }

    if (!selectedRootFolder) {
      return (
        <RootFoldersList
          foldersList={foldersList}
          onSelectFolder={handleSelectRootFolder}
          onOpenAdmin={null} // Hidden for general users
        />
      );
    }

    return (
      <FileManagerContainer
        key={selectedRootFolder.id}
        folder={selectedRootFolder}
        apiKey={localApiKey}
        onNavigateBack={() => {
          setSelectedRootFolder(null);
          localStorage.removeItem('studydock_selected_folder');
        }}
        onOpenFile={handleOpenFile}
        onRegisterRefresh={(cb) => registerRefreshCallback('files', cb)}
      />
    );
  };

  return (
    <div
      className="app-layout"
      onTouchStart={handleTouchStart}
      onTouchMove={handleTouchMove}
      onTouchEnd={handleTouchEnd}
      onMouseDown={handleMouseDown}
      onMouseMove={handleMouseMove}
      onMouseUp={handleMouseUp}
      onMouseLeave={handleMouseUp}
    >
      {/* Pull-to-Refresh indicator */}
      {(pullDistance > 0 || isRefreshing) && (
        <div
          className="ptr-container"
          style={{
            height: isRefreshing ? '50px' : `${pullDistance}px`,
            opacity: isRefreshing ? 1 : Math.min(1, pullDistance / 40),
            transition: isDragging ? 'none' : 'height 0.25s ease, opacity 0.25s ease',
          }}
        >
          <div className="ptr-content">
            {isRefreshing ? (
              <>
                <div className="ptr-spinner" />
                <span>Syncing...</span>
              </>
            ) : pullDistance >= 50 ? (
              <>
                <svg className="ptr-arrow release" width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                  <line x1="12" y1="5" x2="12" y2="19" /><polyline points="19 12 12 19 5 12" />
                </svg>
                <span>Release to refresh</span>
              </>
            ) : (
              <>
                <svg className="ptr-arrow" width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                  <line x1="12" y1="5" x2="12" y2="19" /><polyline points="19 12 12 19 5 12" />
                </svg>
                <span>Pull to refresh</span>
              </>
            )}
          </div>
        </div>
      )}

      <main className="app-content" style={{ paddingBottom: '24px' }}>
        {renderContent()}
      </main>

      {/* Navigation bar — hidden in Admin */}
      {!isAdminHost && (
        <BottomNav
          activeTab={activeTab}
          onChangeTab={(tab) => {
            setActiveTab(tab);
            localStorage.setItem('studydock_active_tab', tab);
            if (tab === 'files') {
              setSelectedRootFolder(null);
              localStorage.removeItem('studydock_selected_folder');
            }
          }}
        />
      )}

      {renderViewer()}
    </div>
  );
}
