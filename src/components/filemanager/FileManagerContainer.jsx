import React, { useEffect } from 'react';
import { useDriveFolder } from '../../hooks/useDriveFolder';
import FileManager from './FileManager';
import TopBar from '../layout/TopBar';

export default function FileManagerContainer({
  folder,
  onNavigateBack,
  onOpenFile,
  onRegisterRefresh,
  apiKey,
}) {
  // Hook is initialized fresh because this component is keyed by folder.id in App.jsx
  const {
    folders,
    files,
    loading,
    error,
    breadcrumbs,
    navigateToFolder,
    navigateBack,
    navigateToBreadcrumb,
    folderCounts,
    lastUpdated,
    refresh,
  } = useDriveFolder(folder.folderId, folder.name, apiKey);

  // Register the drive refresh function with the parent pull-to-refresh system
  useEffect(() => {
    if (onRegisterRefresh) {
      onRegisterRefresh(() => {
        refresh();
        return new Promise(resolve => setTimeout(resolve, 1200));
      });
    }
  }, [onRegisterRefresh, refresh]);

  // Wrapper back navigation
  const handleNavigateBack = () => {
    if (breadcrumbs.length > 1) {
      navigateBack();
    } else {
      // At the top level of this Drive folder, go back to root folder selection list
      onNavigateBack();
    }
  };

  return (
    <>
      <TopBar
        title={folder.name}
        lastUpdated={lastUpdated}
        loading={loading}
        onRefresh={refresh}
      />
      <FileManager
        folders={folders}
        files={files}
        loading={loading}
        error={error}
        breadcrumbs={breadcrumbs}
        folderCounts={folderCounts}
        onNavigateToFolder={navigateToFolder}
        onNavigateBreadcrumb={navigateToBreadcrumb}
        onNavigateBack={handleNavigateBack}
        onOpenFile={onOpenFile}
        onRefresh={refresh}
      />
    </>
  );
}
