(function () {
  "use strict";

  var storage = chrome.storage.local;
  var API_BASE = "https://visionadapt.vercel.app";

  chrome.runtime.onInstalled.addListener(function(d) {
    if (d.reason === "install") {
      storage.set({
        enabled: false,
        overlays: true,
        profile: { type: "Not assessed", severity: 0, contrast: 50, outline: 2, iconPref: "Symbols", pattern: true },
        diagnostics: { lastRun: null, backendOk: false, extOk: false },
        authToken: null,
      });
      setBadge("off");
    }
  });

  function setBadge(state) {
    var text = state === "on" ? "ON" : "";
    var color = state === "on" ? "#22c55e" : state === "error" ? "#ef4444" : state === "live" ? "#3b82f6" : "#52525b";
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

  async function syncProfileFromApi(authToken) {
    if (!authToken) return { error: "No auth token" };
    try {
      var resp = await fetch(API_BASE + "/api/v1/profile", {
        headers: { "Authorization": "Bearer " + authToken }
      });
      if (resp.status === 401) return { error: "Token expired or invalid" };
      var data = await resp.json();
      if (data.status === "ok" && data.profile) {
        var p = data.profile;
        var extProfile = {
          type: p.cvd_type || "Not assessed",
          severity: p.severity || 0,
          contrast: p.contrast || 50,
          outline: p.outline || 2,
          iconPref: p.icon_pref || "Symbols",
          pattern: true,
          modelUsed: p.model_used || false,
          modelConfidence: p.model_confidence,
          modelLatencyMs: p.model_latency_ms,
        };
        await storage.set({ profile: extProfile, authToken: authToken });
        broadcast({ type: "APPLY", profile: extProfile });
        return { ok: true, profile: extProfile };
      }
      return { error: "No profile found on server" };
    } catch (e) {
      return { error: "Network error: " + e.message };
    }
  }

  async function registerAndSync(email, password, displayName) {
    try {
      var regResp = await fetch(API_BASE + "/api/v1/auth/register", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: email, password: password, display_name: displayName || undefined })
      });
      var regData = await regResp.json();
      if (regResp.status === 409) {
        var loginResp = await fetch(API_BASE + "/api/v1/auth/login", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ email: email, password: password })
        });
        var loginData = await loginResp.json();
        if (!loginResp.ok) return { error: loginData.detail || "Login failed" };
        var token = loginData.access_token;
      } else if (regResp.ok && regData.access_token) {
        var token = regData.access_token;
      } else {
        return { error: regData.detail || "Registration failed" };
      }
      return await syncProfileFromApi(token);
    } catch (e) {
      return { error: "Network error: " + e.message };
    }
  }

  async function runDiagnostics(tabId) {
    var results = { backend: null, extension: null, timestamp: Date.now() };

    try {
      var t0 = performance.now();
      var resp = await fetch(API_BASE + "/api/v1/health");
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

      case "SYNC_PROFILE":
        syncProfileFromApi(msg.authToken).then(function(r) { sendResponse(r); });
        return true;

      case "SYNC_REGISTER":
        registerAndSync(msg.email, msg.password, msg.displayName).then(function(r) { sendResponse(r); });
        return true;

      case "SET_AUTH_TOKEN":
        storage.set({ authToken: msg.authToken }, function() {
          syncProfileFromApi(msg.authToken).then(function(r) { sendResponse(r); });
        });
        return true;

      case "STATUS":
        storage.get(["enabled", "profile", "detectedGame", "detectedGenre", "lastMetrics", "diagnostics", "authToken"], function(d) {
          sendResponse(d || {});
        });
        return true;

      case "SYNC_CREDENTIALS":
        if (msg.email && msg.password) {
          registerAndSync(msg.email, msg.password, msg.displayName).then(function(r) {
            if (r.error) { sendResponse({ ok: false, error: r.error }); }
            else { sendResponse({ ok: true, profile: r.profile }); }
          });
        } else {
          sendResponse({ ok: false, error: "Missing email or password" });
        }
        return true;

      case "CHECK_STATUS":
        storage.get(["enabled", "profile", "authToken"], function(d) {
          var isAuthed = !!(d && d.authToken);
          var profileType = d && d.profile ? d.profile.type : "Not assessed";
          sendResponse({ ok: true, enabled: d && d.enabled, authenticated: isAuthed, profileType: profileType });
        });
        return true;

      case "WEBSITE_SYNC":
        if (msg.profile) {
          storage.set({ profile: msg.profile, enabled: true }, function() {
            setBadge("on");
            broadcast({ type: "APPLY", profile: msg.profile });
            sendResponse({ ok: true });
          });
          return true;
        }
        sendResponse({ ok: false });
        break;

      default:
        sendResponse({ error: "unknown message type" });
    }
  });

  storage.onChanged.addListener(function(changes, area) {
    if (area === "local" && changes.profile) {
      broadcast({ type: "APPLY", profile: changes.profile.newValue });
    }
  });
})();
