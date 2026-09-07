# YouTube Playlist Player Widget — extension specification

Date: 2026-09-07. Status: browser-extension implementation is the selected product path.

## Product decision

Use a Manifest V3 extension for Edge on Windows 11 and a Chromium-family browser on Omarchy/Linux. The extension opens a separate controller popup and controls one selected YouTube tab through a content-script adapter. YouTube remains responsible for sign-in, account switching, playlist browsing/editing, ads and playback.

This choice keeps the user's normal YouTube authentication and requires no Google Cloud Console project, API key, OAuth client, backend or cookie copying. It does mean the source YouTube tab must stay open for playback; this is a browser controller, not an independent player.

## Confirmed requirements

| Area | Requirement |
| --- | --- |
| Audience | Personal use only; accounts are not Premium. |
| Platforms | Windows 11 with Edge first; Omarchy/Linux with its installed Chromium-family browser. |
| Window | Separate compact controller popup. |
| Compact view | One line showing title, previous, play/pause and next; video stays in YouTube. |
| Playback | Play/pause, previous/next, seek and volume. |
| Modes | Shuffle and repeat Off/All/One where YouTube exposes them. |
| Accounts | Multiple accounts through YouTube's existing account switcher. |
| Playlists | Browse, play, create, rename, add, remove and reorder through YouTube's existing UI. |
| Sign-in | Normal browser sign-in; no developer setup. |
| Preload | Store one validated `youtube.com/playlist?list=...` URL for **Open YouTube**. |

## User flow

1. Install the unpacked extension in Edge or Chromium and pin its action.
2. Sign in to YouTube normally and open a video or playlist.
3. Reload the YouTube tab once after installation so the content script is present.
4. Click the extension action to open the controller. It selects the active YouTube tab, excluding the controller popup.
5. Use **Use active tab** to select a different live YouTube tab, or **Open YouTube** to create/focus one. The saved preload URL is used for a newly created source tab.
6. Use **Compact** for the one-line strip. Use YouTube itself for account switching and playlist edits.

The controller reflects actual source state and reports a recoverable message when the source closes, leaves YouTube, needs a reload or has no playable video. Closing the controller does not stop the source; closing the source ends playback.

## Architecture

- `manifest.json` declares only `tabs`, `windows`, `storage` and the YouTube host permission.
- `background.js` owns the controller ports, selected source tab/window, popup lifecycle, source recovery and validated command routing.
- `youtube-adapter.js` stays isolated as the YouTube-specific integration point. It reads the page's video element and accessible player buttons, publishes state, and fails visibly when a control is unavailable.
- `controller.*` renders the popup and sends commands over a runtime port.
- `options.*` validates and stores the preload playlist URL in `chrome.storage.local`.

No private YouTube network API, media extraction, download, ad blocking, password collection, token logging, cookie export/import or custom playlist database is allowed.

## Acceptance checklist

Run applicable checks on both target platforms and record pass/fail/not tested separately.

| ID | Scenario and expected result |
| --- | --- |
| A1 | Load unpacked in Edge/Chromium without API credentials or a paid subscription. |
| A2 | Sign in, switch accounts in YouTube and see the selected account's own playlists. |
| A3 | Create/rename a disposable playlist, add two videos, reorder them, remove one and reload YouTube to verify. |
| A4 | Start a playlist; play/pause, previous/next, seek and volume work and state updates in the controller. |
| A5 | Shuffle and repeat Off/All/One change the actual YouTube mode when exposed and remain displayed after navigation. |
| A6 | A valid preload URL is accepted, another origin is rejected, and **Open YouTube** loads the saved URL when no source is selected. |
| A7 | Compact collapses to one line; Expand restores seek, volume, shuffle, repeat and playlist actions. |
| A8 | Source navigation, closure, sign-out and an unavailable video produce accurate recoverable states without targeting another tab. |
| A9 | Multiple YouTube tabs do not receive commands for the wrong source; the service worker can reconnect to the selected live tab. |
| A10 | Keyboard-only operation, visible focus, accessible labels and long titles work in the popup. |
| A11 | Minimized/background playback is tested honestly on each browser/account; the source tab remains open. |
| A12 | Removing the extension leaves browser accounts and playlists intact. |

`node test.mjs` is the small local regression check for the extension contract and source-selection flow. It cannot prove live YouTube behavior; those cases require an actual browser run.

## Known limits

YouTube's DOM and accessible labels can change, so the adapter may need maintenance. Browser extension windows do not provide a portable, reliable always-on-top setter. Background playback while minimized is controlled by the normal browser and YouTube behavior and may vary by account, content, ads and browser version. If independent playback or a custom playlist catalogue becomes necessary, that is a separate project requiring a different authentication and API decision.
