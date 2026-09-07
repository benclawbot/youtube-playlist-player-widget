(() => {
  let boundVideo = null;
  let pending = null;

  const text = (element) => element?.textContent?.replace(/\s+/g, " ").trim() || "";

  function videoElement() {
    return document.querySelector("video");
  }

  function title() {
    return text(document.querySelector("h1 yt-formatted-string")) ||
      text(document.querySelector("h1")) ||
      (document.title || "").replace(/\s+-\s+YouTube\s*$/i, "").trim();
  }

  function labelledButton(pattern) {
    const scopes = [document.querySelector("#movie_player"), document.querySelector("ytd-playlist-panel-renderer"), document];
    for (const scope of scopes) {
      if (!scope) continue;
      const elements = scope.querySelectorAll("button,[role='button']");
      for (const element of elements) {
        const label = `${element.getAttribute("aria-label") || ""} ${element.getAttribute("title") || ""}`;
        if (pattern.test(label)) return element;
      }
    }
    return null;
  }

  function playerButton(selector, pattern) {
    return document.querySelector(selector) || labelledButton(pattern);
  }

  function usable(button) {
    return button && !button.disabled && button.getAttribute("aria-disabled") !== "true";
  }

  function toggleValue(pattern) {
    const button = labelledButton(pattern);
    if (!button) return null;
    const label = `${button.getAttribute("aria-label") || ""} ${button.getAttribute("title") || ""}`;
    return button.getAttribute("aria-pressed") === "true" || /on|enabled|turn off|disable/i.test(label);
  }

  function repeatButton() {
    return labelledButton(/repeat|loop/i);
  }

  function repeatMode() {
    const button = repeatButton();
    if (!button) return null;
    const label = `${button.getAttribute("aria-label") || ""} ${button.getAttribute("title") || ""}`.toLowerCase();
    if (/repeat (video|one)|repeat this video|repeat current|loop (video|one)/i.test(label)) return "one";
    if (/repeat (playlist|all)|loop playlist|repeat on|turn off repeat|disable repeat/i.test(label)) return "all";
    if (/repeat off|turn on repeat|loop off|enable repeat/i.test(label)) return "off";
    return button.getAttribute("aria-pressed") === "true" ? "all" : "off";
  }

  function state() {
    const video = videoElement();
    const currentRepeatMode = repeatMode();
    return {
      available: Boolean(video),
      title: title(),
      url: location.href,
      currentTime: video?.currentTime || 0,
      duration: Number.isFinite(video?.duration) ? video.duration : 0,
      paused: video ? video.paused : true,
      volume: video?.muted ? 0 : video?.volume ?? 1,
      muted: Boolean(video?.muted),
      shuffle: toggleValue(/shuffle/i),
      repeat: currentRepeatMode,
      repeatMode: currentRepeatMode
    };
  }

  function publish() {
    chrome.runtime.sendMessage({ type: "YT_STATE", state: state() }).catch(() => {});
  }

  function schedulePublish() {
    clearTimeout(pending);
    pending = setTimeout(publish, 120);
  }

  function bindVideo() {
    const video = videoElement();
    if (video === boundVideo) return;
    if (boundVideo) {
      for (const event of ["play", "pause", "timeupdate", "durationchange", "volumechange", "loadedmetadata", "ended"]) {
        boundVideo.removeEventListener(event, schedulePublish);
      }
    }
    boundVideo = video;
    if (video) {
      for (const event of ["play", "pause", "timeupdate", "durationchange", "volumechange", "loadedmetadata", "ended"]) {
        video.addEventListener(event, schedulePublish);
      }
    }
    schedulePublish();
  }

  function command(name, value) {
    bindVideo();
    const video = boundVideo;
    if (!video && !["NEXT", "PREVIOUS", "SHUFFLE", "REPEAT"].includes(name)) return { ok: false, error: "No playable YouTube video is loaded." };
    if (name === "PLAY_PAUSE") (video.paused ? video.play() : video.pause()).catch(() => {});
    else if (name === "NEXT") {
      const button = playerButton("#movie_player .ytp-next-button", /^(next|next video)$/i);
      if (!usable(button)) return { ok: false, error: "Next video is unavailable for this YouTube page." };
      button.click();
    } else if (name === "PREVIOUS") {
      const button = playerButton("#movie_player .ytp-prev-button", /^(previous|previous video|prev)$/i);
      if (!usable(button)) return { ok: false, error: "Previous video is unavailable for this YouTube page." };
      button.click();
    }
    else if (name === "SEEK") video.currentTime = Math.max(0, Math.min(Number(value) || 0, video.duration || Number(value) || 0));
    else if (name === "VOLUME") { video.muted = false; video.volume = Math.max(0, Math.min(1, Number(value) || 0)); }
    else if (name === "SHUFFLE") {
      const button = labelledButton(/shuffle/i);
      if (!usable(button)) return { ok: false, error: "Shuffle is unavailable for this YouTube page." };
      button.click();
    } else if (name === "REPEAT") {
      const button = repeatButton();
      if (!usable(button)) return { ok: false, error: "Repeat is unavailable for this YouTube page." };
      button.click();
    } else if (name === "SET_REPEAT") {
      const target = ["off", "all", "one"].includes(value) ? value : "off";
      const button = repeatButton();
      if (!usable(button)) return { ok: false, error: "Repeat is unavailable for this YouTube page." };
      for (let attempts = 0; attempts < 3 && repeatMode() !== target; attempts++) button.click();
      if (repeatMode() !== target) return { ok: false, error: "YouTube did not expose that repeat mode on this page." };
    } else return { ok: false, error: "Unknown controller command." };
    schedulePublish();
    return { ok: true };
  }

  chrome.runtime.onMessage.addListener((message, _sender, sendResponse) => {
    if (message.type === "GET_STATE") { bindVideo(); publish(); sendResponse({ ok: true }); }
    else if (message.type === "COMMAND") sendResponse(command(message.command, message.value));
    return true;
  });

  new MutationObserver(() => { bindVideo(); }).observe(document.documentElement, { childList: true, subtree: true });
  for (const event of ["yt-navigate-finish", "yt-page-data-updated", "popstate"]) window.addEventListener(event, schedulePublish);
  bindVideo();
})();
