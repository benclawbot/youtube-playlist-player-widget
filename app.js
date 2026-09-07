const $ = (id) => document.getElementById(id);
const seek = $("seek");
const volume = $("volume");
const repeat = $("repeat");
const message = $("message");
let state = null;

function showMessage(text) { message.textContent = text || ""; message.hidden = !text; }
function send(name, value) { window.ytApp.command(name, value).then((result) => { if (result?.ok === false) showMessage(result.error); }); }

function render(next) {
  state = next;
  const available = Boolean(next.available);
  $("status").textContent = available ? "Connected" : "Waiting for a playable video";
  $("title").textContent = next.title || "No video selected";
  $("title").title = next.title || "No video selected";
  seek.max = String(next.duration || 0);
  seek.value = String(Math.min(next.currentTime || 0, next.duration || 0));
  seek.disabled = !available || !next.duration;
  volume.value = String(Math.round((next.volume ?? 1) * 100));
  volume.disabled = !available;
  $("volume-value").textContent = `${Math.round((next.volume ?? 1) * 100)}%`;
  repeat.value = next.repeatMode || "off";
  repeat.disabled = !available || next.repeatMode == null;
  const play = document.querySelector('[data-command="PLAY_PAUSE"]');
  play.textContent = next.paused ? "▶" : "⏸";
  play.setAttribute("aria-label", next.paused ? "Play" : "Pause");
  for (const name of ["PREVIOUS", "PLAY_PAUSE", "NEXT", "SHUFFLE"]) document.querySelector(`[data-command="${name}"]`).disabled = !available;
  document.querySelector('[data-command="SHUFFLE"]').setAttribute("aria-pressed", String(next.shuffle === true));
}

for (const button of document.querySelectorAll("[data-command]")) button.addEventListener("click", () => send(button.dataset.command));
seek.addEventListener("input", () => send("SEEK", Number(seek.value)));
volume.addEventListener("input", () => { $("volume-value").textContent = `${volume.value}%`; send("VOLUME", Number(volume.value) / 100); });
volume.addEventListener("change", () => send("VOLUME", Number(volume.value) / 100));
repeat.addEventListener("change", () => send("SET_REPEAT", repeat.value));
$("open-youtube").addEventListener("click", () => window.ytApp.openYouTube());
$("playlists").addEventListener("click", () => window.ytApp.openPlaylists());
$("settings").addEventListener("click", async () => { const settings = await window.ytApp.getSettings(); $("playlist-url").value = settings.preloadPlaylistUrl || ""; $("always-on-top").checked = Boolean(settings.alwaysOnTop); $("settings-panel").hidden = false; });
$("close-settings").addEventListener("click", () => { $("settings-panel").hidden = true; });
$("settings-form").addEventListener("submit", async (event) => {
  event.preventDefault();
  const result = await window.ytApp.saveSettings({ preloadPlaylistUrl: $("playlist-url").value });
  if (!result.ok) { $("settings-status").textContent = result.error; $("settings-status").style.color = "#ffb4b4"; return; }
  await window.ytApp.setAlwaysOnTop($("always-on-top").checked);
  $("settings-status").textContent = "Saved.";
  $("settings-status").style.color = "#8fda9b";
});
$("compact-toggle").addEventListener("click", async () => {
  const compact = !document.body.classList.contains("compact");
  document.body.classList.toggle("compact", compact);
  $("compact-toggle").setAttribute("aria-pressed", String(compact));
  $("compact-toggle").textContent = compact ? "Expand" : "Compact";
  await window.ytApp.setCompact(compact);
});

window.ytApp.getSettings().then((settings) => {
  document.body.classList.toggle("compact", Boolean(settings.compactMode));
  $("compact-toggle").setAttribute("aria-pressed", String(Boolean(settings.compactMode)));
  $("compact-toggle").textContent = settings.compactMode ? "Expand" : "Compact";
  window.ytApp.onState(render);
  window.ytApp.getState().then(render);
});
