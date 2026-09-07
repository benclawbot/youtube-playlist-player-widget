const controllers = new Set();
let sourceTabId = null;
let sourceWindowId = null;
let controllerWindowId = null;
const COMMANDS = new Set(["PLAY_PAUSE", "PREVIOUS", "NEXT", "SEEK", "VOLUME", "SHUFFLE", "REPEAT", "SET_REPEAT"]);

const isYouTube = (url) => typeof url === "string" && /^https:\/\/(www\.)?youtube\.com\//i.test(url);

function playlistUrl(value) {
  try {
    const url = new URL(value);
    return /^https:\/\/(www\.)?youtube\.com$/i.test(url.origin) && url.pathname === "/playlist" && url.searchParams.has("list") ? url.href : null;
  } catch { return null; }
}

async function configuredPlaylistUrl() {
  const { preloadPlaylistUrl = "" } = await chrome.storage.local.get({ preloadPlaylistUrl: "" });
  return playlistUrl(preloadPlaylistUrl) || "https://www.youtube.com/";
}

function post(port, message) {
  try { port.postMessage(message); } catch { controllers.delete(port); }
}

function broadcast(message) {
  for (const port of controllers) post(port, message);
}

function disconnected(reason = "Open a YouTube video, then choose Use active tab.") {
  broadcast({ type: "DISCONNECTED", reason });
}

async function activeYouTubeTab() {
  if (sourceWindowId != null && sourceWindowId !== controllerWindowId) {
    const [tab] = await chrome.tabs.query({ active: true, windowId: sourceWindowId });
    if (isYouTube(tab?.url)) return tab;
  }
  const tabs = await chrome.tabs.query({ url: ["https://www.youtube.com/*"] });
  return tabs.find((tab) => tab.windowId !== controllerWindowId && tab.active) ||
    tabs.find((tab) => tab.windowId !== controllerWindowId) ||
    null;
}

async function askSourceForState() {
  if (sourceTabId == null) {
    disconnected();
    return;
  }
  try {
    await chrome.tabs.sendMessage(sourceTabId, { type: "GET_STATE" });
  } catch {
    disconnected("Reload the YouTube tab once after installing the extension.");
  }
}

async function useTab(tab) {
  if (!tab || typeof tab.id !== "number" || !isYouTube(tab.url)) {
    disconnected("The active tab is not a YouTube page.");
    return;
  }
  sourceTabId = tab.id;
  sourceWindowId = tab.windowId;
  broadcast({ type: "SOURCE_CHANGED", tabId: sourceTabId });
  await askSourceForState();
}

async function focusSource() {
  if (sourceTabId == null) {
    const tab = await activeYouTubeTab();
    if (tab) await useTab(tab);
  }
  if (sourceTabId == null) {
    const tab = await chrome.tabs.create({ url: await configuredPlaylistUrl(), active: true });
    await useTab(tab);
  }
  if (sourceTabId == null) return;
  try {
    const tab = await chrome.tabs.get(sourceTabId);
    await chrome.windows.update(tab.windowId, { focused: true });
    await chrome.tabs.update(sourceTabId, { active: true });
  } catch {
    sourceTabId = null;
    sourceWindowId = null;
    disconnected("The YouTube source tab was closed.");
  }
}

async function command(command, value) {
  if (!COMMANDS.has(command)) {
    broadcast({ type: "ERROR", message: "Unknown controller command." });
    return;
  }
  if (sourceTabId == null) {
    disconnected();
    return;
  }
  try {
    const result = await chrome.tabs.sendMessage(sourceTabId, { type: "COMMAND", command, value });
    if (result?.ok === false) broadcast({ type: "ERROR", message: result.error || "YouTube could not apply that command." });
    await askSourceForState();
  } catch {
    disconnected("The YouTube page is unavailable. Reload it and try again.");
  }
}

chrome.action.onClicked.addListener(async () => {
  if (controllerWindowId != null) {
    try {
      await chrome.windows.update(controllerWindowId, { focused: true });
      return;
    } catch { controllerWindowId = null; }
  }
  const tab = await activeYouTubeTab();
  if (tab) {
    sourceTabId = tab.id;
    sourceWindowId = tab.windowId;
  }
  const window = await chrome.windows.create({
    type: "popup",
    url: chrome.runtime.getURL("controller.html"),
    width: 520,
    height: 190,
    focused: true
  });
  controllerWindowId = window.id;
});

chrome.windows.onRemoved.addListener((windowId) => {
  if (windowId === controllerWindowId) controllerWindowId = null;
});

chrome.tabs.onRemoved.addListener((tabId) => {
  if (tabId === sourceTabId) {
    sourceTabId = null;
    sourceWindowId = null;
    disconnected("The YouTube source tab was closed.");
  }
});

chrome.tabs.onUpdated.addListener((tabId, changeInfo) => {
  if (tabId !== sourceTabId || !changeInfo.url) return;
  if (!isYouTube(changeInfo.url)) {
    sourceTabId = null;
    sourceWindowId = null;
    disconnected("The source tab left YouTube.");
  } else {
    askSourceForState();
  }
});

chrome.runtime.onConnect.addListener((port) => {
  if (port.name !== "controller") return;
  controllers.add(port);
  post(port, sourceTabId == null ? { type: "DISCONNECTED", reason: "Open a YouTube video, then choose Use active tab." } : { type: "SOURCE_CHANGED", tabId: sourceTabId });
  port.onDisconnect.addListener(() => controllers.delete(port));
  port.onMessage.addListener(async (message) => {
    if (message.type === "USE_ACTIVE_TAB") await useTab(await activeYouTubeTab());
    else if (message.type === "COMMAND") await command(message.command, message.value);
    else if (message.type === "FOCUS_SOURCE") await focusSource();
    else if (message.type === "OPEN_SETTINGS") await chrome.runtime.openOptionsPage();
    else if (message.type === "OPEN_PLAYLISTS") {
      await focusSource();
      if (sourceTabId != null) {
        const url = await configuredPlaylistUrl();
        await chrome.tabs.update(sourceTabId, { url: url === "https://www.youtube.com/" ? "https://www.youtube.com/feed/playlists" : url });
      }
    } else if (message.type === "GET_STATE") await askSourceForState();
  });
  askSourceForState();
});

chrome.runtime.onMessage.addListener((message, sender) => {
  if (message.type !== "YT_STATE" || sender.tab?.id !== sourceTabId) return;
  broadcast({ type: "STATE", state: { ...message.state, sourceTabId } });
});
