/*
 * popup.js — Extension popup logic
 *
 * Queries content script for game detection + canvas status.
 * Communicates with background.js for profile sync.
 */
(function () {
  "use strict";

  const storage = chrome.storage.local;

  function $(id) { return document.getElementById(id); }

  function setToggle(el, on) {
    el.classList.toggle("on", on);
    el.setAttribute("aria-pressed", String(on));
  }

  // ---- query active tab for game/canvas status ----
  async function queryTabStatus() {
    try {
      const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
      if (!tab) return null;
      return await chrome.tabs.sendMessage(tab.id, { type: "GET_STATUS" });
    } catch {
      return null;
    }
  }

  // ---- load state ----
  async function loadState() {
    const [data, tabStatus] = await Promise.all([
      storage.get({
        enabled: false,
        overlays: true,
        profile: { type: "Not assessed", severity: 0, contrast: 50, outline: 2 },
      }),
      queryTabStatus(),
    ]);

    setToggle($("toggleEnabled"), data.enabled);
    setToggle($("toggleOverlays"), data.overlays);

    $("pType").textContent = data.profile.type;
    $("pSeverity").textContent = data.profile.severity > 0 ? `${data.profile.severity}%` : "—";
    $("pContrast").textContent = `${data.profile.contrast}%`;
    $("pOutline").textContent = `${data.profile.outline}px`;

    updateStatus(data.enabled);

    // Show game detection
    if (tabStatus && tabStatus.game) {
      $("gameBanner").classList.add("show");
      $("gameName").textContent = tabStatus.game;
      $("gameIcon").textContent = tabStatus.game.charAt(0).toUpperCase();
    } else {
      $("gameBanner").classList.remove("show");
    }

    // Show canvas count
    if (tabStatus && tabStatus.canvasCount > 0) {
      $("canvasInfo").style.display = "flex";
      $("canvasCount").textContent = tabStatus.canvasCount;
    } else {
      $("canvasInfo").style.display = "none";
    }
  }

  function updateStatus(enabled) {
    $("statusPulse").className = enabled ? "pulse active" : "pulse inactive";
    $("statusText").textContent = enabled ? "Correcting" : "Not connected";
    $("statusSub").textContent = enabled
      ? "Color correction active on this page"
      : "Enable to start correcting";
  }

  // ---- toggle handlers ----
  $("toggleEnabled").addEventListener("click", async function () {
    const data = await storage.get("enabled");
    const next = !data.enabled;
    await storage.set({ enabled: next });
    setToggle(this, next);
    updateStatus(next);

    // Get profile and send to content script
    const profileData = await storage.get("profile");
    const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
    if (tab) {
      chrome.tabs.sendMessage(tab.id, {
        type: "APPLY_PROFILE",
        enabled: next,
        profile: next ? profileData.profile : null,
      });
    }

    chrome.runtime.sendMessage({ type: "TOGGLE_ENABLED", enabled: next });

    // Re-query status after a moment (game detection takes time)
    if (next) {
      setTimeout(loadState, 2000);
    } else {
      $("gameBanner").classList.remove("show");
      $("canvasInfo").style.display = "none";
    }
  });

  $("toggleOverlays").addEventListener("click", async function () {
    const data = await storage.get("overlays");
    const next = !data.overlays;
    await storage.set({ overlays: next });
    setToggle(this, next);
    const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
    if (tab) {
      chrome.tabs.sendMessage(tab.id, { type: "TOGGLE_OVERLAYS", overlays: next });
    }
  });

  // ---- action buttons ----
  $("btnTakeAssessment").addEventListener("click", () => {
    chrome.tabs.create({ url: "https://visionadapt.vercel.app/#assessment" });
    window.close();
  });

  $("btnOpenDashboard").addEventListener("click", () => {
    chrome.tabs.create({ url: "https://visionadapt.vercel.app/#dashboard" });
    window.close();
  });

  $("linkDashboard").addEventListener("click", (e) => {
    e.preventDefault();
    chrome.tabs.create({ url: "https://visionadapt.vercel.app/" });
    window.close();
  });

  // ---- init ----
  loadState();
})();
