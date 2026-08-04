import React, { useCallback, useEffect, useRef, useState } from 'react';
import lottie from 'lottie-web';
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
import Login from './components/auth/Login';
import Register from './components/auth/Register';
import Dashboard from './components/dashboard/Dashboard';
import MaterialsPage from './components/materials/MaterialsPage';
import ExplorePage from './components/explore/ExplorePage';
import { DEFAULT_FOLDERS, getApiKey, setRuntimeApiKey, setRuntimeClientId, setRuntimeClientSecret } from './config/drive';
import { getTelegramConfig, saveTelegramConfig, clearTelegramConfig } from './services/telegramService';
import { fetchExams, saveExam as saveExamToStorage, deleteExam as deleteExamFromStorage, subscribeToExams } from './services/examService';
import { fetchTopperIds } from './services/suggestionService';
import { fetchFolders, saveAllFolders, subscribeToFolders } from './services/foldersService';
import { saveGoogleApiKey, saveTelegramSettings, clearTelegramSettings, subscribeToSettings, fetchAppSettings, saveSuggestionUploadFolder, saveGoogleServiceAccount, saveGoogleRefreshToken, saveGoogleClientId, saveGoogleClientSecret } from './services/settingsService';
import { setAccessToken, setServiceAccountConfig, setAdminRefreshToken, exchangeAuthCode } from './services/driveService';
import { loadAppData } from './services/dataService';
import { isSupabaseConfigured, supabase } from './lib/supabase';
import loadingAnimation from './assets/loading.json';
import { initExamNotifications } from './services/notificationService';
import { fetchBroadcastNotifications } from './services/broadcastService';

const STORAGE_API_KEY = 'studydock_api_key';
const STORAGE_FOLDERS_KEY = 'studydock_configured_folders';
const EXAMS_BROADCAST_CHANNEL = 'studydock_exams_sync';

function DatabaseLoader() {
  const containerRef = useRef(null);

  useEffect(() => {
    if (!containerRef.current) return;
    const anim = lottie.loadAnimation({
      container: containerRef.current,
      renderer: 'svg',
      loop: true,
      autoplay: true,
      animationData: loadingAnimation,
    });
    return () => anim.destroy();
  }, []);

  return (
    <div className="fullscreen-loader">
      <div className="loader-animation-wrap">
        <div ref={containerRef} style={{ width: '140px', height: '140px' }} />
      </div>
      <p className="loader-text">Loading</p>
    </div>
  );
}

