import React, { useState } from 'react';
import RootFoldersList from '../filemanager/RootFoldersList';
import FileManagerContainer from '../filemanager/FileManagerContainer';
import TelegramManager from '../telegram/TelegramManager';

export default function MaterialsPage({
  foldersList,
  selectedRootFolder,
  onSelectRootFolder,
  localApiKey,
  handleOpenFile,
  registerRefreshCallback,
  tgConfig,
  tgRefreshKey,
}) {
  const [activeSubTab, setActiveSubTab] = useState(() => {
    return localStorage.getItem('bahattor_materials_tab') || 'drive';
  });

  const handleSubTabChange = (tab) => {
    setActiveSubTab(tab);
    localStorage.setItem('bahattor_materials_tab', tab);
  };

  return (
    <div className="materials-container">
      {/* Materials Tab Switcher Pill */}
      <div className="materials-tab-header">
        <div className="materials-pills">
          <button
            className={`materials-pill ${activeSubTab === 'drive' ? 'active' : ''}`}
            onClick={() => handleSubTabChange('drive')}
          >
            Google Drive
          </button>
          <button
            className={`materials-pill ${activeSubTab === 'telegram' ? 'active' : ''}`}
            onClick={() => handleSubTabChange('telegram')}
          >
            Telegram Channel
          </button>
        </div>
      </div>

      <div className="materials-body">
        {activeSubTab === 'drive' ? (
          !selectedRootFolder ? (
            <RootFoldersList
              foldersList={foldersList}
              onSelectFolder={onSelectRootFolder}
              onOpenAdmin={null}
            />
          ) : (
            <FileManagerContainer
              key={selectedRootFolder.id}
              folder={selectedRootFolder}
              apiKey={localApiKey}
              onNavigateBack={() => onSelectRootFolder(null)}
              onOpenFile={handleOpenFile}
              onRegisterRefresh={(cb) => registerRefreshCallback('files', cb)}
            />
          )
        ) : (
          !tgConfig.chatId ? (
            <div className="materials-empty-state">
              <svg width="40" height="40" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
                <line x1="22" y1="2" x2="11" y2="13" />
                <polygon points="22 2 15 22 11 13 2 9 22 2" />
              </svg>
              <h3>Telegram Sync is not configured</h3>
              <p>Please check back later or contact your administrator to set up the Telegram sync configuration.</p>
            </div>
          ) : (
            <TelegramManager
              key={`${tgConfig.token}::${tgConfig.chatId}::${tgRefreshKey}`}
              onOpenFile={handleOpenFile}
              onRegisterRefresh={(cb) => registerRefreshCallback('telegram', cb)}
            />
          )
        )}
      </div>
    </div>
  );
}
