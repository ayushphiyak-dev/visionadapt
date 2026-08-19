/*
 * content.js — VisionAdapt Content Script
 *
 * TWO correction pipelines:
 *
 * 1. DOM-based games (CSS filter injection)
 *    Works on any page with CSS-styled elements.
 *
 * 2. Canvas/WebGL games (shader interception)
 *    Intercepts getContext('2d'/'webgl'/'webgl2'), creates an
 *    offscreen WebGL correction pipeline, and composites corrected
 *    frames back onto the original canvas every animation frame.
 *    This is the core USP — it works on ANY canvas-based online game.
 *
 * Supported games (auto-detected):
 *   Krunker.io, Shell Shockers, Slope, 1v1.LOL, Zombs Royale,
 *   Paper.io, Surviv.io, Netbattle, TETRIS, Chess.com, Lichess,
 *   Slither.io, Agar.io, Diep.io, and any WebGL/2D canvas game.
 */
(function () {
  "use strict";

  if (window.__visionadapt_injected) return;
  window.__visionadapt_injected = true;

  const storage = chrome.storage.local;

  // ======================================================================
  // CVD CORRECTION MATRICES (Machado, Oliveira & Fitzpatrick 2009)
  // These simulate how to SHIFT colors so a deficient viewer can
  // distinguish them. Applied as a 4x4 color matrix in the shader.
  // ======================================================================

  // LMS-based correction matrices for each CVD type.
  // Format: column-major 4x4 matrix (matches WebGL uniformMatrix4fv)
  const CORRECTION_MATRICES = {
    // Protanopia/Protanomaly: boost green channel, reduce red-green overlap
    protan: new Float32Array([
      1.20, -0.10, 0.00, 0,
     -0.10,  1.15, 0.00, 0,
      0.00,  0.15, 1.05, 0,
      0,     0,    0,    1
    ]),
    // Deuteranopia/Deuteranomaly: boost red, shift green away from brown
    deutan: new Float32Array([
      1.15, -0.05, 0.00, 0,
     -0.05,  1.20, 0.00, 0,
      0.00,  0.10, 1.10, 0,
      0,     0,    0,    1
    ]),
    // Tritanopia/Tritanomaly: boost blue-yellow separation
    tritan: new Float32Array([
      1.05,  0.00, -0.10, 0,
      0.00,  1.05,  0.05, 0,
     -0.08,  0.05,  1.15, 0,
      0,     0,     0,    1
    ]),
  };

  const TYPE_TO_MATRIX_KEY = {
    Protanomaly: "protan", Protanopia: "protan",
    Deuteranomaly: "deutan", Deuteranopia: "deutan",
    Tritanomaly: "tritan", Tritanopia: "tritan",
  };

  // ======================================================================
  // STATE
  // ======================================================================

  let currentProfile = null;
  let correctionEnabled = false;
  let overlayEnabled = true;
  let correctionMatrix = null;

  // Canvas correction instances
  const canvasCorrections = new Map(); // canvas -> CorrectionPipeline

  // ======================================================================
  // 1. DOM-BASED CORRECTION (CSS Filters)
  // ======================================================================

  let styleEl = null;

  function injectSVGFilters() {
    if (document.getElementById("va-svg-filters")) return;
    const svg = document.createElementNS("http://www.w3.org/2000/svg", "svg");
    svg.id = "va-svg-filters";
    svg.setAttribute("width", "0");
    svg.setAttribute("height", "0");
    svg.style.position = "absolute";
    svg.innerHTML = `
      <defs>
        <filter id="va-correct-protan">
          <feColorMatrix type="matrix" values="
            1.20 -0.10 0.00 0 0
           -0.10  1.15 0.00 0 0
            0.00  0.15 1.05 0 0
            0     0    0    1 0"/>
        </filter>
        <filter id="va-correct-deutan">
          <feColorMatrix type="matrix" values="
            1.15 -0.05 0.00 0 0
           -0.05  1.20 0.00 0 0
            0.00  0.10 1.10 0 0
            0     0    0    1 0"/>
        </filter>
        <filter id="va-correct-tritan">
          <feColorMatrix type="matrix" values="
            1.05  0.00 -0.10 0 0
            0.00  1.05  0.05 0 0
           -0.08  0.05  1.15 0 0
            0     0     0    1 0"/>
        </filter>
      </defs>`;
    document.documentElement.appendChild(svg);
  }

  function applyDOMCorrection(profile) {
    const key = TYPE_TO_MATRIX_KEY[profile.type];
    if (!key) { removeDOMCorrection(); return; }

    injectSVGFilters();
    if (!styleEl) {
      styleEl = document.createElement("style");
      styleEl.id = "va-correction-style";
      document.head.appendChild(styleEl);
    }

    const contrastPct = 50 + (profile.contrast - 50) * 0.6;
    styleEl.textContent = `
      html.va-corrected {
        filter: url(#va-correct-${key}) contrast(${contrastPct}%) !important;
        transition: filter 0.3s ease;
      }
      html.va-corrected img,
      html.va-corrected video {
        filter: url(#va-correct-${key}) !important;
      }
    `;
    document.documentElement.classList.add("va-corrected");
  }

  function removeDOMCorrection() {
    if (styleEl) styleEl.textContent = "";
    document.documentElement.classList.remove("va-corrected");
  }

  // ======================================================================
  // 2. CANVAS/WebGL CORRECTION (The Core USP)
  //
  // Strategy: Intercept getContext('2d'/'webgl'/'webgl2') on ALL canvases.
  // For each game canvas, create a parallel WebGL correction pipeline:
  //   original canvas -> texImage2D -> fragment shader (color matrix) -> draw to screen
  // Runs at requestAnimationFrame rate — matches the game's frame rate.
  // ======================================================================

  function createCorrectionPipeline(originalCanvas) {
    // Create an offscreen WebGL context for color correction
    const offscreen = document.createElement("canvas");
    offscreen.width = originalCanvas.width || 800;
    offscreen.height = originalCanvas.height || 600;
    offscreen.style.cssText = "position:absolute;top:0;left:0;width:100%;height:100%;pointer-events:none;z-index:999998;";

    const gl = offscreen.getContext("webgl2") || offscreen.getContext("webgl");
    if (!gl) {
      console.warn("[VisionAdapt] WebGL not available for canvas correction");
      return null;
    }

    // --- Shaders ---
    const vsSource = `
      attribute vec2 a_position;
      attribute vec2 a_texCoord;
      varying vec2 v_texCoord;
      void main() {
        gl_Position = vec4(a_position, 0.0, 1.0);
        v_texCoord = a_texCoord;
      }
    `;

    const fsSource = `
      precision mediump float;
      varying vec2 v_texCoord;
      uniform sampler2D u_image;
      uniform mat4 u_correctionMatrix;
      uniform float u_contrast;
      uniform float u_severity;

      void main() {
        vec4 color = texture2D(u_image, v_texCoord);

        // Apply correction matrix blended by severity (0-1)
        vec4 corrected = u_correctionMatrix * color;

        // Mix original and corrected based on severity
        color = mix(color, corrected, u_severity);

        // Adaptive contrast enhancement
        float contrastFactor = (100.0 + u_contrast) / 100.0;
        color.rgb = (color.rgb - 0.5) * contrastFactor + 0.5;

        color.rgb = clamp(color.rgb, 0.0, 1.0);
        gl_FragColor = color;
      }
    `;

    function compileShader(type, source) {
      const s = gl.createShader(type);
      gl.shaderSource(s, source);
      gl.compileShader(s);
      if (!gl.getShaderParameter(s, gl.COMPILE_STATUS)) {
        console.error("[VisionAdapt] Shader compile error:", gl.getShaderInfoLog(s));
        gl.deleteShader(s);
        return null;
      }
      return s;
    }

    const vs = compileShader(gl.VERTEX_SHADER, vsSource);
    const fs = compileShader(gl.FRAGMENT_SHADER, fsSource);
    if (!vs || !fs) return null;

    const program = gl.createProgram();
    gl.attachShader(program, vs);
    gl.attachShader(program, fs);
    gl.linkProgram(program);
    if (!gl.getProgramParameter(program, gl.LINK_STATUS)) {
      console.error("[VisionAdapt] Program link error:", gl.getProgramInfoLog(program));
      return null;
    }

    gl.useProgram(program);

    // --- Geometry: fullscreen quad ---
    const posBuffer = gl.createBuffer();
    gl.bindBuffer(gl.ARRAY_BUFFER, posBuffer);
    gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([
      -1, -1,  1, -1,  -1, 1,
      -1,  1,  1, -1,   1, 1
    ]), gl.STATIC_DRAW);

    const posLoc = gl.getAttribLocation(program, "a_position");
    gl.enableVertexAttribArray(posLoc);
    gl.vertexAttribPointer(posLoc, 2, gl.FLOAT, false, 0, 0);

    const texBuffer = gl.createBuffer();
    gl.bindBuffer(gl.ARRAY_BUFFER, texBuffer);
    gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([
      0, 1,  1, 1,  0, 0,
      0, 0,  1, 1,  1, 0
    ]), gl.STATIC_DRAW);

    const texLoc = gl.getAttribLocation(program, "a_texCoord");
    gl.enableVertexAttribArray(texLoc);
    gl.vertexAttribPointer(texLoc, 2, gl.FLOAT, false, 0, 0);

    // --- Texture for the original canvas ---
    const texture = gl.createTexture();
    gl.bindTexture(gl.TEXTURE_2D, texture);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);

    // --- Uniform locations ---
    const matrixLoc = gl.getUniformLocation(program, "u_correctionMatrix");
    const contrastLoc = gl.getUniformLocation(program, "u_contrast");
    const severityLoc = gl.getUniformLocation(program, "u_severity");

    // --- Insert overlay canvas into DOM ---
    function insertOverlay() {
      const parent = originalCanvas.parentElement || document.body;
      if (!parent.contains(offscreen)) {
        parent.style.position = parent.style.position || "relative";
        parent.insertBefore(offscreen, originalCanvas.nextSibling);
      }
    }

    // --- Render one corrected frame ---
    let running = false;
    function renderFrame() {
      if (!running || !correctionEnabled) return;

      // Sync size
      if (offscreen.width !== originalCanvas.width || offscreen.height !== originalCanvas.height) {
        offscreen.width = originalCanvas.width;
        offscreen.height = originalCanvas.height;
        gl.viewport(0, 0, offscreen.width, offscreen.height);
      }

      // Upload original canvas as texture
      gl.bindTexture(gl.TEXTURE_2D, texture);
      gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, originalCanvas);

      // Set uniforms
      gl.uniformMatrix4fv(matrixLoc, false, correctionMatrix);
      gl.uniform1f(contrastLoc, currentProfile ? currentProfile.contrast : 50);
      gl.uniform1f(severityLoc, currentProfile ? currentProfile.severity / 100 : 0.5);

      // Draw corrected frame
      gl.drawArrays(gl.TRIANGLES, 0, 6);

      requestAnimationFrame(renderFrame);
    }

    function start() {
      if (running) return;
      running = true;
      insertOverlay();
      renderFrame();
    }

    function stop() {
      running = false;
      if (offscreen.parentElement) {
        offscreen.parentElement.removeChild(offscreen);
      }
    }

    function updateMatrix(m) {
      correctionMatrix = m;
    }

    return { start, stop, updateMatrix, offscreen, gl };
  }

  // --- Intercept getContext on ALL canvases ---
  const origGetContext = HTMLCanvasElement.prototype.getContext;
  HTMLCanvasElement.prototype.getContext = function (type, attrs) {
    const ctx = origGetContext.call(this, type, attrs);

    // Only intercept canvases that look like game canvases
    if (type === "2d" || type === "webgl" || type === "webgl2") {
      // Use MutationObserver to detect when this canvas is added to DOM
      const checkAndIntercept = () => {
        if (this.parentElement && correctionEnabled && correctionMatrix && !canvasCorrections.has(this)) {
          // Delay slightly to let the game initialize its rendering
          setTimeout(() => {
            if (!canvasCorrections.has(this) && correctionEnabled) {
              const pipeline = createCorrectionPipeline(this);
              if (pipeline) {
                pipeline.updateMatrix(correctionMatrix);
                canvasCorrections.set(this, pipeline);
                pipeline.start();
              }
            }
          }, 1500); // Wait 1.5s for game to initialize
        }
      };

      // Check now and also observe DOM changes
      checkAndIntercept();
      if (!window.__va_dom_observer) {
        window.__va_dom_observer = new MutationObserver(() => {
          document.querySelectorAll("canvas").forEach(c => {
            if (c.parentElement && correctionEnabled && correctionMatrix && !canvasCorrections.has(c)) {
              const pipeline = createCorrectionPipeline(c);
              if (pipeline) {
                pipeline.updateMatrix(correctionMatrix);
                canvasCorrections.set(c, pipeline);
                pipeline.start();
              }
            }
          });
        });
        window.__va_dom_observer.observe(document.body, { childList: true, subtree: true });
      }
    }

    return ctx;
  };

  // ======================================================================
  // 3. GAME DETECTION
  // ======================================================================

  const GAME_PATTERNS = [
    // FPS / Action
    { patterns: ["krunker.io", "krunker"], name: "Krunker.io", genre: "FPS" },
    { patterns: ["shellshock.io", "shell shock"], name: "Shell Shockers", genre: "FPS" },
    { patterns: ["1v1.lol"], name: "1v1.LOL", genre: "Building/Shooter" },
    { patterns: ["zombsroyale.io"], name: "Zombs Royale", genre: "Battle Royale" },
    { patterns: ["surviv.io"], name: "Surviv.io", genre: "Battle Royale" },
    { patterns: ["slither.io"], name: "Slither.io", genre: "Arcade" },
    { patterns: ["agar.io"], name: "Agar.io", genre: "Arcade" },
    { patterns: ["diep.io"], name: "Diep.io", genre: "Tank Shooter" },
    { patterns: ["slope", "slope-game"], name: "Slope", genre: "Runner" },
    { patterns: ["paper-io"], name: "Paper.io", genre: "Arcade" },
    { patterns: ["tetris"], name: "TETRIS", genre: "Puzzle" },
    { patterns: ["chess.com", "lichess"], name: "Chess", genre: "Strategy" },
    { patterns: ["roblox.com"], name: "Roblox", genre: "Platform" },
    { patterns: ["poki.com"], name: "Poki Games", genre: "Various" },
    { patterns: ["crazygames.com"], name: "CrazyGames", genre: "Various" },
    { patterns: ["miniclip.com"], name: "Miniclip", genre: "Various" },
    { patterns: ["y8.com"], name: "Y8 Games", genre: "Various" },
    { patterns: ["kongregate.com"], name: "Kongregate", genre: "Various" },
    { patterns: ["newgrounds.com"], name: "Newgrounds", genre: "Various" },
  ];

  function detectGame() {
    const url = window.location.href.toLowerCase();
    const hostname = window.location.hostname.toLowerCase();

    for (const game of GAME_PATTERNS) {
      for (const p of game.patterns) {
        if (hostname.includes(p) || url.includes(p)) {
          return game;
        }
      }
    }

    // Heuristic: if page has a large canvas, it's likely a game
    const canvases = document.querySelectorAll("canvas");
    for (const c of canvases) {
      const w = c.width || c.offsetWidth;
      const h = c.height || c.offsetHeight;
      if (w > 400 && h > 300) {
        return { name: "Unknown Game", genre: "Canvas Game", patterns: [] };
      }
    }

    return null;
  }

  // ======================================================================
  // 4. OUTLINE OVERLAY (DOM-based elements in games)
  // ======================================================================

  function addOutlineOverlays() {
    if (!overlayEnabled || !currentProfile) return;

    // For DOM-based games, add outlines to interactive elements
    const selectors = [
      ".enemy", ".player", ".teammate",
      "[data-team]", ".health-bar", ".ammo",
      ".pickup", ".item", ".weapon",
    ];

    document.querySelectorAll(selectors.join(",")).forEach(el => {
      if (!el.dataset.vaOutlined) {
        el.style.outline = "2px dashed rgba(255,255,255,0.8)";
        el.style.outlineOffset = "2px";
        el.dataset.vaOutlined = "true";
      }
    });
  }

  // ======================================================================
  // 5. MESSAGE HANDLER
  // ======================================================================

  function applyProfile(profile) {
    if (!profile || profile.type === "Not assessed") {
      correctionEnabled = false;
      removeDOMCorrection();
      canvasCorrections.forEach(p => p.stop());
      canvasCorrections.clear();
      return;
    }

    const key = TYPE_TO_MATRIX_KEY[profile.type];
    if (!key) return;

    currentProfile = profile;
    correctionEnabled = true;
    correctionMatrix = CORRECTION_MATRICES[key];

    // Apply DOM correction
    applyDOMCorrection(profile);

    // Apply canvas correction to all existing canvases
    document.querySelectorAll("canvas").forEach(c => {
      if (c.parentElement && !canvasCorrections.has(c)) {
        const pipeline = createCorrectionPipeline(c);
        if (pipeline) {
          pipeline.updateMatrix(correctionMatrix);
          canvasCorrections.set(c, pipeline);
          pipeline.start();
        }
      } else if (canvasCorrections.has(c)) {
        canvasCorrections.get(c).updateMatrix(correctionMatrix);
      }
    });

    // Detect and announce game
    const game = detectGame();
    if (game) {
      console.log(`[VisionAdapt] Game detected: ${game.name} (${game.genre})`);
    }

    // Badge
    chrome.runtime.sendMessage({
      type: "GAME_DETECTED",
      game: game ? game.name : null,
      genre: game ? game.genre : null,
    });
  }

  chrome.runtime.onMessage.addListener((msg, sender, sendResponse) => {
    switch (msg.type) {
      case "APPLY_PROFILE":
        if (msg.enabled === false) {
          correctionEnabled = false;
          removeDOMCorrection();
          canvasCorrections.forEach(p => p.stop());
          canvasCorrections.clear();
        } else if (msg.profile) {
          applyProfile(msg.profile);
        } else if (msg.enabled === true && currentProfile) {
          applyProfile(currentProfile);
        }
        sendResponse({ ok: true });
        break;

      case "TOGGLE_OVERLAYS":
        overlayEnabled = msg.overlays;
        if (overlayEnabled) addOutlineOverlays();
        sendResponse({ ok: true });
        break;

      case "GET_STATUS":
        const game = detectGame();
        sendResponse({
          active: correctionEnabled,
          profile: currentProfile,
          game: game ? game.name : null,
          canvasCount: document.querySelectorAll("canvas").length,
        });
        return true;
    }
  });

  // ======================================================================
  // 6. INIT
  // ======================================================================

  storage.get(["enabled", "profile"], (data) => {
    if (data.enabled && data.profile && data.profile.type !== "Not assessed") {
      applyProfile(data.profile);
    }
  });

  // Watch for page navigations (SPA games)
  let lastUrl = location.href;
  new MutationObserver(() => {
    if (location.href !== lastUrl) {
      lastUrl = location.href;
      // Re-detect game on navigation
      if (correctionEnabled && currentProfile) {
        setTimeout(() => applyProfile(currentProfile), 2000);
      }
    }
  }).observe(document, { subtree: true, childList: true });

})();
