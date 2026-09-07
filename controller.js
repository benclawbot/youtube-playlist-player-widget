const port = chrome.runtime.connect({ name: "controller" });
const $ = (id) => document.getElementById(id);
const seek = $("seek");
const volume = $("volume");
const repeat = $("repeat");
const message = $("message");
let lastState = null;

function showMessage(text) {
  message.textContent = text || "";
  message.hidden = !text;
}

function send(command, value) {
  port.postMessage({ type: "COMMAND", command, value });
}

async function resizeController(compactMode) {
  try {
    const window = await chrome.windows.getCurrent();
    await chrome.windows.update(window.id, { width: compactMode ? 340 : 520, height: compactMode ? 72 : 190 });
  } catch { /* Browser may not expose window resizing in an installed app. */ }
}

function render(state) {
  lastState = state;
  const available = Boolean(state.available);
  $("status").textContent = available ? "Connected" : "Waiting for a playable video";
  $("title").textContent = state.title || "No video selected";
  $("title").title = state.title || "No video selected";
  $("seek").max = String(state.duration || 0);
  $("seek").value = String(Math.min(state.currentTime || 0, state.duration || 0));
  $("seek").disabled = !available || !state.duration;
  $("volume").value = String(Math.round((state.volume ?? 1) * 100));
  $("volume").disabled = !available;
  $("volume-value").textContent = `${Math.round((state.volume ?? 1) * 100)}%`;
  repeat.value = state.repeatMode || "off";
  repeat.disabled = !available || state.repeatMode == null;
  document.querySelector('[data-command="PLAY_PAUSE"]').textContent = state.paused ? "▶" : "⏸";
  document.querySelector('[data-command="PLAY_PAUSE"]').setAttribute("aria-label", state.paused ? "Play" : "Pause");
  for (const name of ["PREVIOUS", "PLAY_PAUSE", "NEXT", "SHUFFLE"]) {
    document.querySelector(`[data-command="${name}"]`).disabled = !available;
  }
  const shuffle = document.querySelector('[data-command="SHUFFLE"]');
  shuffle.setAttribute("aria-pressed", String(state.shuffle === true));
}

port.onMessage.addListener((event) => {
  if (event.type === "STATE") { showMessage(""); render(event.state); }
  else if (event.type === "DISCONNECTED") {
    showMessage(event.reason);
    render({ available: false, title: "No video selected", currentTime: 0, duration: 0, paused: true, volume: 1, shuffle: false, repeat: false });
  } else if (event.type === "ERROR") showMessage(event.message);
  else if (event.type === "SOURCE_CHANGED") { $("status").textContent = "Loading source…"; showMessage(""); }
});

for (const button of document.querySelectorAll("[data-command]")) {
  button.addEventListener("click", () => send(button.dataset.command));
}
seek.addEventListener("input", () => send("SEEK", Number(seek.value)));
volume.addEventListener("input", () => { $("volume-value").textContent = `${volume.value}%`; send("VOLUME", Number(volume.value) / 100); });
volume.addEventListener("change", () => send("VOLUME", Number(volume.value) / 100));
repeat.addEventListener("change", () => send("SET_REPEAT", repeat.value));
$("use-active").addEventListener("click", () => port.postMessage({ type: "USE_ACTIVE_TAB" }));
$("open-youtube").addEventListener("click", () => port.postMessage({ type: "FOCUS_SOURCE" }));
$("playlists").addEventListener("click", () => port.postMessage({ type: "OPEN_PLAYLISTS" }));
$("settings").addEventListener("click", () => port.postMessage({ type: "OPEN_SETTINGS" }));

async function loadCompactMode() {
  const { compactMode = false } = await chrome.storage.local.get({ compactMode: false });
  document.body.classList.toggle("compact", compactMode);
  $("compact-toggle").setAttribute("aria-pressed", String(compactMode));
  $("compact-toggle").textContent = compactMode ? "Expand" : "Compact";
  resizeController(compactMode);
}

$("compact-toggle").addEventListener("click", async () => {
  const compactMode = !document.body.classList.contains("compact");
  document.body.classList.toggle("compact", compactMode);
  $("compact-toggle").setAttribute("aria-pressed", String(compactMode));
  $("compact-toggle").textContent = compactMode ? "Expand" : "Compact";
  resizeController(compactMode);
  await chrome.storage.local.set({ compactMode });
});
loadCompactMode();
port.postMessage({ type: "GET_STATE" });
