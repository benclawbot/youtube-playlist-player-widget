const { app, BrowserWindow, ipcMain, session } = require("electron");
const fs = require("node:fs/promises");
const path = require("node:path");

const YOUTUBE_HOME = "https://www.youtube.com/";
const PLAYLISTS_PAGE = "https://www.youtube.com/feed/playlists";
const YOUTUBE_PARTITION = "persist:youtube-compact-player";
const COMMANDS = new Set(["PLAY_PAUSE", "PREVIOUS", "NEXT", "SEEK", "VOLUME", "SHUFFLE", "SET_REPEAT"]);

let controllerWindow;
let youtubeWindow;
let stateTimer;
let settings = { preloadPlaylistUrl: "", compactMode: false, alwaysOnTop: false };

function validPlaylistUrl(value) {
  try {
    const url = new URL(value);
    return /^https:\/\/(www\.)?youtube\.com$/i.test(url.origin) && url.pathname === "/playlist" && url.searchParams.has("list");
  } catch { return false; }
}

function preloadUrl() {
  return validPlaylistUrl(settings.preloadPlaylistUrl) ? settings.preloadPlaylistUrl : YOUTUBE_HOME;
}

async function readSettings() {
  try {
    const file = await fs.readFile(path.join(app.getPath("userData"), "settings.json"), "utf8");
    settings = { ...settings, ...JSON.parse(file) };
  } catch { /* First launch or an unreadable old settings file. */ }
}

async function writeSettings() {
  await fs.mkdir(app.getPath("userData"), { recursive: true });
  await fs.writeFile(path.join(app.getPath("userData"), "settings.json"), JSON.stringify(settings, null, 2));
}

function sendState(state) {
  if (controllerWindow && !controllerWindow.isDestroyed()) controllerWindow.webContents.send("state", state);
}

const stateScript = `(() => {
  const text = (element) => element?.textContent?.replace(/\\s+/g, " ").trim() || "";
  const video = document.querySelector("video");
  const buttons = [...document.querySelectorAll("button,[role='button']")];
  const button = (pattern) => buttons.find((element) => pattern.test((element.getAttribute("aria-label") || "") + " " + (element.getAttribute("title") || "")));
  const repeatButton = button(/repeat|loop/i);
  const repeatLabel = repeatButton ? ((repeatButton.getAttribute("aria-label") || "") + " " + (repeatButton.getAttribute("title") || "")).toLowerCase() : "";
  let repeatMode = null;
  if (repeatButton) {
    if (/repeat (video|one)|repeat this video|repeat current|loop (video|one)/i.test(repeatLabel)) repeatMode = "one";
    else if (/repeat (playlist|all)|loop playlist|repeat on|turn off repeat|disable repeat/i.test(repeatLabel)) repeatMode = "all";
    else repeatMode = repeatButton.getAttribute("aria-pressed") === "true" ? "all" : "off";
  }
  const shuffleButton = button(/shuffle/i);
  return {
    available: Boolean(video),
    title: text(document.querySelector("h1 yt-formatted-string")) || text(document.querySelector("h1")) || (document.title || "").replace(/\\s+-\\s+YouTube\\s*$/i, "").trim(),
    url: location.href,
    currentTime: video?.currentTime || 0,
    duration: Number.isFinite(video?.duration) ? video.duration : 0,
    paused: video ? video.paused : true,
    volume: video?.muted ? 0 : video?.volume ?? 1,
    muted: Boolean(video?.muted),
    shuffle: shuffleButton ? (shuffleButton.getAttribute("aria-pressed") === "true" || /on|enabled|turn off|disable/i.test((shuffleButton.getAttribute("aria-label") || "") + " " + (shuffleButton.getAttribute("title") || ""))) : null,
    repeatMode
  };
})()`;

