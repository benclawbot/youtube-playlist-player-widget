const { contextBridge, ipcRenderer } = require("electron");

contextBridge.exposeInMainWorld("ytApp", {
  getSettings: () => ipcRenderer.invoke("get-settings"),
  getState: () => ipcRenderer.invoke("get-state"),
  openYouTube: () => ipcRenderer.invoke("open-youtube"),
  openPlaylists: () => ipcRenderer.invoke("open-playlists"),
  command: (name, value) => ipcRenderer.invoke("command", { name, value }),
  saveSettings: (settings) => ipcRenderer.invoke("save-settings", settings),
  setCompact: (value) => ipcRenderer.invoke("set-compact", value),
  setAlwaysOnTop: (value) => ipcRenderer.invoke("set-always-on-top", value),
  onState: (callback) => {
    const listener = (_event, state) => callback(state);
    ipcRenderer.on("state", listener);
    return () => ipcRenderer.removeListener("state", listener);
  }
});
