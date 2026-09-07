# Personal YouTube desktop controller — implementation specification

Date: 2026-09-07. Status: the browser-extension prototype and an independent Electron implementation are present; live YouTube sign-in/playback and Linux verification remain pending.

The browser-extension prototype is `manifest.json`, `background.js`, `youtube-adapter.js`, `controller.html`, `controller.css`, `controller.js`, `options.html`, `options.css` and `options.js`; it must not be presented as an independent player. The independent Electron implementation is `package.json`, `main.cjs`, `preload.cjs`, `app.html`, `app.css` and `app.js`. `README.md` documents both paths and `test.mjs` provides the local contract check. Both implementations use the normal YouTube website and have no Google API credentials, backend or media extraction.

## Independence requirement and architecture choice

An independent widget must own the YouTube playback surface inside its own process/window. The current extension cannot do that because its content script and `<video>` element live in a separate browser tab.

The chosen direction is an app-owned persistent YouTube webview/profile, implemented in the Electron app:

- Package a small Tauri/WebView app with a YouTube window and a controller window. The app owns its browser profile and cookie store, so the normal YouTube sign-in is completed once inside the app and reused on later launches.
- On first setup, the user signs in normally, opens the desired playlist, and saves its URL. Later launches load that URL in the app-owned YouTube window and reconnect the controller without requiring the external Edge/Chromium page to exist.
- Never read, export or copy cookies from the user's external Edge/Chrome profile. No password collection, token logging or backend is needed.

This keeps the requested authentication experience while making the player independent of the normal browser window. It still depends on the YouTube website running inside the app's own webview.

The unchosen alternatives remain documented for the feasibility gate:

1. **True custom client:** a standalone Tauri app uses YouTube Data API OAuth to list and edit playlists and an official YouTube IFrame player to play them. This is deferred because it changes sign-in to a Google Cloud OAuth setup. Private playlist access and write operations cannot be done anonymously.

Do not claim that “no API setup,” “private playlist retrieval,” “independent playback,” and “hidden audio-only playback” are simultaneously supported. L0 must record webview sign-in, cookie persistence, playback, packaging and policy results before the extension prototype is replaced.

## Product goal

Listen to personal YouTube playlists from a compact desktop control strip on Windows 11 and Omarchy, with normal Google sign-in, account switching, and playlist management. The app must own its YouTube window/profile so it continues independently of Edge or Chrome. No Google Cloud project or external-browser cookie copying is allowed.

## Confirmed requirements

| Area | Requirement |
| --- | --- |
| Audience | Personal use only; no accounts currently have Premium. |
| Platforms | Windows 11 with Edge first; Omarchy with its installed Chromium-family browser, exact browser to verify. |
| Window | Small standalone-feeling window; optional always-on-top. |
| Compact view | Persistent Compact toggle collapses to one line with current title and core actions; video remains in the normal YouTube tab. |
| Playback | Audio continues when the video window is hidden or minimized. |
| Controls | Play/pause, previous/next, seek, volume, shuffle and repeat Off/All/One where YouTube exposes the control. |
| Accounts | Multiple accounts through YouTube's own account switcher. |
| Playlists | Browse and play; create and rename; add, remove and reorder videos in editable playlists. |
| Sign-in | Normal website sign-in; no Google API project or OAuth credential setup for the user. |
| Delivery | Browser-installed app acceptable; simplest working solution preferred. |
| Settings | Save one `youtube.com/playlist?list=...` URL to load when no source tab is selected. |

The user accepted YouTube's existing website interface for account and playlist operations. A separately retrieved playlist database or custom library interface is not required. Account switching does not imply merging libraries or copying between accounts.

## Proposed experience and defaults

1. Open YouTube in the normal browser profile and sign in on Google's website.
2. Browse playlists and perform edits in YouTube's existing interface.
3. Start a playlist by user action, then open the compact controller.
4. Minimize the source window and continue listening; the strip remains usable.
5. Use “Open YouTube” to focus the existing source window for video, editing or account switching.

Defaults, chosen for implementation rather than explicitly requested: one controlled source tab at a time; English interface; compact neutral styling; no automatic playback on launch. Minimum strip contains title, previous, play/pause, next and Compact/Expand. Expanded controls add seek, volume, shuffle, repeat Off/All/One and links to YouTube, Settings and Playlists. Closing the strip leaves the source playing; closing the source ends playback and shows a disconnected state. Browser exit or OS sleep need not preserve playback. Session persistence follows the browser's normal behavior.