export default function App() {
  const [bootState, setBootState] = useState({ loading: true, error: null, data: null });
  const [localApiKey, setLocalApiKey] = useState('');

  useEffect(() => {
    let cancelled = false;

    // Check for Google OAuth callback code in URL
    const searchParams = new URLSearchParams(window.location.search);
    const code = searchParams.get('code');
    if (code) {
      (async () => {
        try {
          const tokens = await exchangeAuthCode(code);
          if (tokens.refresh_token) {
            await saveGoogleRefreshToken(tokens.refresh_token);
            setAdminRefreshToken(tokens.refresh_token);
            alert('Google Drive admin authorization successful!');
          } else {
            alert('Warning: No refresh token returned. If re-authorizing, please remove the app access from your Google Account settings first.');
          }
        } catch (err) {
          console.error('Failed to exchange auth code:', err);
          alert('Failed to authorize Google Drive: ' + err.message);
        } finally {
          const cleanUrl = window.location.origin + window.location.pathname;
          window.location.href = cleanUrl;
        }
      })();
      return;
    }

    loadAppData()
      .then((data) => {
        if (cancelled) return;
        setLocalApiKey(data.settings.googleApiKey || '');
        if (data.settings.googleServiceAccount) {
          setServiceAccountConfig(data.settings.googleServiceAccount);
        }
        if (data.settings.googleRefreshToken) {
          setAdminRefreshToken(data.settings.googleRefreshToken);
        }
        if (data.settings.googleClientId) {
          setRuntimeClientId(data.settings.googleClientId);
        }
        if (data.settings.googleClientSecret) {
          setRuntimeClientSecret(data.settings.googleClientSecret);
        }
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
    return <DatabaseLoader />;
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

  // Active Navigation Tab: 'dashboard' | 'calendar' | 'materials' | 'explore' | 'announcement'
  const [activeTab, setActiveTab] = useState(() => {
    // Also try reading from the current URL state if available
    const historyTab = window.history.state?.tab;
    return historyTab || localStorage.getItem('studydock_active_tab') || 'dashboard';
  });

  // Sync tab changes with browser history so back/forward gesture works
  const navigateToTab = useCallback((tab) => {
    setActiveTab(tab);
    localStorage.setItem('studydock_active_tab', tab);
    window.history.pushState({ tab }, '', window.location.pathname + window.location.search);
  }, []);

  // Listen for browser back/forward button
  useEffect(() => {
    const onPopState = (e) => {
      const tab = e.state?.tab;
      if (tab) {
        setActiveTab(tab);
        localStorage.setItem('studydock_active_tab', tab);
      } else {
        // No history state → go to dashboard
        setActiveTab('dashboard');
        localStorage.setItem('studydock_active_tab', 'dashboard');
      }
    };
    window.addEventListener('popstate', onPopState);
    // Seed the initial history entry so the first back press doesn't close the app
    if (!window.history.state?.tab) {
      const initialTab = localStorage.getItem('studydock_active_tab') || 'dashboard';
      window.history.replaceState({ tab: initialTab }, '', window.location.pathname + window.location.search);
    }
    return () => window.removeEventListener('popstate', onPopState);
  }, []);

  const [currentUser, setCurrentUser] = useState(() => {
    try {
      const stored = localStorage.getItem('bahattor_logged_in_student');
      return stored ? JSON.parse(stored) : null;
    } catch {
      return null;
    }
  });

  const [authView, setAuthView] = useState('login'); // 'login' | 'register'

  // Fetch Supabase session if configured
  useEffect(() => {
    if (!isSupabaseConfigured()) return;

    async function checkAuth() {
      try {
        const { data: { user } } = await supabase.auth.getUser();
        if (user) {
          // Fetch student details
          const { data: student, error } = await supabase
            .from('students')
            .select('*')
            .eq('id', user.id)
            .maybeSingle();

          if (error) throw error;

          if (student) {
            setCurrentUser(student);
            localStorage.setItem('bahattor_logged_in_student', JSON.stringify(student));
          } else {
            setCurrentUser(null);
            localStorage.removeItem('bahattor_logged_in_student');
          }
        } else {
          setCurrentUser(null);
          localStorage.removeItem('bahattor_logged_in_student');
        }
      } catch (err) {
        console.error('Session check failed:', err);
      }
    }
    checkAuth();
  }, []);

  const handleLoginSuccess = (student) => {
    setCurrentUser(student);
    navigateToTab('dashboard');
    localStorage.setItem('bahattor_logged_in_student', JSON.stringify(student));
  };

  const handleRegisterSuccess = (student) => {
    setCurrentUser(student);
    navigateToTab('dashboard');
    localStorage.setItem('bahattor_logged_in_student', JSON.stringify(student));
  };

  const handleLogout = async () => {
    if (isSupabaseConfigured()) {
      await supabase.auth.signOut();
    }
    localStorage.removeItem('bahattor_logged_in_student');
    setCurrentUser(null);
    setAuthView('login');
  };

  const handleProfileUpdate = (updatedStudent) => {
    setCurrentUser(updatedStudent);
    localStorage.setItem('bahattor_logged_in_student', JSON.stringify(updatedStudent));
  };

  const [tgConfig, setTgConfig] = useState(() => {
    if (initialData?.settings?.telegram?.chatId || initialData?.settings?.telegram?.token) {
      return initialData.settings.telegram;
    }
    return getTelegramConfig();
  });

  const [examsList, setExamsList] = useState(() => initialData?.exams || []);
  const [topperIds, setTopperIds] = useState([]);
  const [suggestionUploadFolder, setSuggestionUploadFolder] = useState(() => {
    return initialData?.settings?.suggestionUploadFolder || localStorage.getItem('bahattor_suggestion_upload_folder') || '';
  });
  const [googleServiceAccount, setGoogleServiceAccount] = useState(() => {
    return initialData?.settings?.googleServiceAccount || null;
  });
  const [googleRefreshToken, setGoogleRefreshToken] = useState(() => {
    return initialData?.settings?.googleRefreshToken || '';
  });
  const [googleClientId, setGoogleClientId] = useState(() => {
    return initialData?.settings?.googleClientId || localStorage.getItem('bahattor_google_client_id') || '';
  });
  const [googleClientSecret, setGoogleClientSecret] = useState(() => {
    return initialData?.settings?.googleClientSecret || localStorage.getItem('bahattor_google_client_secret') || '';
  });

  // Load topper IDs on boot
  useEffect(() => {
    fetchTopperIds().then(setTopperIds).catch(console.error);
  }, []);

  // Initialize push notifications for upcoming exams/events
  useEffect(() => {
    initExamNotifications(examsList);
  }, [examsList]);

  const lastProcessedNotifRef = useRef(localStorage.getItem('bahattor_last_processed_notif_id') || '');

  const processIncomingNotifications = useCallback((notifications, currentStudentId) => {
    if (!notifications || notifications.length === 0) return;
    
    const sorted = [...notifications].sort((a, b) => new Date(a.created_at) - new Date(b.created_at));
    const lastId = lastProcessedNotifRef.current;
    let newNotifs = [];

    if (lastId) {
      const idx = sorted.findIndex(n => n.id === lastId);
      if (idx !== -1) {
        newNotifs = sorted.slice(idx + 1);
      } else {
        const twoMinsAgo = Date.now() - 2 * 60 * 1000;
        newNotifs = sorted.filter(n => new Date(n.created_at).getTime() > twoMinsAgo);
      }
    } else {
      const twoMinsAgo = Date.now() - 2 * 60 * 1000;
      newNotifs = sorted.filter(n => new Date(n.created_at).getTime() > twoMinsAgo);
    }

    if (newNotifs.length > 0) {
      newNotifs.forEach(notif => {
        const isTargeted = notif.target === 'all' ||
                           (Array.isArray(notif.target) && notif.target.includes(currentStudentId)) ||
                           (notif.target === currentStudentId);
        if (isTargeted) {
          if (Notification.permission === 'granted') {
            const options = {
              body: notif.body,
              tag: notif.id,
              icon: '/pwa-192x192.png',
              badge: '/favicon.png',
              requireInteraction: true,
              data: { url: '/' }
            };
            if ('serviceWorker' in navigator) {
              navigator.serviceWorker.ready.then(reg => {
                reg.showNotification(notif.title, options);
              }).catch(() => new Notification(notif.title, options));
            } else {
              new Notification(notif.title, options);
            }
          }
        }
      });

      const latestId = sorted[sorted.length - 1].id;
      lastProcessedNotifRef.current = latestId;
      localStorage.setItem('bahattor_last_processed_notif_id', latestId);
    } else if (sorted.length > 0) {
      const latestId = sorted[sorted.length - 1].id;
      lastProcessedNotifRef.current = latestId;
      localStorage.setItem('bahattor_last_processed_notif_id', latestId);
    }
  }, []);

  // Initial check for broadcast notifications on boot
  useEffect(() => {
    fetchBroadcastNotifications()
      .then((broadcasts) => {
        const rawStudent = localStorage.getItem('bahattor_logged_in_student');
        let currentStudentId = '';
        if (rawStudent) {
          try {
            currentStudentId = JSON.parse(rawStudent).id;
          } catch (_) {}
        }
        processIncomingNotifications(broadcasts, currentStudentId);
      })
      .catch(console.error);
  }, [processIncomingNotifications]);

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
        if (settings.suggestionUploadFolder !== undefined) setSuggestionUploadFolder(settings.suggestionUploadFolder);
        if (settings.googleServiceAccount !== undefined) {
          setGoogleServiceAccount(settings.googleServiceAccount);
          setServiceAccountConfig(settings.googleServiceAccount);
        }
        if (settings.googleRefreshToken !== undefined) {
          setGoogleRefreshToken(settings.googleRefreshToken);
          setAdminRefreshToken(settings.googleRefreshToken);
        }
        if (settings.googleClientId !== undefined) {
          setGoogleClientId(settings.googleClientId);
          setRuntimeClientId(settings.googleClientId);
        }
        if (settings.googleClientSecret !== undefined) {
          setGoogleClientSecret(settings.googleClientSecret);
          setRuntimeClientSecret(settings.googleClientSecret);
        }

        const broadcasts = await fetchBroadcastNotifications();
        const rawStudent = localStorage.getItem('bahattor_logged_in_student');
        let currentStudentId = '';
        if (rawStudent) {
          try {
            currentStudentId = JSON.parse(rawStudent).id;
          } catch (_) {}
        }
        processIncomingNotifications(broadcasts, currentStudentId);
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

  const handleSaveSuggestionUploadFolder = async (folderLinkOrId) => {
    await saveSuggestionUploadFolder(folderLinkOrId);
    setSuggestionUploadFolder(folderLinkOrId);
  };

  const handleSaveGoogleServiceAccount = async (config) => {
    await saveGoogleServiceAccount(config);
    setGoogleServiceAccount(config);
    setServiceAccountConfig(config);
  };

  const handleSaveGoogleRefreshToken = async (token) => {
    await saveGoogleRefreshToken(token);
    setGoogleRefreshToken(token);
    setAdminRefreshToken(token);
  };

  const handleSaveGoogleClientId = async (id) => {
    await saveGoogleClientId(id);
    setGoogleClientId(id);
    setRuntimeClientId(id);
  };

  const handleSaveGoogleClientSecret = async (secret) => {
    await saveGoogleClientSecret(secret);
    setGoogleClientSecret(secret);
    setRuntimeClientSecret(secret);
  };

  const [viewerFile, setViewerFile] = useState(null);

  const handleOpenFile = useCallback((file) => {
    setViewerFile(file);
    // Push a history entry so browser/device back closes the viewer
    window.history.pushState({ viewerOpen: true }, '');
  }, []);

  const handleCloseViewer = useCallback(() => {
    setViewerFile(null);
  }, []);

  // Listen for browser/device back while viewer is open
  useEffect(() => {
    if (!viewerFile) return;
    const onPopState = (e) => {
      if (!e.state?.viewerOpen) {
        setViewerFile(null);
      }
    };
    window.addEventListener('popstate', onPopState);
    return () => window.removeEventListener('popstate', onPopState);
  }, [viewerFile]);

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
          suggestionUploadFolder={suggestionUploadFolder}
          onSaveSuggestionUploadFolder={handleSaveSuggestionUploadFolder}
          googleServiceAccount={googleServiceAccount}
          onSaveGoogleServiceAccount={handleSaveGoogleServiceAccount}
          googleRefreshToken={googleRefreshToken}
          onSaveGoogleRefreshToken={handleSaveGoogleRefreshToken}
          googleClientId={googleClientId}
          onSaveGoogleClientId={handleSaveGoogleClientId}
          googleClientSecret={googleClientSecret}
          onSaveGoogleClientSecret={handleSaveGoogleClientSecret}
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

    if (!currentUser) {
      if (authView === 'login') {
        return (
          <Login
            onLoginSuccess={handleLoginSuccess}
            onGoToRegister={() => setAuthView('register')}
          />
        );
      } else {
        return (
          <Register
            onRegisterSuccess={handleRegisterSuccess}
            onGoToLogin={() => setAuthView('login')}
          />
        );
      }
    }

    if (activeTab === 'dashboard') {
      return (
        <Dashboard
          student={currentUser}
          exams={examsList}
          onProfileUpdate={handleProfileUpdate}
          onLogout={handleLogout}
          onChangeTab={navigateToTab}
        />
      );
    }

    if (activeTab === 'calendar') {
      return (
        <ExamCalendar
          exams={examsList}
          onAddExam={null} // No inline add button on calendar for general users
          currentUser={currentUser}
          topperIds={topperIds}
          foldersList={foldersList}
          onOpenFile={handleOpenFile}
          suggestionUploadFolder={suggestionUploadFolder}
        />
      );
    }

    if (activeTab === 'materials') {
      return (
        <MaterialsPage
          foldersList={foldersList}
          selectedRootFolder={selectedRootFolder}
          onSelectRootFolder={handleSelectRootFolder}
          localApiKey={localApiKey}
          handleOpenFile={handleOpenFile}
          registerRefreshCallback={registerRefreshCallback}
          tgConfig={tgConfig}
          tgRefreshKey={tgRefreshKey}
        />
      );
    }

    if (activeTab === 'explore') {
      return <ExplorePage currentUser={currentUser} />;
    }

    if (activeTab === 'announcement') {
      return <AnnouncementPage />;
    }
  };

  const isLightTab = activeTab === 'dashboard' || activeTab === 'materials' || activeTab === 'explore' || activeTab === 'announcement';

  return (
    <div
      className={`app-layout ${isLightTab ? 'light-theme-active' : ''}`}
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

      {/* Navigation bar — hidden in Admin and when user is not logged in */}
      {!isAdminHost && currentUser && (
              <BottomNav
          activeTab={activeTab}
          onChangeTab={(tab) => {
            navigateToTab(tab);
            if (tab === 'materials') {
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
