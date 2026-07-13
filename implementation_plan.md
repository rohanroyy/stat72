# StudyDock — File Manager View: Implementation Plan

## Overview

Build a **Google Drive-powered File Manager** web app (Phase 1 of StudyDock) that:
- Mirrors the exact contents of a Google Drive folder (`1WSEHg_3AqArmsSej66SucFDwiUgbR-Yk`)
- Auto-refreshes every 30s (polling) to reflect additions/removals
- Has built-in PDF, image, and video viewers
- Follows the StudyDock design system faithfully (dark near-black base, 5-color brand language, Space Grotesk + JetBrains Mono typography)

---

## Architecture Overview

```
stat72webapp/
├── index.html              ← Root HTML, fonts, PDF.js CDN
├── vite.config.js
├── package.json
├── src/
│   ├── main.jsx
│   ├── App.jsx             ← Root, viewer modal gate
│   ├── index.css           ← Full design-system CSS tokens & globals
│   │
│   ├── config/
│   │   └── drive.js        ← FOLDER_ID, API_KEY, POLL_INTERVAL
│   │
│   ├── services/
│   │   └── driveService.js ← Google Drive API v3 calls
│   │       • listFolder(folderId)
│   │       • getFileMetadata(fileId)
│   │       • getDownloadUrl(fileId)
│   │
│   ├── hooks/
│   │   └── useDriveFolder.js  ← Polling hook (setInterval), state, error
│   │
│   ├── components/
│   │   ├── layout/
│   │   │   ├── TopBar.jsx       ← "Files" title + refresh indicator
│   │   │   └── BottomNav.jsx    ← Nav tabs (Files active + placeholders)
│   │   │
│   │   ├── filemanager/
│   │   │   ├── FileManager.jsx  ← Root, composes all sub-components
│   │   │   ├── Breadcrumb.jsx   ← Folder navigation trail
│   │   │   ├── FilterPills.jsx  ← All / PDFs / Images / Videos / Folders
│   │   │   ├── FolderRow.jsx    ← Folder item row (neutral, count badge)
│   │   │   ├── FileRow.jsx      ← File item row (2px accent bar, meta)
│   │   │   ├── SectionLabel.jsx ← "Folders" / "Files" divider
│   │   │   └── EmptyState.jsx   ← Empty + error states
│   │   │
│   │   └── viewers/
│   │       ├── ViewerModal.jsx  ← Full-screen overlay shell (close, toolbar)
│   │       ├── PDFViewer.jsx    ← PDF.js canvas renderer, page nav, zoom
│   │       ├── ImageViewer.jsx  ← Pinch/scroll zoom, next/prev if gallery
│   │       └── VideoViewer.jsx  ← HTML5 <video>, custom controls overlay
```

---

## Technology Stack

| Layer | Choice | Reason |
|---|---|---|
| Framework | **Vite + React 18** | Fast HMR, small bundle, ecosystem |
| Styling | **Vanilla CSS** (CSS custom properties) | Design system mandates; no Tailwind |
| Drive data | **Google Drive API v3** (REST, API key) | Official, real-time file listing |
| PDF rendering | **PDF.js** (Mozilla, via CDN) | Industry standard, no install |
| Auto-refresh | `setInterval` polling (30 s) | Simple; webhooks need a server |
| State | React `useState` / `useReducer` | No external lib needed |
| Fonts | Google Fonts (Space Grotesk, JetBrains Mono) + CDN for General Sans | Design system spec |

---

## Google Drive API Integration

### How it works
1. The target folder **must be shared as "Anyone with the link can view"**.
2. A **Google Cloud API Key** (Drive API v3 enabled, restricted to your domain) is stored in `src/config/drive.js`.
3. The service calls:
   ```
   GET https://www.googleapis.com/drive/v3/files
     ?q='FOLDER_ID' in parents and trashed = false
     &fields=files(id,name,mimeType,size,createdTime,modifiedTime,thumbnailLink,parents)
     &key=API_KEY
     &pageSize=1000
   ```
4. Recursive subfolder navigation: clicking a folder calls `listFolder(subfolderId)` and pushes to the breadcrumb stack.
5. Polling: `useDriveFolder` runs `listFolder` every 30 seconds, diffing to trigger re-renders only on change.

### Folder ID
```
1WSEHg_3AqArmsSej66SucFDwiUgbR-Yk
```