All controls need keyboard access, visible focus and accessible names. Reflect actual source state rather than assuming a command succeeded. Disable unavailable controls, including seek on unseekable content. Show a useful message when the source closes, navigates away, becomes unavailable or requires sign-in. Do not silently control another YouTube tab. A source-selection action may be used when several exist.

## Architecture gate — complete before product implementation

The approved candidate is the Electron app in this folder: a controller `BrowserWindow` plus an app-owned YouTube `BrowserWindow` using the persistent `persist:youtube-compact-player` session partition. The browser-extension files are a legacy prototype and are not part of the independent launch path.

Test on Edge first using a non-Premium account, with the user completing authentication. Record browser and OS versions, exact steps, observed results and limitations in FEASIBILITY.md:

1. Normal Google sign-in and YouTube account switching work in the chosen browser/app window.
2. A started playlist continues for at least ten minutes and crosses at least two track boundaries while its source window is minimized. Extend the run if tracks are long. Record any prompts, ads, suspension or interruptions honestly.
3. The independent strip can read title/playback state and issue every required command against the app-owned YouTube window without an external browser tab.
4. Reopening/focusing video does not create another player or restart playback.
5. Establish a working, reversible always-on-top mechanism on each OS. Browser window APIs expose an alwaysOnTop property but that alone does not prove applications can set it. An OS feature/configuration is acceptable if documented; do not add a native helper before testing existing mechanisms.
6. Verify source navigation, extension worker suspension/restart, account changes and source closure do not leave stale state or select an unrelated tab.
7. Review the chosen integration against current platform policies. Ordinary website playback and an API embed are different approaches; do not claim API permissions authorize hidden embedded playback.

Prefer documented browser features and standard media-element controls where they work. Keep unavoidable YouTube DOM dependencies in one small adapter, clearly mark them as unsupported integration points, and fail visibly when they break. Do not depend on private YouTube network APIs, extract media streams or transplant login cookies.

If a mandatory requirement fails, record the blocker and the smallest alternative with its tradeoff. Do not quietly drop hidden playback, the dedicated strip, no API setup or always-on-top. Embedded Google sign-in is a feasibility risk; if Google blocks sign-in in Electron, the no-Console requirement has no safe custom-client fallback.

Omarchy testing access is unconfirmed. Inspect the actual browser and desktop before choosing Linux commands. If no Linux machine is available, prepare a reproducible test checklist and explicitly leave Linux acceptance pending; Windows success is not cross-platform verification.

## Security, state and scope

- Google/YouTube and the browser own credentials and sessions. No password collection, cookie export, token logging, backend or telemetry.
- Limit extension permissions to the demonstrated integration needs and relevant YouTube origins; no all-sites access by default.
- Validate message sources and command values. Render page-derived titles as text. Remote pages receive no native execution access.
- Store only necessary local UI preferences and source identifiers; handle identifiers becoming invalid. No copied playlist catalogue is needed.
- Preserve normal ads, account restrictions and service behavior. No downloads, ad blocking, stream extraction or premium-feature workarounds.
- User actions in YouTube perform playlist writes. Test edits with a designated disposable playlist; do not modify unrelated playlists.
- No custom playlist editor, custom OAuth, cloud sync, media-key integration, tray service, editable queue, cross-account copying, public store publishing or updater in version one. The settings page stores only the selected preload URL and compact preference.

## Acceptance checklist

Run applicable checks on both target platforms; record pass/fail/not tested separately.

| ID | Scenario and expected result |
| --- | --- |
| A1 | Install from documented instructions; launch without API credentials or a paid subscription. |
| A2 | Sign in, switch between two accounts using YouTube, and see the selected account's playlists without a stale custom library. |
| A3 | Create/rename a test playlist, add two videos, change order, remove one, reload and verify changes through YouTube. |
| A4 | Start an existing playlist; play/pause, previous/next, seek and volume work and the strip reflects actual state. |
| A5 | Shuffle and playlist repeat change the website's actual playback mode and remain correctly displayed after track changes. |
| A5a | Settings accepts a valid YouTube playlist URL, rejects another origin, and Open YouTube loads the saved playlist when no source is selected. |
| A5b | Compact collapses the controller to one line with title and core actions; Expand restores seek, volume, shuffle, repeat and playlist actions. |
| A6 | Minimized source continues for ten minutes and two track transitions; strip controls remain functional. |
| A7 | Open video focuses the same source without duplicate playback; returning to compact mode preserves playback. |
| A8 | Always-on-top can be enabled and disabled with verified platform steps; other windows can be focused normally. |
| A9 | Source closure, navigation, sign-out, unavailable videos and connection loss produce accurate recoverable states, without uncontrolled retry loops. |
| A10 | Multiple YouTube tabs do not cause commands to target the wrong tab; extension worker restart recovers the chosen live source safely. |
| A11 | Keyboard-only operation, focus visibility, accessible labels and long titles work in the compact window. |
| A12 | Installation/removal leaves browser accounts and playlists intact; documentation clearly explains that closing the strip does not stop the source. |