async function getState() {
  if (!youtubeWindow || youtubeWindow.isDestroyed()) return { available: false, title: "No video selected", currentTime: 0, duration: 0, paused: true, volume: 1, shuffle: null, repeatMode: null };
  try { return await youtubeWindow.webContents.executeJavaScript(stateScript, true); }
  catch { return { available: false, title: "Loading YouTube…", currentTime: 0, duration: 0, paused: true, volume: 1, shuffle: null, repeatMode: null }; }
}

async function updateState() {
  sendState(await getState());
}

function startStateUpdates() {
  clearInterval(stateTimer);
  stateTimer = setInterval(updateState, 750);
  updateState();
}

function isAllowedYouTubeWindow(url) {
  return /^https:\/\/(www\.)?youtube\.com\//i.test(url) || /^https:\/\/accounts\.google\.com\//i.test(url);
}

function createYouTubeWindow(url = preloadUrl()) {
  const youtubeSession = session.fromPartition(YOUTUBE_PARTITION);
  youtubeWindow = new BrowserWindow({
    width: 960,
    height: 640,
    minWidth: 640,
    minHeight: 360,
    title: "YouTube",
    webPreferences: { session: youtubeSession, contextIsolation: true, nodeIntegration: false, sandbox: true }
  });
  youtubeWindow.webContents.setWindowOpenHandler(({ url: target }) => ({ action: isAllowedYouTubeWindow(target) ? "allow" : "deny" }));
  youtubeWindow.on("closed", () => { youtubeWindow = undefined; updateState(); });
  youtubeWindow.loadURL(url);
  startStateUpdates();
  return youtubeWindow;
}

function ensureYouTube(url) {
  if (!youtubeWindow || youtubeWindow.isDestroyed()) return createYouTubeWindow(url);
  if (url && youtubeWindow.webContents.getURL() !== url) youtubeWindow.loadURL(url);
  youtubeWindow.show();
  youtubeWindow.focus();
  return youtubeWindow;
}

const commandScript = (name, value) => {
  const safeValue = JSON.stringify(value);
  return `(() => {
    const video = document.querySelector("video");
    const buttons = [...document.querySelectorAll("button,[role='button']")];
    const labelled = (pattern) => buttons.find((element) => pattern.test((element.getAttribute("aria-label") || "") + " " + (element.getAttribute("title") || "")));
    const usable = (element) => element && !element.disabled && element.getAttribute("aria-disabled") !== "true";
    const value = ${safeValue};
    if (${JSON.stringify(name)} === "PLAY_PAUSE") { if (!video) return { ok: false, error: "No playable YouTube video is loaded." }; (video.paused ? video.play() : video.pause()).catch(() => {}); }
    else if (${JSON.stringify(name)} === "NEXT") { const b = document.querySelector("#movie_player .ytp-next-button") || labelled(/^(next|next video)$/i); if (!usable(b)) return { ok: false, error: "Next video is unavailable for this YouTube page." }; b.click(); }
    else if (${JSON.stringify(name)} === "PREVIOUS") { const b = document.querySelector("#movie_player .ytp-prev-button") || labelled(/^(previous|previous video|prev)$/i); if (!usable(b)) return { ok: false, error: "Previous video is unavailable for this YouTube page." }; b.click(); }
    else if (${JSON.stringify(name)} === "SEEK") { if (!video) return { ok: false, error: "No playable YouTube video is loaded." }; video.currentTime = Math.max(0, Math.min(Number(value) || 0, video.duration || Number(value) || 0)); }
    else if (${JSON.stringify(name)} === "VOLUME") { if (!video) return { ok: false, error: "No playable YouTube video is loaded." }; video.muted = false; video.volume = Math.max(0, Math.min(1, Number(value) || 0)); }
    else if (${JSON.stringify(name)} === "SHUFFLE") { const b = labelled(/shuffle/i); if (!usable(b)) return { ok: false, error: "Shuffle is unavailable for this YouTube page." }; b.click(); }
    else if (${JSON.stringify(name)} === "SET_REPEAT") {
      const b = labelled(/repeat|loop/i); if (!usable(b)) return { ok: false, error: "Repeat is unavailable for this YouTube page." };
      const mode = ["off", "all", "one"].includes(value) ? value : "off";
      const readMode = () => { const label = ((b.getAttribute("aria-label") || "") + " " + (b.getAttribute("title") || "")).toLowerCase(); if (/repeat (video|one)|repeat this video|repeat current|loop (video|one)/i.test(label)) return "one"; if (/repeat (playlist|all)|loop playlist|repeat on|turn off repeat|disable repeat/i.test(label)) return "all"; return b.getAttribute("aria-pressed") === "true" ? "all" : "off"; };
      for (let attempts = 0; attempts < 3 && readMode() !== mode; attempts++) b.click();
      if (readMode() !== mode) return { ok: false, error: "YouTube did not expose that repeat mode on this page." };
    } else return { ok: false, error: "Unknown controller command." };
    return { ok: true };
  })()`;
};

