(function () {
  "use strict";

  var storage = chrome.storage.local;

  chrome.runtime.onInstalled.addListener(function(d) {
    if (d.reason === "install") {
      storage.set({
        enabled: false,
        overlays: true,
        profile: { type: "Not assessed", severity: 0, contrast: 50, outline: 2, iconPref: "Symbols", pattern: true },
        diagnostics: { lastRun: null, backendOk: false, extOk: false },
      });
      setBadge("off");
    }
  });

  function setBadge(state) {
    var text = state === "on" ? "ON" : "";
    var color = state === "on" ? "#22c55e" : state === "error" ? "#ef4444" : "#52525b";
    chrome.action.setBadgeText({ text: text });
    chrome.action.setBadgeBackgroundColor({ color: color });
  }

  function broadcast(msg) {
    chrome.tabs.query({}, function(tabs) {
      for (var i = 0; i < tabs.length; i++) {
        if (tabs[i].id) chrome.tabs.sendMessage(tabs[i].id, msg).catch(function() {});
      }
    });
  }

  function sendToTab(tabId, msg) {
    return chrome.tabs.sendMessage(tabId, msg).catch(function() { return null; });
  }

  async function runDiagnostics(tabId) {
    var results = { backend: null, extension: null, timestamp: Date.now() };

    try {
      var t0 = performance.now();
      var resp = await fetch("https://visionadapt.vercel.app/api/v1/health");
      results.backend = { ok: resp.ok, status: resp.status, latencyMs: Math.round(performance.now() - t0) };
    } catch (e) {
      results.backend = { ok: false, error: e.message };
    }

    if (tabId) {
      try {
        var t1 = performance.now();
        var resp2 = await sendToTab(tabId, { type: "PING" });
        results.extension = { ok: resp2 && resp2.pong === true, latencyMs: Math.round(performance.now() - t1) };
      } catch (e) {
        results.extension = { ok: false, error: e.message };
      }
    }

    await storage.set({ diagnostics: results });
    return results;
  }

  chrome.runtime.onMessage.addListener(function(msg, sender, sendResponse) {
    switch (msg.type) {
      case "TOGGLE":
        setBadge(msg.enabled ? "on" : "off");
        broadcast({ type: "APPLY", enabled: msg.enabled });
        sendResponse({ ok: true });
        break;

      case "TOGGLE_OVERLAYS":
        broadcast({ type: "TOGGLE_OVERLAYS", overlays: msg.overlays });
        sendResponse({ ok: true });
        break;

      case "GAME_DETECTED":
        if (msg.game) {
          chrome.action.setBadgeText({ text: (msg.genre || "").substring(0, 4).toUpperCase() || "GAME" });
          chrome.action.setBadgeBackgroundColor({ color: "#3b82f6" });
          storage.set({ detectedGame: msg.game, detectedGenre: msg.genre });
        } else {
          storage.get("enabled", function(d) { if (d && d.enabled) setBadge("on"); });
          storage.set({ detectedGame: null, detectedGenre: null });
        }
        sendResponse({ ok: true });
        break;

      case "METRICS":
        storage.set({ lastMetrics: { fps: msg.fps, canvases: msg.canvases, game: msg.game ? msg.game.n : null, ts: Date.now() } });
        sendResponse({ ok: true });
        break;

      case "DIAGNOSTICS":
        runDiagnostics(msg.tabId).then(function(r) { sendResponse(r); });
        return true;

      case "STATUS":
        storage.get(["enabled", "profile", "detectedGame", "detectedGenre", "lastMetrics", "diagnostics"], function(d) {
          sendResponse(d || {});
        });
        return true;

      default:
        sendResponse({ error: "unknown" });
    }
  });

  storage.onChanged.addListener(function(changes, area) {
    if (area === "local" && changes.profile) {
      broadcast({ type: "APPLY", profile: changes.profile.newValue });
    }
  });
})();
