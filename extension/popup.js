(function () {
  "use strict";

  var storage = chrome.storage.local;
  function $(id) { return document.getElementById(id); }

  function togEl(el, on) { el.classList.toggle("on", on); }

  async function tabMsg(msg) {
    try {
      var tabs = await chrome.tabs.query({ active: true, currentWindow: true });
      if (!tabs[0]) return null;
      return await chrome.tabs.sendMessage(tabs[0].id, msg);
    } catch (e) { return null; }
  }

  async function loadState() {
    var results = await Promise.all([
      storage.get({ enabled: false, profile: { type: "Not assessed", severity: 0, contrast: 50 } }),
      tabMsg({ type: "STATUS" }),
    ]);
    var data = results[0];
    var status = results[1];

    togEl($("tOn"), data.enabled);
    $("pType").textContent = data.profile.type;
    $("pSev").textContent = data.profile.severity > 0 ? data.profile.severity + "%" : "--";
    $("pCon").textContent = (data.profile.contrast || 50) + "%";

    updateStatus(data.enabled);

    if (status && status.game) {
      $("gBanner").classList.add("show");
      $("gName").textContent = status.game;
      $("gGenre").textContent = status.genre || "";
      $("gIcon").textContent = status.game.charAt(0).toUpperCase();
    } else {
      $("gBanner").classList.remove("show");
    }

    var cCount = (status && status.canvases) || 0;
    if (cCount > 0) {
      $("cInfo").classList.add("show");
      $("cCount").textContent = cCount;
    } else {
      $("cInfo").classList.remove("show");
    }

    if (status && status.active) {
      $("mRow").style.display = "grid";
      $("mFps").querySelector(".mv").textContent = status.fps || "--";
      $("mLat").querySelector(".mv").textContent = "--";
      $("mPipe").querySelector(".mv").textContent = status.pipelines || 0;
      $("mFps").className = "metric" + (status.fps >= 55 ? " good" : status.fps >= 30 ? " warn" : "");
    } else {
      $("mRow").style.display = "none";
    }

    if (data.profile && data.profile.type && data.profile.type !== "Not assessed") {
      $("syncMsg").className = "sync-msg ok";
      $("syncMsg").textContent = "Synced: " + data.profile.type;
    }
  }

  function updateStatus(on) {
    $("sDot").className = on ? "dot on" : "dot off";
    $("sText").textContent = on ? "Correcting" : "Not connected";
    $("sSub").textContent = on ? "Color correction active" : "Enable to start correcting";
  }

  $("tOn").addEventListener("click", async function () {
    var d = await storage.get("enabled");
    var next = !d.enabled;
    await storage.set({ enabled: next });
    togEl(this, next);
    updateStatus(next);

    var pd = await storage.get("profile");
    var tabs = await chrome.tabs.query({ active: true, currentWindow: true });
    if (tabs[0]) chrome.tabs.sendMessage(tabs[0].id, { type: "APPLY", enabled: next, profile: next ? pd.profile : null });
    chrome.runtime.sendMessage({ type: "TOGGLE", enabled: next });

    if (next) setTimeout(loadState, 1500);
    else { $("gBanner").classList.remove("show"); $("cInfo").classList.remove("show"); $("mRow").style.display = "none"; }
  });

  function doSync() {
    var email = $("syncEmail").value.trim();
    var pass = $("syncPass").value;
    var msg = $("syncMsg");

    if (!email || !pass) {
      msg.className = "sync-msg err";
      msg.textContent = "Enter email and password";
      return;
    }

    $("bSync").textContent = "Syncing...";
    $("bSync").disabled = true;
    msg.className = "sync-msg info";
    msg.textContent = "Connecting to server...";

    chrome.runtime.sendMessage({ type: "SYNC_REGISTER", email: email, password: pass }, function (result) {
      $("bSync").textContent = "Sync Profile";
      $("bSync").disabled = false;

      if (result && result.ok && result.profile) {
        msg.className = "sync-msg ok";
        msg.textContent = "Synced: " + result.profile.type + " (" + result.profile.severity + "% severity)";
        $("pType").textContent = result.profile.type;
        $("pSev").textContent = result.profile.severity + "%";
        $("pCon").textContent = (result.profile.contrast || 50) + "%";
        storage.set({ enabled: true }, function () {
          togEl($("tOn"), true);
          updateStatus(true);
        });
      } else {
        msg.className = "sync-msg err";
        msg.textContent = result ? (result.error || "Sync failed") : "No response from background";
      }
    });
  }

  $("bSync").addEventListener("click", doSync);
  $("syncPass").addEventListener("keydown", function (e) { if (e.key === "Enter") doSync(); });
  $("syncEmail").addEventListener("keydown", function (e) { if (e.key === "Enter") $("syncPass").focus(); });

  $("bDiag").addEventListener("click", function () {
    var self = this;
    self.textContent = "Running...";
    self.disabled = true;
    $("diagBox").style.display = "block";

    chrome.tabs.query({ active: true, currentWindow: true }, function (tabs) {
      chrome.runtime.sendMessage({ type: "DIAGNOSTICS", tabId: tabs[0] ? tabs[0].id : null }, function (results) {
        $("dBk").innerHTML = results && results.backend && results.backend.ok ? '<span class="d-ok">OK</span>' : '<span class="d-fail">FAIL</span>';
        $("dBkLat").textContent = results && results.backend && results.backend.latencyMs != null ? results.backend.latencyMs + "ms" : "--";
        $("dEx").innerHTML = results && results.extension && results.extension.ok ? '<span class="d-ok">OK</span>' : results && results.extension ? '<span class="d-fail">FAIL</span>' : '<span style="color:#52525b">N/A</span>';
        $("dExLat").textContent = results && results.extension && results.extension.latencyMs != null ? results.extension.latencyMs + "ms" : "--";
        self.textContent = "Re-run Diagnostic";
        self.disabled = false;
      });
    });
  });

  $("bAssess").addEventListener("click", function () { chrome.tabs.create({ url: "https://visionadapt.vercel.app/#assessment" }); window.close(); });
  $("lSite").addEventListener("click", function (e) { e.preventDefault(); chrome.tabs.create({ url: "https://visionadapt.vercel.app/" }); window.close(); });

  loadState();
})();