async function runCommand(name, value) {
  if (!COMMANDS.has(name)) return { ok: false, error: "Unknown controller command." };
  if (!youtubeWindow || youtubeWindow.isDestroyed()) ensureYouTube(preloadUrl());
  try {
    const result = await youtubeWindow.webContents.executeJavaScript(commandScript(name, value), true);
    updateState();
    return result;
  } catch { return { ok: false, error: "The YouTube window is unavailable." }; }
}

function createControllerWindow() {
  controllerWindow = new BrowserWindow({
    width: settings.compactMode ? 340 : 520,
    height: settings.compactMode ? 72 : 190,
    minWidth: 300,
    minHeight: 60,
    resizable: true,
    alwaysOnTop: Boolean(settings.alwaysOnTop),
    title: "YouTube controller",
    webPreferences: { preload: path.join(__dirname, "preload.cjs"), contextIsolation: true, nodeIntegration: false, sandbox: true }
  });
  controllerWindow.loadFile(path.join(__dirname, "app.html"));
  controllerWindow.on("closed", () => { controllerWindow = undefined; });
}

ipcMain.handle("get-settings", () => settings);
ipcMain.handle("get-state", getState);
ipcMain.handle("open-youtube", () => { ensureYouTube(preloadUrl()); return true; });
ipcMain.handle("open-playlists", () => { ensureYouTube(validPlaylistUrl(settings.preloadPlaylistUrl) ? settings.preloadPlaylistUrl : PLAYLISTS_PAGE); return true; });
ipcMain.handle("command", (_event, { name, value }) => runCommand(name, value));
ipcMain.handle("save-settings", async (_event, next) => {
  const preloadPlaylistUrl = typeof next?.preloadPlaylistUrl === "string" ? next.preloadPlaylistUrl.trim() : "";
  if (preloadPlaylistUrl && !validPlaylistUrl(preloadPlaylistUrl)) return { ok: false, error: "Enter a youtube.com playlist URL." };
  settings.preloadPlaylistUrl = preloadPlaylistUrl;
  await writeSettings();
  return { ok: true, settings };
});
ipcMain.handle("set-compact", async (_event, compactMode) => {
  settings.compactMode = Boolean(compactMode);
  await writeSettings();
  if (controllerWindow && !controllerWindow.isDestroyed()) controllerWindow.setSize(settings.compactMode ? 340 : 520, settings.compactMode ? 72 : 190);
  return settings;
});
ipcMain.handle("set-always-on-top", async (_event, alwaysOnTop) => {
  settings.alwaysOnTop = Boolean(alwaysOnTop);
  await writeSettings();
  if (controllerWindow && !controllerWindow.isDestroyed()) controllerWindow.setAlwaysOnTop(settings.alwaysOnTop);
  return settings;
});

app.whenReady().then(async () => {
  await readSettings();
  createControllerWindow();
  createYouTubeWindow(preloadUrl());
});

app.on("window-all-closed", () => { if (process.platform !== "darwin") app.quit(); });
