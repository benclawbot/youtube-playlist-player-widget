import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";

const manifest = JSON.parse(await readFile("manifest.json", "utf8"));
const controller = await readFile("controller.html", "utf8");
const adapter = await readFile("youtube-adapter.js", "utf8");
const background = await readFile("background.js", "utf8");
const options = await readFile("options.html", "utf8");

assert.equal(manifest.manifest_version, 3);
assert.deepEqual(manifest.background, { service_worker: "background.js" });
for (const id of ["seek", "volume", "repeat", "use-active", "open-youtube", "settings", "playlists", "compact-toggle"]) assert.match(controller, new RegExp(`id=["']${id}["']`));
for (const command of ["PLAY_PAUSE", "PREVIOUS", "NEXT", "SEEK", "VOLUME", "SHUFFLE", "REPEAT", "SET_REPEAT"]) assert.match(adapter, new RegExp(`"${command}"`));
assert.match(manifest.host_permissions[0], /youtube\.com/);
assert.match(background, /sourceWindowId/);
assert.match(background, /chrome\.tabs\.create\(\{ url: await configuredPlaylistUrl\(\)/);
assert(manifest.permissions.includes("storage"));
assert.equal(manifest.options_page, "options.html");
assert.match(options, /id=["']playlist-url["']/);

class Signal {
  constructor() { this.listeners = []; }
  addListener(listener) { this.listeners.push(listener); }
  async fire(...args) { for (const listener of this.listeners) await listener(...args); }
}

const calls = [];
const tabs = [{ id: 7, windowId: 1, url: "https://www.youtube.com/watch?v=test", active: true }];
const chromeStub = {
  action: { onClicked: new Signal() },
  windows: {
    onRemoved: new Signal(),
    async create(details) { calls.push({ type: "createWindow", details }); return { id: 2 }; },
    async update(windowId, details) { calls.push({ type: "updateWindow", windowId, details }); return {}; }
  },
  tabs: {
    onRemoved: new Signal(), onUpdated: new Signal(),
    async query(query) {
      if (query.windowId != null) return tabs.filter((tab) => tab.windowId === query.windowId && (!query.active || tab.active));
      if (query.url) return tabs.filter((tab) => tab.url.startsWith("https://www.youtube.com/"));
      return tabs.filter((tab) => tab.active);
    },
    async sendMessage(tabId, message) { calls.push({ type: "sendMessage", tabId, message }); return { ok: true }; },
    async get(tabId) { return tabs.find((tab) => tab.id === tabId); },
    async update(tabId, details) { calls.push({ type: "updateTab", tabId, details }); return {}; },
    async create(details) {
      const tab = { id: 12, windowId: 1, url: details.url, active: true };
      tabs.push(tab); calls.push({ type: "createTab", details }); return tab;
    }
  },
  runtime: { onConnect: new Signal(), onMessage: new Signal(), getURL: (file) => `chrome-extension://test/${file}`, async openOptionsPage() { calls.push({ type: "openOptionsPage" }); } },
  storage: { local: { async get() { return { preloadPlaylistUrl: "" }; } } }
};
globalThis.chrome = chromeStub;
await import(`./background.js?test=${Date.now()}`);
await chrome.action.onClicked.fire();
assert.equal(calls.find((call) => call.type === "createWindow").details.url, "chrome-extension://test/controller.html");
let controllerHandler;
const port = { name: "controller", messages: [], postMessage(message) { this.messages.push(message); }, onDisconnect: new Signal(), onMessage: { addListener(listener) { controllerHandler = listener; } } };
await chrome.runtime.onConnect.fire(port);
await controllerHandler({ type: "FOCUS_SOURCE" });
assert(calls.some((call) => call.type === "updateWindow" && call.windowId === 1));
await controllerHandler({ type: "USE_ACTIVE_TAB" });
assert(calls.some((call) => call.type === "sendMessage" && call.tabId === 7));
console.log("source selection flow checks passed");
console.log("extension contract checks passed");
