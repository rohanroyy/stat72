# StudyDock — File Manager

StudyDock is a student's control room app built with Vite and React 18, styling according to the design-system guidelines. This module provides a file manager view connected to Google Drive folder:
`https://drive.google.com/drive/folders/1WSEHg_3AqArmsSej66SucFDwiUgbR-Yk`

## Features

- **Google Drive API v3 Integration**: Automatically reads files and folders recursively.
- **Auto-Refresh Polling**: Automatically refreshes the file directory every 30 seconds, or immediately when the tab is refocused.
- **Built-in Viewers**:
  - **PDF Viewer**: Built-in Mozilla PDF.js canvas renderer with zoom and keyboard navigation.
  - **Image Viewer**: Supports click-and-drag pan, mouse wheel/button zoom, and double-click reset.
  - **Video Viewer**: Integrates Google Drive interactive video preview player inside a sandboxed iframe.
- **Design System Adherence**: Beautiful near-black aesthetic, custom CSS custom properties, and time/file-type colored elements.

## Getting Started

### 1. Set Up Google API Key

To query files from Google Drive publicly, you need an API key from Google Cloud Console.

1. Go to the [Google Cloud Console](https://console.cloud.google.com/).
2. Create or select a project.
3. Go to **APIs & Services > Library**, search for **Google Drive API** and click **Enable**.
4. Go to **APIs & Services > Credentials**.
5. Click **Create Credentials** and select **API Key**.
6. (Recommended) Restrict the key to only be usable from HTTP referrers like `http://localhost:5173/*` and limit its API usage to the Google Drive API.

### 2. Configure the Key

You have two ways to add the key:

- **Option A (Persistent)**: Create a `.env` file in the root directory:
  ```env
  VITE_GOOGLE_API_KEY=your_copied_api_key_here
  ```
- **Option B (In-App)**: Run the application. Since no API key is detected in the environment, StudyDock will show a beautiful setup screen where you can input and save your key directly in your browser's local storage.

### 3. Run the App

Install dependencies and start the local development server:

```bash
npm install
npm run dev
```

The application will open automatically at [http://localhost:5173](http://localhost:5173).
