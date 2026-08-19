/*
 * background.js — Service worker (Manifest V3)
 *
 * Handles:
 * - Extension lifecycle
 * - Badge updates (ON/OFF, game name)
 * - Message routing between popup and content scripts
 * - Game detection announcements
 */
(function () {
  "use strict";

  const storage = chrome.storage.local;

  // ---- default settings on install ----
  chrome.runtime.onInstalled.addListener(async (details) => {
    if (details.reason === "install") {
      await storage.set({
        enabled: false,
        overlays: true,
        profile: {
          type: "Not assessed",
          severity: 0,
          contrast: 50,
          outline: 2,
          iconPref: "Symbols",
          pattern: true,
        },
      });
      setBadge("off");
    }
  });

  // ---- badge helpers ----
  function setBadge(state) {
    const text = state === "on" ? "ON" : "";
    const color = state === "on" ? "#34C759" : "#E4E7EC";
    chrome.action.setBadgeText({ text });
    chrome.action.setBadgeBackgroundColor({ color });
  }

  function setGameBadge(gameName) {
    if (gameName) {
      chrome.action.setBadgeText({ text: "GAME" });
      chrome.action.setBadgeBackgroundColor({ color: "#007AFF" });
    }
  }

  // ---- message handler ----
  chrome.runtime.onMessage.addListener((msg, sender, sendResponse) => {
    switch (msg.type) {
      case "TOGGLE_ENABLED":
        setBadge(msg.enabled ? "on" : "off");
        broadcastToTabs({ type: "APPLY_PROFILE", enabled: msg.enabled });
        sendResponse({ ok: true });
        break;

      case "TOGGLE_OVERLAYS":
        broadcastToTabs({ type: "TOGGLE_OVERLAYS", overlays: msg.overlays });
        sendResponse({ ok: true });
        break;

      case "GAME_DETECTED":
        if (msg.game) {
          setGameBadge(msg.game);
          // Store detected game for popup
          storage.set({ detectedGame: msg.game, detectedGenre: msg.genre });
        } else {
          storage.get("enabled", (data) => {
            if (data.enabled) setBadge("on");
          });
          storage.set({ detectedGame: null, detectedGenre: null });
        }
        sendResponse({ ok: true });
        break;

      case "GET_STATUS":
        storage.get(["enabled", "profile", "detectedGame"], (data) => {
          sendResponse(data);
        });
        return true;

      default:
        sendResponse({ error: "unknown message type" });
    }
  });

  function broadcastToTabs(message) {
    chrome.tabs.query({}, (tabs) => {
      for (const tab of tabs) {
        if (tab.id) {
          chrome.tabs.sendMessage(tab.id, message).catch(() => {});
        }
      }
    });
  }

  // Push profile changes to all tabs
  chrome.storage.onChanged.addListener((changes, area) => {
    if (area === "local" && changes.profile) {
      broadcastToTabs({ type: "APPLY_PROFILE", profile: changes.profile.newValue });
    }
  });
})();
