import { useState, useEffect, useCallback, useRef } from 'react';
import { listFolder, countFolderItems } from '../services/driveService';
import { POLL_INTERVAL } from '../config/drive';
export function useDriveFolder(initialFolderId, initialFolderName = 'Root', apiKey) {
  const [folders, setFolders] = useState([]);
  const [files, setFiles] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [lastUpdated, setLastUpdated] = useState(null);
  const [activeFilter, setActiveFilter] = useState('all');
  const [folderCounts, setFolderCounts] = useState({});

  // Navigation state
  const [breadcrumbs, setBreadcrumbs] = useState(() => [
    { id: initialFolderId, name: initialFolderName },
  ]);

  const currentFolderId = breadcrumbs[breadcrumbs.length - 1]?.id || initialFolderId;
  const intervalRef = useRef(null);
  const isMountedRef = useRef(true);

  // Fetch folder contents
  const fetchFolder = useCallback(async (folderId, showLoading = false) => {
    if (!folderId) {
      setLoading(false);
      return;
    }
    try {
      if (showLoading) setLoading(true);
      setError(null);

      const result = await listFolder(folderId, apiKey);

      if (!isMountedRef.current) return;

      setFolders(result.folders);
      setFiles(result.files);
      setLastUpdated(new Date());
      setLoading(false);

      // Fetch folder counts in the background
      const counts = {};
      await Promise.all(
        result.folders.map(async (folder) => {
          counts[folder.id] = await countFolderItems(folder.id, apiKey);
        })
      );

      if (isMountedRef.current) {
        setFolderCounts((prev) => ({ ...prev, ...counts }));
      }
    } catch (err) {
      if (!isMountedRef.current) return;
      setError(err.message);
      setLoading(false);
    }
  }, [apiKey]);

  // Initial fetch + polling
  useEffect(() => {
    isMountedRef.current = true;
    fetchFolder(currentFolderId, true);

    // Set up polling
    intervalRef.current = setInterval(() => {
      fetchFolder(currentFolderId, false);
    }, POLL_INTERVAL);

    // Refetch on tab focus
    const handleVisibility = () => {
      if (document.visibilityState === 'visible') {
        fetchFolder(currentFolderId, false);
      }
    };
    document.addEventListener('visibilitychange', handleVisibility);

    return () => {
      isMountedRef.current = false;
      if (intervalRef.current) clearInterval(intervalRef.current);
      document.removeEventListener('visibilitychange', handleVisibility);
    };
  }, [currentFolderId, fetchFolder]);

  // Navigate into a subfolder
  const navigateToFolder = useCallback((folderId, folderName) => {
    setBreadcrumbs((prev) => [...prev, { id: folderId, name: folderName }]);
    setActiveFilter('all');
  }, []);

  // Navigate back one level
  const navigateBack = useCallback(() => {
    setBreadcrumbs((prev) => {
      if (prev.length <= 1) return prev;
      return prev.slice(0, -1);
    });
    setActiveFilter('all');
  }, []);

  // Navigate to a specific breadcrumb
  const navigateToBreadcrumb = useCallback((index) => {
    setBreadcrumbs((prev) => {
      if (index < 0 || index >= prev.length) return prev;
      return prev.slice(0, index + 1);
    });
    setActiveFilter('all');
  }, []);

  // Force refresh
  const refresh = useCallback(() => {
    fetchFolder(currentFolderId, true);
  }, [currentFolderId, fetchFolder]);

  // Filter files
  const filteredFiles = activeFilter === 'all'
    ? files
    : files.filter((f) => f.fileType === activeFilter);

  return {
    folders: activeFilter === 'all' || activeFilter === 'folder' ? folders : [],
    files: filteredFiles,
    allFiles: files,
    allFolders: folders,
    loading,
    error,
    currentFolderId,
    breadcrumbs,
    navigateToFolder,
    navigateBack,
    navigateToBreadcrumb,
    activeFilter,
    setActiveFilter,
    lastUpdated,
    folderCounts,
    refresh,
  };
}
