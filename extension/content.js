(function () {
  "use strict";
  if (window.__va) return;
  window.__va = true;

  const storage = chrome.storage?.local;

  const MAT = {
    protan: new Float32Array([
      1.20,-.10,.00,0, -.10,1.15,.00,0, .00,.15,1.05,0, 0,0,0,1
    ]),
    deutan: new Float32Array([
      1.15,-.05,.00,0, -.05,1.20,.00,0, .00,.10,1.10,0, 0,0,0,1
    ]),
    tritan: new Float32Array([
      1.05,.00,-.10,0, .00,1.05,.05,0, -.08,.05,1.15,0, 0,0,0,1
    ]),
  };

  const TYPE_KEY = {
    Protanomaly:"protan", Protanopia:"protan",
    Deuteranomaly:"deutan", Deuteranopia:"deutan",
    Tritanomaly:"tritan", Tritanopia:"tritan",
  };

  let profile = null;
  let enabled = false;
  let matrix = null;
  const activeCanvases = new Map();
  let currentFps = 0;
  let frameCount = 0;
  let lastFpsTime = 0;
  let scanInterval = null;

  function injectMainWorld() {
    if (document.getElementById("va-inject")) return;
    const script = document.createElement("script");
    script.id = "va-inject";
    script.textContent = `(function(){
      if(window.__vaMain) return;
      window.__vaMain = true;
      window.__vaCanvases = [];
      var orig = HTMLCanvasElement.prototype.getContext;
      HTMLCanvasElement.prototype.getContext = function(type, attrs) {
        var ctx = orig.call(this, type, attrs);
        if(type==="2d"||type==="webgl"||type==="webgl2") {
          window.__vaCanvases.push({canvas:this, type:type, ts:Date.now()});
          window.dispatchEvent(new CustomEvent("va:canvas",{detail:{canvas:this,type:type}}));
        }
        return ctx;
      };
    })();`;
    (document.head || document.documentElement).appendChild(script);
    script.remove();
  }

  let cssEl = null;

  function injectFilters() {
    if (document.getElementById("va-filters")) return;
    const svg = document.createElementNS("http://www.w3.org/2000/svg", "svg");
    svg.id = "va-filters";
    svg.setAttribute("width","0"); svg.setAttribute("height","0");
    svg.style.position = "absolute";
    svg.innerHTML = '<defs>' +
      '<filter id="va-f-protan"><feColorMatrix type="matrix" values="1.20 -.10 .00 0 0 -.10 1.15 .00 0 0 .00 .15 1.05 0 0 0 0 0 1 0"/></filter>' +
      '<filter id="va-f-deutan"><feColorMatrix type="matrix" values="1.15 -.05 .00 0 0 -.05 1.20 .00 0 0 .00 .10 1.10 0 0 0 0 0 1 0"/></filter>' +
      '<filter id="va-f-tritan"><feColorMatrix type="matrix" values="1.05 .00 -.10 0 0 .00 1.05 .05 0 0 -.08 .05 1.15 0 0 0 0 0 1 0"/></filter>' +
      '</defs>';
    document.documentElement.appendChild(svg);
  }

  function applyDOM(p) {
    const key = TYPE_KEY[p.type];
    if (!key) { removeDOM(); return; }
    injectFilters();
    if (!cssEl) { cssEl = document.createElement("style"); cssEl.id = "va-css"; (document.head||document.documentElement).appendChild(cssEl); }
    const c = 50 + (p.contrast - 50) * 0.6;
    cssEl.textContent = 'html.va-on{filter:url(#va-f-' + key + ') contrast(' + c + '%)!important;transition:filter .3s} html.va-on img,html.va-on video{filter:url(#va-f-' + key + ')!important}';
    document.documentElement.classList.add("va-on");
  }

  function removeDOM() {
    if (cssEl) cssEl.textContent = "";
    document.documentElement.classList.remove("va-on");
  }

  const VS = "attribute vec2 a_p;attribute vec2 a_t;varying vec2 v_t;void main(){gl_Position=vec4(a_p,0,1);v_t=a_t;}";
  const FS = "precision mediump float;varying vec2 v_t;uniform sampler2D u_tex;uniform mat4 u_mat;uniform float u_sev;uniform float u_con;void main(){vec4 c=texture2D(u_tex,v_t);vec4 r=u_mat*c;c=mix(c,r,u_sev);float f=(100.0+u_con)/100.0;c.rgb=(c.rgb-0.5)*f+0.5;c.rgb=clamp(c.rgb,0.0,1.0);gl_FragColor=c;}";

  function mkShader(gl, type, src) {
    var s = gl.createShader(type);
    gl.shaderSource(s, src);
    gl.compileShader(s);
    if (!gl.getShaderParameter(s, gl.COMPILE_STATUS)) { gl.deleteShader(s); return null; }
    return s;
  }

  function mkProgram(gl) {
    var vs = mkShader(gl, gl.VERTEX_SHADER, VS);
    var fs = mkShader(gl, gl.FRAGMENT_SHADER, FS);
    if (!vs || !fs) return null;
    var pg = gl.createProgram();
    gl.attachShader(pg, vs); gl.attachShader(pg, fs); gl.linkProgram(pg);
    if (!gl.getProgramParameter(pg, gl.LINK_STATUS)) return null;
    gl.useProgram(pg);

    var pb = gl.createBuffer();
    gl.bindBuffer(gl.ARRAY_BUFFER, pb);
    gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-1,-1,1,-1,-1,1,-1,1,1,-1,1,1]), gl.STATIC_DRAW);
    var pl = gl.getAttribLocation(pg, "a_p");
    gl.enableVertexAttribArray(pl); gl.vertexAttribPointer(pl, 2, gl.FLOAT, false, 0, 0);

    var tb = gl.createBuffer();
    gl.bindBuffer(gl.ARRAY_BUFFER, tb);
    gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([0,1,1,1,0,0,0,0,1,1,1,0]), gl.STATIC_DRAW);
    var tl = gl.getAttribLocation(pg, "a_t");
    gl.enableVertexAttribArray(tl); gl.vertexAttribPointer(tl, 2, gl.FLOAT, false, 0, 0);

    var tex = gl.createTexture();
    gl.bindTexture(gl.TEXTURE_2D, tex);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);

    return {
      pg: pg, tex: tex, gl: gl,
      uMat: gl.getUniformLocation(pg, "u_mat"),
      uSev: gl.getUniformLocation(pg, "u_sev"),
      uCon: gl.getUniformLocation(pg, "u_con"),
    };
  }

  function startPipeline(srcCanvas) {
    if (activeCanvases.has(srcCanvas)) return;
    var w = srcCanvas.width || srcCanvas.offsetWidth;
    var h = srcCanvas.height || srcCanvas.offsetHeight;
    if (w < 200 || h < 150) return;

    var off = document.createElement("canvas");
    off.width = w; off.height = h;
    off.style.cssText = "position:absolute;top:0;left:0;width:100%;height:100%;pointer-events:none;z-index:999998;";
    var gl = off.getContext("webgl2") || off.getContext("webgl");
    if (!gl) return;

    var prog = mkProgram(gl);
    if (!prog) return;

    var par = srcCanvas.parentElement || document.body;
    par.style.position = par.style.position || "relative";
    par.insertBefore(off, srcCanvas.nextSibling);

    var running = true;
    var raf = null;

    function frame() {
      if (!running || !enabled) { raf = null; return; }
      if (off.width !== srcCanvas.width || off.height !== srcCanvas.height) {
        off.width = srcCanvas.width; off.height = srcCanvas.height;
        gl.viewport(0, 0, off.width, off.height);
      }
      gl.bindTexture(gl.TEXTURE_2D, prog.tex);
      gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, srcCanvas);
      gl.uniformMatrix4fv(prog.uMat, false, matrix);
      gl.uniform1f(prog.uSev, profile ? profile.severity / 100 : 0.5);
      gl.uniform1f(prog.uCon, profile ? profile.contrast : 50);
      gl.drawArrays(gl.TRIANGLES, 0, 6);

      frameCount++;
      var now = performance.now();
      if (now - lastFpsTime >= 1000) {
        currentFps = Math.round(frameCount * 1000 / (now - lastFpsTime));
        frameCount = 0; lastFpsTime = now;
        reportMetrics();
      }
      raf = requestAnimationFrame(frame);
    }

    lastFpsTime = performance.now();
    frameCount = 0;
    raf = requestAnimationFrame(frame);

    activeCanvases.set(srcCanvas, {
      cleanup: function() {
        running = false;
        if (raf) cancelAnimationFrame(raf);
        if (off.parentElement) off.parentElement.removeChild(off);
      }
    });
  }

  function stopAllPipelines() {
    activeCanvases.forEach(function(entry) { entry.cleanup(); });
    activeCanvases.clear();
  }

  window.addEventListener("va:canvas", function(e) {
    if (!enabled || !matrix) return;
    var canvas = e.detail.canvas;
    if (!activeCanvases.has(canvas)) {
      setTimeout(function() { startPipeline(canvas); }, 600);
    }
  });

  function scanCanvases() {
    if (!enabled || !matrix) return;
    document.querySelectorAll("canvas").forEach(function(c) {
      if (!activeCanvases.has(c) && c.parentElement) {
        var w = c.width || c.offsetWidth;
        var h = c.height || c.offsetHeight;
        if (w >= 200 && h >= 150) startPipeline(c);
      }
    });
  }

  var GAMES = [
    {p:["krunker.io"],n:"Krunker.io",g:"FPS"},
    {p:["shellshock.io"],n:"Shell Shockers",g:"FPS"},
    {p:["1v1.lol"],n:"1v1.LOL",g:"Shooter"},
    {p:["zombsroyale.io"],n:"Zombs Royale",g:"Battle Royale"},
    {p:["surviv.io"],n:"Surviv.io",g:"Battle Royale"},
    {p:["slither.io"],n:"Slither.io",g:"Arcade"},
    {p:["agar.io"],n:"Agar.io",g:"Arcade"},
    {p:["diep.io"],n:"Diep.io",g:"Tank Shooter"},
    {p:["slope"],n:"Slope",g:"Runner"},
    {p:["paper-io"],n:"Paper.io",g:"Arcade"},
    {p:["tetris"],n:"TETRIS",g:"Puzzle"},
    {p:["chess.com","lichess"],n:"Chess",g:"Strategy"},
    {p:["roblox.com"],n:"Roblox",g:"Platform"},
    {p:["poki.com"],n:"Poki Games",g:"Various"},
    {p:["crazygames.com"],n:"CrazyGames",g:"Various"},
    {p:["miniclip.com"],n:"Miniclip",g:"Various"},
    {p:["y8.com"],n:"Y8 Games",g:"Various"},
    {p:["kongregate.com"],n:"Kongregate",g:"Various"},
    {p:["newgrounds.com"],n:"Newgrounds",g:"Various"},
    {p:["now.gg"],n:"now.gg Cloud",g:"Cloud Gaming"},
    {p:["geforce.now"],n:"GeForce NOW",g:"Cloud Gaming"},
    {p:["xbox.com/play"],n:"Xbox Cloud",g:"Cloud Gaming"},
    {p:["steam"],n:"Steam Browser",g:"Platform"},
  ];

  function detectGame() {
    var host = location.hostname.toLowerCase();
    for (var i = 0; i < GAMES.length; i++) {
      var g = GAMES[i];
      for (var j = 0; j < g.p.length; j++) {
        if (host.indexOf(g.p[j]) !== -1) return g;
      }
    }
    var cs = document.querySelectorAll("canvas");
    for (var k = 0; k < cs.length; k++) {
      var cw = cs[k].width || cs[k].offsetWidth;
      var ch = cs[k].height || cs[k].offsetHeight;
      if (cw > 400 && ch > 300) return { n: "Canvas Game", g: "WebGL/2D", p: [] };
    }
    return null;
  }

  function reportMetrics() {
    try {
      chrome.runtime.sendMessage({
        type: "METRICS",
        fps: currentFps,
        canvases: activeCanvases.size,
        game: detectGame(),
      });
    } catch(e) {}
  }

  function apply(p) {
    if (!p || p.type === "Not assessed") { disable(); return; }
    var key = TYPE_KEY[p.type];
    if (!key) return;
    profile = p; enabled = true; matrix = MAT[key];
    applyDOM(p);
    injectMainWorld();
    if (scanInterval) clearInterval(scanInterval);
    setTimeout(scanCanvases, 500);
    scanInterval = setInterval(scanCanvases, 3000);
    var game = detectGame();
    try { chrome.runtime.sendMessage({ type: "GAME_DETECTED", game: game ? game.n : null, genre: game ? game.g : null }); } catch(e) {}
  }

  function disable() {
    enabled = false; removeDOM();
    if (scanInterval) { clearInterval(scanInterval); scanInterval = null; }
    stopAllPipelines();
    try { chrome.runtime.sendMessage({ type: "GAME_DETECTED", game: null, genre: null }); } catch(e) {}
  }

  chrome.runtime.onMessage.addListener(function(msg, _s, send) {
    switch (msg.type) {
      case "APPLY":
        if (msg.enabled === false) disable();
        else if (msg.profile) apply(msg.profile);
        else if (msg.enabled && profile) apply(profile);
        send({ ok: true }); break;
      case "TOGGLE_OVERLAYS": send({ ok: true }); break;
      case "STATUS":
        var g = detectGame();
        send({ active: enabled, profile: profile, game: g ? g.n : null, genre: g ? g.g : null,
          canvases: document.querySelectorAll("canvas").length, pipelines: activeCanvases.size, fps: currentFps });
        return true;
      case "PING": send({ pong: true, ts: Date.now() }); return true;
    }
  });

  if (storage) {
    storage.get(["enabled", "profile"], function(d) {
      if (d && d.enabled && d.profile && d.profile.type !== "Not assessed") {
        apply(d.profile);
      }
    });
  }

  var lastUrl = location.href;
  new MutationObserver(function() {
    if (location.href !== lastUrl) {
      lastUrl = location.href;
      if (enabled && profile) setTimeout(function() { scanCanvases(); }, 1500);
    }
  }).observe(document, { subtree: true, childList: true });

  if (location.hostname.indexOf("visionadapt.vercel.app") !== -1 || location.hostname === "localhost") {
    window.addEventListener("message", function(e) {
      if (e.data && e.data.type === "VA_SYNC_PROFILE" && e.data.profile) {
        chrome.runtime.sendMessage({ type: "WEBSITE_SYNC", profile: e.data.profile }, function(r) {
          window.postMessage({ type: "VA_SYNC_RESULT", result: r }, "*");
        });
      }
      if (e.data && e.data.type === "VA_SAVE_PROFILE" && e.data.profile) {
        chrome.runtime.sendMessage({ type: "SAVE_PROFILE_DIRECT", profile: e.data.profile }, function(r) {
          window.postMessage({ type: "VA_SAVE_RESULT", result: r }, "*");
        });
      }
    });
    window.postMessage({ type: "VA_EXTENSION_READY" }, "*");
  }
})();
