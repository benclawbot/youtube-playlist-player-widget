const form = document.getElementById("settings-form");
const input = document.getElementById("playlist-url");
const status = document.getElementById("status");

function validPlaylist(value) {
  if (!value.trim()) return true;
  try {
    const url = new URL(value);
    return /^https:\/\/(www\.)?youtube\.com$/i.test(url.origin) && url.pathname === "/playlist" && url.searchParams.has("list");
  } catch { return false; }
}

chrome.storage.local.get({ preloadPlaylistUrl: "" }).then(({ preloadPlaylistUrl }) => { input.value = preloadPlaylistUrl; });

form.addEventListener("submit", async (event) => {
  event.preventDefault();
  if (!validPlaylist(input.value)) {
    status.textContent = "Enter a youtube.com playlist URL.";
    status.style.color = "#ffb4b4";
    return;
  }
  await chrome.storage.local.set({ preloadPlaylistUrl: input.value.trim() });
  status.textContent = "Saved.";
  status.style.color = "#8fda9b";
});

document.getElementById("clear").addEventListener("click", async () => {
  input.value = "";
  await chrome.storage.local.remove("preloadPlaylistUrl");
  status.textContent = "Cleared.";
  status.style.color = "#8fda9b";
});
