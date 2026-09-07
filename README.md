# YouTube Playlist Player Widget

<p align="center">
  <img src="assets/hero.svg" alt="YouTube Playlist Player Widget" width="900">
</p>

<p align="center">A small browser extension that controls a normal signed-in YouTube tab on Windows and Linux.</p>

This is the simplest version of the widget: YouTube remains the playback surface, while the extension opens a separate compact controller window. It uses the YouTube session already available in Edge or Chromium, so there is no Google Cloud Console project, API key, OAuth client, backend, or cookie export step.

## Features

- Play/pause, previous, next, seek and volume controls.
- Shuffle and repeat Off/All/One when YouTube exposes those controls.
- One-line Compact mode with the current title and core playback actions.
- Settings page for one playlist URL to preload when **Open YouTube** needs to create a source tab.
- Browse, switch accounts, create or edit playlists in YouTube's own interface.
- Separate controller popup with visible focus states and accessible labels.

## Install on Windows 11

1. Download or clone this repository.
2. Open `edge://extensions` in Edge.
3. Turn on **Developer mode**, choose **Load unpacked**, and select this repository folder.
4. Pin **YouTube Compact Controller** to the toolbar.
5. Open YouTube in Edge, sign in normally, and open a video or playlist. Reload the tab once after installing the extension.
6. Click the extension icon. The controller should attach to the active YouTube tab.

If it shows **Waiting for a playable video**, make the YouTube tab active and click **Use active tab**. **Open YouTube** creates a new YouTube tab; if a preload URL is saved, it opens that playlist.

## Install on Omarchy/Linux

The extension works in a Chromium-family browser. Use the browser's extensions page (`chrome://extensions` or its equivalent), enable developer mode, choose **Load unpacked**, and select this repository folder. Then follow the same YouTube sign-in and reload steps above.

## Configure a playlist

Open the controller's **Settings** link and save a URL such as:

```text
https://www.youtube.com/playlist?list=YOUR_PLAYLIST_ID
```

The setting only controls which URL **Open YouTube** loads when no source tab is selected. Playlist browsing and edits still happen in YouTube, using its normal account switcher and controls.

## Use the controller

- **Compact** collapses the popup to a one-line strip with the title, previous, play/pause and next.
- **Expand** restores seek, volume, shuffle, repeat and playlist actions.
- **Open YouTube** focuses the selected source tab, or creates one when none is selected.
- Closing the controller leaves YouTube playing. Closing the YouTube source tab ends playback.

## Important limitation

This extension is intentionally tied to a live YouTube tab. The controller does not copy cookies, download media, extract an audio stream, block ads, or create an independent player. Minimized/background playback therefore follows the normal browser and YouTube behavior for the signed-in account. A portable always-on-top window is not guaranteed by browser extension APIs.

## Development check

Run the dependency-free contract and source-selection check with Node.js:

```bash
node test.mjs
```

The check covers the Manifest V3 contract, required controller controls, command names, playlist settings, and the regression path for selecting or creating a YouTube source tab. Live YouTube playback and browser-specific background behavior still need a real run in Edge and Chromium.

## Project layout

- `manifest.json` — Manifest V3 permissions, action, options page and YouTube content script.
- `background.js` — controller popup, source-tab selection, commands and playlist preload routing.
- `youtube-adapter.js` — small DOM/media adapter for the normal YouTube page.
- `controller.html`, `controller.css`, `controller.js` — compact controller UI.
- `options.html`, `options.css`, `options.js` — preload playlist setting.
- `SPEC.md` — implementation scope, constraints and acceptance checklist.