For new nontrivial local logic, include the smallest runnable regression check covering message validation and source selection/state transitions. Browser and live YouTube behavior require real integration tests; mocked checks cannot establish A1–A10. Do not introduce a test framework solely for trivial UI code.

## Bounded Luna work packages

These are handoff instructions, not tasks already launched. Each worker must read this spec and FEASIBILITY.md if present. No worker should publish, commit, push or change real playlist content as an incidental action.

### L0 — Electron feasibility and profile setup

Prompt: “Run the architecture gate in SPEC.md against the Electron implementation. Install dependencies, launch the app, and ask the user to complete normal YouTube sign-in in the app-owned window. Verify the persistent `persist:youtube-compact-player` profile, saved playlist URL, controller-to-window commands, minimized playback and always-on-top on Windows 11. Repeat on an actual Omarchy machine if available. Produce FEASIBILITY.md with exact versions, reproduction steps, observations, policy caveats, unresolved Linux checks and a go/no-go decision for each mandatory requirement. Never read or copy cookies from Edge/Chrome and do not claim success from documentation alone.”

Dependency: none. Done: evidence exists; all hard blockers are identified. Implementation cannot proceed past a failed mandatory gate without resolving the requirement or approach.

### L1 — Browser source adapter

Prompt: “After L0 passes, harden only the Electron YouTube-window adapter in `main.cjs`. Support validated commands, actual playback state, navigation recovery and app-owned session persistence. Keep YouTube-specific assumptions localized. Add a small runnable check for nontrivial local logic and report live tests and remaining limitations.”

Dependency: L0. Owns adapter, routing and its checks. Must not redesign the controller or playlist UI.

### L2 — Compact controller

Prompt: “After L0 fixes the Electron IPC contract, implement the compact accessible control strip and expandable controls described in SPEC.md. Connect through the preload bridge. Provide accurate disconnected/loading/error states and focus the app-owned YouTube window. Do not add a custom account or playlist interface. Verify keyboard use, long titles and state updates.”

Dependency: L0; may run alongside L1 once file ownership and message shapes are frozen. Owns controller UI only. Fixtures may aid UI development but do not count as integration acceptance.

### L3 — Platform integration and final verification

Prompt: “Integrate L1 and L2 using the Electron architecture. Provide Windows 11 and actual Omarchy installation, launch, always-on-top and removal instructions. Run the SPEC.md acceptance checklist and record results with platform/runtime versions in VALIDATION.md. Fix integration defects within scope. Clearly mark unavailable Linux tests as pending. Deliver README.md and only the installation assets needed by the chosen approach.”

Dependency: L1 and L2 complete. Owns platform assets, documentation and integration fixes. Final delivery requires all mandatory acceptance checks on both platforms, or an explicit statement of what remains blocked; do not label a Windows-only result complete.

## Primary references and their limits

- [YouTube API developer policies](https://developers.google.com/youtube/terms/developer-policies): API clients cannot provide hidden background players or isolate audio/video. The proposed normal-website controller still requires its own feasibility and policy assessment.
- [YouTube Premium benefits](https://support.google.com/youtube/answer/6308116): the background-play section describes mobile apps. It does not prove ordinary minimized desktop website playback requires Premium.
- [Google OAuth policies](https://developers.google.com/identity/protocols/oauth2/policies): relevant to embedded sign-in risks; prefer the existing browser sign-in flow.
- [Chrome windows API](https://developer.chrome.com/docs/extensions/reference/api/windows): supports separate popup windows; do not infer an always-on-top setter from a readable property.
- [Omarchy](https://omarchy.org/): verify the installed environment and browser on the user's machine before platform-specific implementation.

## Outstanding facts

Exact Omarchy desktop/runtime versions and Linux test access remain unknown. The first launch requires the user to sign in normally inside the app-owned YouTube window; no Google Console setup or external-browser cookie import is part of the flow. Performance targets are functional responsiveness without busy polling; numerical budgets should follow measurement rather than invented requirements.