> [!IMPORTANT]
> **API Key Required**: You need a Google Cloud API key with Drive API v3 enabled. Steps:
> 1. Go to [console.cloud.google.com](https://console.cloud.google.com)
> 2. Create a project → Enable "Google Drive API"
> 3. Create Credentials → API Key
> 4. Restrict key to HTTP referrers (your localhost + deployed domain)
> 5. Paste the key into `src/config/drive.js`

> [!IMPORTANT]
> **Drive Folder Sharing**: The folder at the link must be set to **"Anyone with the link → Viewer"** in Drive's share settings for the API to return file listings without OAuth.

---

## File Viewers

### PDF Viewer
- Uses **PDF.js** (`pdfjs-dist`) loaded via CDN in `index.html`
- Fetches PDF via Google Drive's direct download URL:  
  `https://drive.google.com/uc?export=download&id=FILE_ID`
- Renders to a `<canvas>` element, page-by-page
- Controls: Previous / Next page, zoom in/out, page counter (`Pg 4 / 28` in JetBrains Mono)
- Toolbar auto-hides on scroll (per design system §4.4)

### Image Viewer
- Loads via:  
  `https://drive.google.com/uc?export=view&id=FILE_ID`
- Features: Pinch/wheel zoom, pan, keyboard ← / → for gallery nav (if in a folder with multiple images)
- Dot pagination indicator at bottom
- Gradient overlay for chrome (per design system §4.5)

### Video Viewer
- Embeds via Google Drive's streaming embed:  
  `https://drive.google.com/file/d/FILE_ID/preview`  
  inside a sandboxed `<iframe>` for Drive-hosted video
- Custom chrome overlay: blaze_orange/amber_gold tinted scrubber (design system §4.5)
- Falls back to HTML5 `<video>` with direct download URL for downloadable videos

---

## Data Flow & Auto-Refresh

```
useDriveFolder(folderId)
  │
  ├─ Initial fetch on mount
  ├─ setInterval(fetch, 30_000)
  ├─ On tab focus (visibilitychange) → immediate refetch
  │
  ▼
{ files[], folders[], loading, error, lastUpdated }
  │
  ▼
FileManager.jsx
  ├─ FilterPills → active filter → filtered view
  ├─ Breadcrumb → folder navigation stack
  ├─ FolderRow[] → click → navigate into subfolder
  └─ FileRow[] → click → open ViewerModal
```

---

## Design System Implementation

### CSS Custom Properties (index.css)
```css
--bg-base: #0A0A0C;
--bg-surface: #131316;
--bg-surface-2: #1C1C20;
--bg-elevated: #232328;
--border-hairline: #2A2A30;
--text-primary: #F5F4F7;
--text-secondary: #9C9CA6;
--text-tertiary: #64646E;

/* Brand colors */
--navy-700: #7729FF;
--raspberry-700: #FF2CA4;
--fuchsia-600: #FF3377;
--orange-600: #FF7733;
--gold-600: #FFC933;

/* File type accent colors */
--accent-pdf: var(--raspberry-700);
--accent-image: var(--gold-600);
--accent-video: var(--orange-600);
--accent-note: var(--navy-700);
--accent-folder: var(--text-secondary);
```

### Key Visual Rules Applied
- **2px left accent bar** on every FileRow (color = file type)
- **Filter pills**: active pill gets `background: rgba(accent, 0.15)` + colored border
- **Elevation**: `box-shadow: 0 0 24px rgba(accent, 0.18)` — never plain drop shadow
- **Refresh pulse**: subtle glow animation on the last-updated timestamp while fetching
- **Responsive**: list view ≥ 768px → 2-col grid; ≥ 1024px → 3-col grid for file cards

---

## Proposed File Changes

### [NEW] `package.json`
Vite + React 18, no heavy dependencies.

### [NEW] `vite.config.js`
Standard Vite config with React plugin.

### [NEW] `index.html`
- Google Fonts (Space Grotesk, JetBrains Mono)
- PDF.js CDN script
- Root div

### [NEW] `src/config/drive.js`
```js
export const FOLDER_ID = '1WSEHg_3AqArmsSej66SucFDwiUgbR-Yk';
export const API_KEY = 'YOUR_GOOGLE_API_KEY'; // ← replace this
export const POLL_INTERVAL = 30_000; // 30 seconds
```

### [NEW] `src/services/driveService.js`
Drive API v3 wrapper — `listFolder()`, `getFileType()`, `formatSize()`, `getViewUrl()`.

### [NEW] `src/hooks/useDriveFolder.js`
Polling hook with folder stack navigation and filter logic.

### [NEW] `src/index.css`
Complete design-system CSS: tokens, typography, layout, components, animations.

### [NEW] All components
`App.jsx`, `FileManager.jsx`, `FileRow.jsx`, `FolderRow.jsx`, `FilterPills.jsx`, `Breadcrumb.jsx`, `TopBar.jsx`, `BottomNav.jsx`, `EmptyState.jsx`, `ViewerModal.jsx`, `PDFViewer.jsx`, `ImageViewer.jsx`, `VideoViewer.jsx`

---

## Verification Plan

### Build Check
```bash
npm install
npm run dev
```

### Manual Verification
1. App loads at `localhost:5173` with correct dark near-black background
2. File list from Drive folder appears (requires API key + public folder)
3. Filter pills correctly show only PDFs / Images / Videos
4. Clicking a folder navigates into it and breadcrumb updates
5. Clicking a PDF → PDF viewer opens, pages work
6. Clicking an image → Image viewer opens with zoom
7. Clicking a video → Video player opens
8. After 30s, folder contents refresh automatically
9. Removing/adding a file in Drive shows within 30s in the app
10. Responsive layout works at 390px, 768px, 1024px

---

## Open Questions

> [!IMPORTANT]
> **Do you already have a Google Cloud API key for Drive API v3?**
> If not, I'll include clear setup instructions in the README. The app will show a "Configure API key" screen until it's set.

> [!NOTE]
> **Is the Drive folder already shared publicly?** ("Anyone with the link → Viewer")
> If not, the API calls will return 0 files. The folder link you provided looks like it may already be public — just confirming.

> [!NOTE]
> **Framework preference**: I'm planning Vite + React for this. The design system mentions mobile-first, so a SPA is the right choice. If you'd prefer plain HTML/JS, I can do that too — but React will make the viewer modals and state management much cleaner.
