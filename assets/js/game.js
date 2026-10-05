/* Dev Run: a small action platformer in the spirit of Hollow Knight.

   Art: sprite sheets in assets/sprites (generated with ChatGPT, packed with JSON frame maps).
   The world renders to a 480 px tall canvas scaled up with smoothing off; lights and HUD go on top.
   Physics runs at a fixed 120 Hz.

   Zones: 1 Bug Hunt -> 2 The Inbox -> 3 Server Room -> boss: Corrupted Coder.
   Abilities: Code Slash, wall jump (from the start), double jump, Debug Pulse (zone 1),
   Firewall (zone 2), Laptop Slam and Cache Dash (zone 3), Focus heal. */
(function () {
  "use strict";

  var T = 32, VH = 416, STEP = 1 / 120;

  /* ======================================================================= ASSETS */

  var A = {}, IMG = {}, TILES = null, ready = false, loading = null;

  function loadImage(src) {
    return new Promise(function (res, rej) { var i = new Image(); i.onload = function () { res(i); }; i.onerror = rej; i.src = src; });
  }
  function loadJSON(src) { return fetch(src).then(function (r) { if (!r.ok) throw new Error(src); return r.json(); }); }

  // Remove tiny detached pixel clusters (generator leftovers) from a frame.
  function cleanFrame(cx, w, h) {
    var img = cx.getImageData(0, 0, w, h), d = img.data, seen = new Uint8Array(w * h), comps = [];
    for (var i = 0; i < w * h; i++) {
      if (seen[i] || d[i * 4 + 3] === 0) continue;
      var stack = [i], pix = []; seen[i] = 1;
      while (stack.length) {
        var k = stack.pop(); pix.push(k);
        var x = k % w, y = (k / w) | 0;
        for (var dy = -1; dy <= 1; dy++) for (var dx = -1; dx <= 1; dx++) {
          var nx = x + dx, ny = y + dy;
          if (nx < 0 || ny < 0 || nx >= w || ny >= h) continue;
          var n = ny * w + nx;
          if (!seen[n] && d[n * 4 + 3] > 0) { seen[n] = 1; stack.push(n); }
        }
      }
      comps.push(pix);
    }
    comps.sort(function (a, b) { return b.length - a.length; });
    for (var c = 1; c < comps.length; c++) if (comps[c].length < 40) comps[c].forEach(function (k) { d[k * 4 + 3] = 0; });
    cx.putImageData(img, 0, 0);
  }

  function buildAnims(img, map, clean) {
    var out = {};
    Object.keys(map.animations).forEach(function (name) {
      var a = map.animations[name];
      var cell = a.cell || map.cell, pivot = a.pivot || map.pivot;
      var origin = a.origin || [0, a.row * cell[1]];
      var frames = [];
      for (var f = 0; f < a.frames; f++) {
        var c = document.createElement("canvas"); c.width = cell[0]; c.height = cell[1];
        var x = c.getContext("2d", { willReadFrequently: true });
        x.drawImage(img, origin[0] + f * cell[0], origin[1], cell[0], cell[1], 0, 0, cell[0], cell[1]);
        if (clean) cleanFrame(x, cell[0], cell[1]);
        var data = x.getImageData(0, 0, cell[0], cell[1]).data, minx = cell[0], maxx = -1;
        for (var p = 3; p < data.length; p += 4) if (data[p] > 0) { var px = ((p - 3) / 4) % cell[0]; if (px < minx) minx = px; if (px > maxx) maxx = px; }
        var l = document.createElement("canvas"); l.width = cell[0]; l.height = cell[1];
        var lx = l.getContext("2d"); lx.translate(cell[0], 0); lx.scale(-1, 1); lx.drawImage(c, 0, 0);
        frames.push({ r: c, l: l, w: cell[0], h: cell[1], px: pivot[0], py: pivot[1], minx: minx, maxx: maxx });
      }
      out[name] = { frames: frames, fps: a.fps || 10, loop: !!a.loop };
    });
    return out;
  }

  // White silhouettes for hit flashes, built on demand.
  var whiteCache = new WeakMap();
  function white(canvas) {
    var w = whiteCache.get(canvas);
    if (w) return w;
    w = document.createElement("canvas"); w.width = canvas.width; w.height = canvas.height;
    var x = w.getContext("2d"); x.drawImage(canvas, 0, 0); x.globalCompositeOperation = "source-in"; x.fillStyle = "#ffffff"; x.fillRect(0, 0, w.width, w.height);
    whiteCache.set(canvas, w);
    return w;
  }

  function loadAssets(base) {
    if (ready) return Promise.resolve();
    if (loading) return loading;
    var dir = base + "assets/sprites/";
    var sheets = [
      ["player", "player/player-sheet", true], ["addon", "player/player-addon-sheet", true],
      ["bug", "enemies/glitch-bug-sheet"], ["drone", "enemies/spam-drone-sheet"], ["brute", "enemies/firewall-brute-sheet"],
      ["leak", "enemies/memory-leak-sheet"], ["coder", "enemies/corrupted-coder-sheet"],
      ["fx", "effects/effects-sheet"], ["props", "world/props-sheet"],
    ];
    loading = Promise.all(sheets.map(function (s) {
      return Promise.all([loadImage(dir + s[1] + ".png"), loadJSON(dir + s[1] + ".json")]).then(function (r) { A[s[0]] = buildAnims(r[0], r[1], s[2]); });
    }).concat([
      Promise.all([loadImage(dir + "world/cyber-cave-tileset.png"), loadJSON(dir + "world/cyber-cave-tileset.json")]).then(function (r) { TILES = { img: r[0], map: r[1].tiles }; }),
      loadImage(dir + "world/far.png").then(function (i) { IMG.far = i; }),
      loadImage(dir + "world/mid.png").then(function (i) { IMG.mid = i; }),
      loadImage(dir + "world/near.png").then(function (i) { IMG.near = i; }),
    ])).then(function () { ready = true; });
    return loading;
  }

  function frameOf(anim, t) {
    var n = anim.frames.length, i = Math.floor(t * anim.fps);
    return anim.frames[anim.loop ? ((i % n) + n) % n : Math.min(n - 1, Math.max(0, i))];
  }
  function animDone(anim, t) { return t * anim.fps >= anim.frames.length; }

  // draw a frame so its pivot lands on world point (wx, wy)
  function drawF(x, fr, wx, wy, face, opt) {
    opt = opt || {};
    var img = face < 0 ? fr.l : fr.r;
    if (opt.flash) img = white(img);
    var px = face < 0 ? fr.w - fr.px : fr.px;
    var sx = Math.round(wx - cam.x), sy = Math.round(wy - cam.y);
    if (sx + fr.w < -40 || sx - fr.w > VW + 40 || sy + fr.h < -40 || sy - fr.h > VH + 40) return;
    if (opt.alpha != null) x.globalAlpha = opt.alpha;
    if (opt.add) x.globalCompositeOperation = "lighter";
    if (opt.rot) {
      x.save(); x.translate(sx, sy); x.rotate(opt.rot); x.drawImage(img, -px, -fr.py); x.restore();
    } else x.drawImage(img, sx - px, sy - fr.py);
    x.globalAlpha = 1; x.globalCompositeOperation = "source-over";
  }

  /* ======================================================================= ZONES */

  function grid(W, H) {
    var g = [];
    for (var y = 0; y < H; y++) { g.push([]); for (var x = 0; x < W; x++) g[y].push("#"); }
    var api = {
      W: W, H: H, g: g,
      fill: function (x0, y0, x1, y1, ch) { for (var y = y0; y <= y1; y++) for (var x = x0; x <= x1; x++) if (x > 0 && x < W - 1 && y > 0 && y < H - 1) g[y][x] = ch; },
      carve: function (x0, y0, x1, y1) { api.fill(x0, y0, x1, y1, "."); },
      plat: function (x0, x1, y) { api.fill(x0, y, x1, y, "="); },
      spikes: function (x0, x1, y) { api.fill(x0, y, x1, y, "^"); },
      brk: function (x0, y0, x1, y1) { api.fill(x0, y0, x1, y1, "b"); },
    };
    return api;
  }

  var ZONES = [
    { name: "BUG HUNT", tag: "ZONE 1", tint: null, mote: "#7ff3ff", glow: "0,229,255", build: function () {
      var z = grid(158, 36);
      // A: start room
      z.carve(1, 18, 22, 27); z.fill(13, 26, 15, 27, "#");
      // shaft S1: the wall-jump lesson, entered through a low doorway so both walls start near the floor
      z.carve(23, 25, 26, 27); z.carve(27, 9, 30, 27); z.plat(27, 28, 20); z.plat(27, 30, 13);
      // B: upper corridor with a spike pit
      z.carve(31, 8, 64, 12); z.carve(46, 13, 48, 14); z.spikes(46, 48, 14);
      // C: the cavern
      z.carve(65, 8, 95, 30); z.plat(67, 71, 17); z.plat(74, 78, 22); z.plat(67, 71, 26);
      z.fill(91, 13, 92, 30, "#"); z.carve(91, 28, 92, 30);
      z.carve(93, 13, 95, 30); z.plat(93, 95, 13);
      // D: corridor with the double-jump pit
      z.carve(93, 8, 124, 12); z.carve(104, 4, 116, 12); z.carve(107, 13, 113, 16); z.spikes(107, 113, 16);
      // E: the last room
      z.carve(125, 4, 156, 12); z.fill(137, 9, 142, 9, "#");
      return {
        z: z, start: [3, 27],
        terminals: [[5, 27, true], [69, 30], [127, 12]],
        enemies: [["bug", 20, 27], ["bug", 41, 12], ["bug", 57, 12], ["bug", 76, 30], ["bug", 85, 30], ["bug", 101, 12], ["bug", 119, 12], ["bug", 143, 12], ["bug", 149, 12]],
        shards: [[8, 23], [9, 23], [21, 24], [29, 15], [36, 11], [47, 10], [60, 11], [69, 15], [76, 20], [69, 24], [80, 29], [94, 20], [110, 10], [116, 11], [139, 7], [140, 7], [141, 7]],
        modules: [["dj", 88, 30], ["pulse", 133, 12]],
        gate: [154, 12],
        signs: [
          [8.5, 23.5, "A D  move      SPACE  jump"], [19, 20.5, "Q  hold to block · raise it right before a hit to parry"], [16.5, 23, "E  attack      arrow keys turn and aim (you stand still)"],
          [24.5, 22.5, "jump into a wall · press jump again to kick off it"], [44, 10, "spikes bite · jump the pit"],
          [69, 28.5, "terminals save your progress and heal you"], [86, 27.5, "wall-jump up the narrow gap →"],
          [110, 10.5, "too far? double jump"], [131, 9.5, "R  hold to regenerate: spend RAM to heal"],
        ],
      };
    } },
    { name: "THE INBOX", tag: "ZONE 2", tint: "#ff7a3d", mote: "#ffc38a", glow: "255,150,80", build: function () {
      var z = grid(110, 70);
      // start room
      z.carve(1, 58, 30, 66);
      // tower: double jumps between grates, walls for wall jumps
      z.carve(31, 29, 44, 66);
      z.plat(33, 37, 62); z.plat(39, 43, 58); z.plat(33, 37, 54); z.plat(39, 43, 50); z.plat(33, 37, 46); z.plat(39, 43, 42); z.plat(33, 37, 38); z.plat(39, 44, 34);
      // corridor with the firewall module and a spike pit
      z.carve(45, 29, 78, 33); z.carve(64, 34, 66, 35); z.spikes(64, 66, 35);
      // chimney: wall jumps all the way up (low doorway in)
      z.carve(79, 31, 80, 33); z.carve(81, 8, 84, 33); z.plat(81, 82, 26); z.plat(83, 84, 19); z.plat(81, 84, 13);
      // top corridor
      z.carve(85, 8, 108, 12);
      return {
        z: z, start: [3, 66],
        terminals: [[5, 66, true], [34, 61], [47, 33], [88, 12]],
        enemies: [["drone", 18, 61], ["drone", 36, 52], ["drone", 41, 41], ["bug", 24, 66], ["drone", 60, 30], ["drone", 72, 31], ["bug", 55, 33], ["drone", 82, 15], ["drone", 97, 9], ["drone", 104, 10]],
        shards: [[12, 63], [13, 63], [35, 60], [41, 56], [35, 52], [41, 48], [35, 44], [41, 40], [35, 36], [65, 31], [82, 24], [84, 17], [94, 10], [100, 10]],
        modules: [["firewall", 51, 33]],
        gate: [106, 12],
        signs: [
          [10, 63.5, "spam drones fire envelopes · slash the envelopes away"], [38, 64.5, "climb: double jump between grates, kick off the walls"],
          [52, 30.5, "C  firewall: blocks every projectile for a few seconds"], [75, 30.5, "up the chimney ↑ · kick between the walls"],
        ],
      };
    } },
    { name: "SERVER ROOM", tag: "ZONE 3", tint: "#ff8a1f", mote: "#ffd08a", glow: "255,140,40", build: function () {
      var z = grid(170, 42);
      // start room, sealed by a cracked floor
      z.carve(1, 24, 23, 32); z.brk(17, 33, 20, 33); z.carve(17, 34, 20, 34);
      // lower hall
      z.carve(17, 35, 70, 39);
      // rising room with grates
      z.carve(71, 14, 95, 39);
      z.plat(73, 77, 35); z.plat(80, 84, 31); z.plat(87, 91, 27); z.plat(80, 84, 23); z.plat(88, 95, 19);
      // dash corridor with a long spike field
      z.carve(96, 14, 130, 18); z.carve(100, 9, 120, 18); z.carve(104, 19, 114, 20); z.spikes(104, 114, 20);
      // final hall
      z.carve(131, 9, 167, 18); z.fill(146, 15, 148, 18, "#");
      return {
        z: z, start: [3, 32],
        terminals: [[5, 32, true], [24, 39], [99, 18], [133, 18]],
        enemies: [["leak", 33, 39], ["leak", 46, 39], ["brute", 60, 39], ["brute", 84, 39], ["leak", 78, 39], ["leak", 120, 18], ["brute", 126, 18], ["brute", 156, 18], ["leak", 141, 18], ["drone", 152, 12]],
        shards: [[10, 30], [11, 30], [40, 37], [52, 37], [75, 33], [82, 29], [89, 25], [82, 21], [108, 16], [139, 15], [147, 13], [160, 15]],
        modules: [["slam", 12, 32], ["dash", 101, 18]],
        gate: [165, 18],
        signs: [
          [12, 29.5, "V  laptop slam · smash through cracked floors"], [40, 36.5, "memory leaks leave toxic puddles"],
          [62, 36.5, "firewall brutes hit hard · strike, then step back"], [101, 15.5, "SHIFT  cache dash · works in mid-air"],
          [109, 16.5, "jump, double jump, then dash"],
        ],
      };
    } },
    { name: "CORRUPTED CODER", tag: "FINAL", tint: "#d63cff", mote: "#f08bff", glow: "214,60,255", boss: true, build: function () {
      var z = grid(46, 22);
      z.carve(1, 5, 44, 17); z.plat(8, 13, 12); z.plat(32, 37, 12); z.plat(19, 26, 8);
      return {
        z: z, start: [3, 17],
        terminals: [[2, 17, true]],
        enemies: [["coder", 30, 17]],
        shards: [], modules: [], gate: null,
        signs: [],
        wallText: [[0.38, "REMEMBER TO USE ALL POWERS", 22], [0.445, "GAMEPLAY INSTRUCTIONS IN THE PAUSE MENU (ESC)", 15]],   // [height in the view, text, size]
      };
    } },
  ];

  /* ---- paint the static world into one canvas ---- */
  function hash(x, y) { var h = (x * 374761393 + y * 668265263) | 0; h = Math.imul(h ^ (h >>> 13), 1274126177); return ((h ^ (h >>> 16)) >>> 0) / 4294967295; }

  function paintZone(Lv) {
    var g = Lv.g, W = Lv.W, H = Lv.H;
    var c = document.createElement("canvas"); c.width = W * T; c.height = H * T;
    var x = c.getContext("2d"); x.imageSmoothingEnabled = false;
    var tile = function (name, dx, dy) { var p = TILES.map[name]; x.drawImage(TILES.img, p[0], p[1], 32, 32, dx, dy, 32, 32); };
    var at = function (tx, ty) { return tx < 0 || ty < 0 || tx >= W || ty >= H ? "#" : g[ty][tx]; };
    var solidish = function (ch) { return ch === "#" || ch === "b"; };
    var open = function (tx, ty) { return !solidish(at(tx, ty)); };
    var deep = function (tx, ty) { for (var dy = -2; dy <= 2; dy++) for (var dx = -2; dx <= 2; dx++) if (open(tx + dx, ty + dy)) return false; return true; };
    var ty, tx;
    for (ty = 0; ty < H; ty++) for (tx = 0; tx < W; tx++) {
      if (g[ty][tx] !== "#") continue;
      var hh = hash(tx, ty);
      tile(deep(tx, ty) ? "rock_deep_interior" : hh < 0.4 ? "rock_centre_a" : hh < 0.75 ? "rock_centre_b" : "rock_centre_c", tx * T, ty * T);
    }
    // fade rock to black the further it is from open space, so the playable area reads clearly
    var dist = new Int16Array(W * H).fill(99), queue = [];
    for (ty = 0; ty < H; ty++) for (tx = 0; tx < W; tx++) if (open(tx, ty)) { dist[ty * W + tx] = 0; queue.push(ty * W + tx); }
    for (var qi = 0; qi < queue.length; qi++) {
      var cur = queue[qi], cx0 = cur % W, cy0 = (cur / W) | 0;
      for (var oy = -1; oy <= 1; oy++) for (var ox = -1; ox <= 1; ox++) {
        var nx = cx0 + ox, ny = cy0 + oy;
        if (nx < 0 || ny < 0 || nx >= W || ny >= H) continue;
        var ni = ny * W + nx;
        if (dist[ni] > dist[cur] + 1) { dist[ni] = dist[cur] + 1; queue.push(ni); }
      }
    }
    var shadeA = [0, 0.15, 0.55, 0.78, 0.9];
    for (ty = 0; ty < H; ty++) for (tx = 0; tx < W; tx++) {
      var dd = dist[ty * W + tx];
      if (g[ty][tx] === "#" && dd > 1) { x.fillStyle = "rgba(2,5,10," + shadeA[Math.min(4, dd)] + ")"; x.fillRect(tx * T, ty * T, T, T); }
    }
    for (ty = 0; ty < H; ty++) for (tx = 0; tx < W; tx++) {
      if (g[ty][tx] !== "#") continue;
      if (open(tx - 1, ty)) tile("rock_left", tx * T, ty * T);
      if (open(tx + 1, ty)) tile("rock_right", tx * T, ty * T);
      if (open(tx, ty + 1)) tile("rock_bottom", tx * T, ty * T);
    }
    for (ty = 0; ty < H; ty++) for (tx = 0; tx < W; tx++) if (g[ty][tx] === "#" && open(tx, ty - 1)) tile("rock_top", tx * T, ty * T - 16);
    Lv.crystals = [];
    for (ty = 0; ty < H; ty++) for (tx = 0; tx < W; tx++) {
      var ch = g[ty][tx];
      if (ch === "=") {
        var lft = at(tx - 1, ty) === "=", rgt = at(tx + 1, ty) === "=";
        tile(!lft ? "grate_platform_left" : !rgt ? "grate_platform_right" : "grate_platform_middle", tx * T, ty * T - 9);
      } else if (ch === "^") {
        tile(hash(tx, ty + 7) < 0.5 ? "spikes_a" : "spikes_b", tx * T, ty * T);
      } else if (ch === ".") {
        if (Lv.keepClear[tx + "," + ty]) continue;
        var r = hash(tx + 11, ty * 3);
        if (at(tx, ty + 1) === "#") {
          if (r < 0.06) { tile("crystal_cluster", tx * T, ty * T); Lv.crystals.push([tx * T + 16, ty * T + 18]); }
          else if (r < 0.12) tile("small_rubble", tx * T, ty * T);
        } else if (at(tx, ty - 1) === "#" && r > 0.93) tile("hanging_cable", tx * T, ty * T);
      }
    }
    return c;
  }

  /* ======================================================================= STATE */

  var cv, ctx, low, lc, ui = {}, root = "", running = false, raf = 0, last = 0, acc = 0, time = 0;
  var VW = 900, scale = 1, hudU = 1;
  var Z, L, ART, P, enemies = [], shots = [], walls = [], puddles = [], fx = [], parts = [], motes = [], pickups = [], cam = { x: 0, y: 0 }, state = "boot", zoneIndex = 0;
  var shake = 0, hitstop = 0, flash = 0, fade = 0, fadeTo = null, titleT = 0, banner = null;
  var checkpoint, run;
  var keys = { left: false, right: false, up: false, down: false, aimL: false, aimR: false, aimU: false, aimD: false, jump: false, slash: false, focus: false, pulse: false, firewall: false, slam: false, dash: false, block: false };
  var pressed = {};
  var best = 0;
  try { best = parseInt(localStorage.getItem("anb_devrun_best_time") || "0", 10) || 0; } catch (_) {}

  var MAX_HP = 5, RAM_MAX = 99;
  var COST = { pulse: 11, firewall: 33, heal: 33 };
  var PH = { walk: 285, accG: 2200, accA: 1600, decG: 1900, decA: 700, jump: 610, dj: 545, gHold: 1800, gRel: 4500, gFall: 2300, maxFall: 720,
    slide: 140, wjX: 300, wjY: 560, dash: 700, dashT: 0.2 };
  var ABILITY_INFO = {
    dj: ["DOUBLE JUMP", "press SPACE again in mid-air"],
    pulse: ["DEBUG PULSE", "F · shoot a bolt · arrow keys aim up, down or diagonally"],
    firewall: ["FIREWALL", "C · a brick barrier that blocks every projectile"],
    slam: ["LAPTOP SLAM", "V · crash down with a shockwave, breaks cracked floors"],
    dash: ["CACHE DASH", "SHIFT · a fast burst that hurts what it passes through"],
  };
  var TOTAL_SHARDS = 0;

  function newRun() { run = { abilities: {}, shards: {}, deaths: 0, time: 0 }; }
  function saveRun() {
    try { localStorage.setItem("anb_devrun_save", JSON.stringify({ zone: zoneIndex, abilities: run.abilities, shards: run.shards, deaths: run.deaths, time: run.time })); } catch (_) {}
  }
  function loadSave() {
    try { var s = JSON.parse(localStorage.getItem("anb_devrun_save") || "null"); return s && s.zone > 0 ? s : null; } catch (_) { return null; }
  }

  function enterZone(i) {
    zoneIndex = i;
    Z = ZONES[i];
    var spec = Z.build();
    L = spec.z;
    L.spec = spec;
    L.keepClear = {};
    var keep = function (p) { for (var dx = -1; dx <= 1; dx++) L.keepClear[(p[0] + dx) + "," + p[1]] = true; };
    spec.terminals.forEach(keep); spec.modules.forEach(function (m) { keep([m[1], m[2]]); }); if (spec.gate) keep(spec.gate);
    spec.enemies.forEach(function (e) { keep([e[1], e[2]]); }); keep(spec.start);
    ART = paintZone(L);
    L.terminals = spec.terminals.map(function (t) { return { tx: t[0], ty: t[1], on: !!t[2] }; });
    checkpoint = L.terminals[0];
    motes = [];
    for (var m = 0; m < 90; m++) motes.push({ x: Math.random() * L.W * T, y: Math.random() * L.H * T, s: 0.3 + Math.random() * 0.7, ph: Math.random() * 6 });
    spawn();
    titleT = 0;
    if (zoneIndex > 0) saveRun();
  }

  function spawn() {
    var c = checkpoint;
    var ram = P ? P.ram : 0;
    P = { x: c.tx * T + 6, y: (c.ty + 1) * T - 44, w: 20, h: 44, vx: 0, vy: 0, face: 1, ground: false, coyote: 0, buf: 0,
      hp: MAX_HP, ram: ram, inv: 0, kb: 0, djUsed: false, airDash: true, flipT: -1, wallDir: 0, wallCoyote: 0, wallLock: 0, kickT: 0, sliding: false,
      slashT: 0, slashCd: 0, slashDir: "f", hitList: [], drop: 0, focusT: 0, castT: 0, castKind: "", pulseCd: 0, fwCd: 0,
      slam: null, slamCd: 0, blocking: false, blockT: 0, blockFlash: 0, dashT: 0, dashCd: 0, dashHit: [], ghosts: [], landT: 0, runT: 0, safe: null, safeT: 0, hazT: 0, dead: false, deadT: 0, anim: 0 };
    P.safe = { x: P.x, y: P.y };
    enemies = L.spec.enemies.map(function (e) { return makeEnemy(e[0], e[1], e[2]); });
    pickups = [];
    L.spec.shards.forEach(function (s) { var id = zoneIndex + ":" + s[0] + "," + s[1]; if (!run.shards[id]) pickups.push({ kind: "shard", id: id, x: s[0] * T + 16, y: s[1] * T + 16, ph: Math.random() * 6 }); });
    L.spec.modules.forEach(function (m) { if (!run.abilities[m[0]]) pickups.push({ kind: "module", ab: m[0], x: m[1] * T + 16, y: m[2] * T + 8, ph: 0 }); });
    shots = []; walls = []; puddles = []; fx = []; parts = [];
    shake = 0; hitstop = 0; flash = 0;
    cam.x = P.x - VW / 2; cam.y = P.y - VH / 2; clampCam();
    L.bossActive = false;
  }

  function makeEnemy(kind, tx, ty) {
    var S = { bug: [30, 18, 3], drone: [28, 24, 3], brute: [46, 66, 9], leak: [30, 16, 4], coder: [40, 72, 28] }[kind];
    var e = { kind: kind, w: S[0], h: S[1], hp: S[2], maxHp: S[2], vx: 0, vy: 0, face: -1, st: "idle", stT: 0, animT: Math.random(), hurt: 0, stun: 0, inv: 0,
      alive: true, dying: false, dieT: 0, kb: 0, kbx: 0, cd: 0, homeX: 0, homeY: 0, ground: false, drip: 0, phase: 1, fired: false };
    e.x = tx * T + 16 - e.w / 2;
    if (kind === "drone") { e.y = ty * T + 16 - e.h / 2; e.homeX = e.x; e.homeY = e.y; e.st = "patrol"; e.cd = 1 + Math.random(); }
    else e.y = (ty + 1) * T - e.h;
    if (kind === "bug") { e.st = "walk"; e.face = Math.random() < 0.5 ? -1 : 1; }
    if (kind === "leak") { e.st = "crawl"; }
    if (kind === "coder") { e.st = "dormant"; }
    return e;
  }

  /* ======================================================================= PHYSICS */

  function tileAt(tx, ty) { if (tx < 0 || ty < 0 || tx >= L.W || ty >= L.H) return "#"; return L.g[ty][tx]; }
  function solidT(ch) { return ch === "#" || ch === "b"; }
  function wallBlocks(o) {
    for (var i = 0; i < walls.length; i++) { var w = walls[i]; if (o.x < w.x + w.w && o.x + o.w > w.x && o.y < w.y + w.h && o.y + o.h > w.y) return w; }
    return null;
  }
  function moveX(o, blockWalls) {
    var dx = o.vx * STEP;
    o.x += dx;
    var y0 = Math.floor(o.y / T), y1 = Math.floor((o.y + o.h - 0.01) / T);
    if (dx > 0) {
      var tx = Math.floor((o.x + o.w) / T);
      for (var ty = y0; ty <= y1; ty++) if (solidT(tileAt(tx, ty))) { o.x = tx * T - o.w - 0.01; return 1; }
    } else if (dx < 0) {
      var tx2 = Math.floor(o.x / T);
      for (var ty2 = y0; ty2 <= y1; ty2++) if (solidT(tileAt(tx2, ty2))) { o.x = (tx2 + 1) * T + 0.01; return -1; }
    }
    if (blockWalls && dx !== 0) { var w = wallBlocks(o); if (w) { o.x = dx > 0 ? w.x - o.w - 0.01 : w.x + w.w + 0.01; return dx > 0 ? 1 : -1; } }
    return 0;
  }
  function moveY(o, canDrop) {
    var prevBottom = o.y + o.h;
    o.y += o.vy * STEP;
    var x0 = Math.floor(o.x / T), x1 = Math.floor((o.x + o.w - 0.01) / T);
    o.ground = false;
    if (o.vy >= 0) {
      var ty = Math.floor((o.y + o.h) / T);
      for (var tx = x0; tx <= x1; tx++) {
        var ch = tileAt(tx, ty);
        var plat = ch === "=" && prevBottom <= ty * T + 0.5 && !(canDrop && o.drop > 0);
        if (solidT(ch) || plat) { o.y = ty * T - o.h; o.vy = 0; o.ground = true; return "down"; }
      }
    } else {
      var ty2 = Math.floor(o.y / T);
      for (var tx2 = x0; tx2 <= x1; tx2++) if (solidT(tileAt(tx2, ty2))) { o.y = (ty2 + 1) * T; o.vy = 0; return "up"; }
    }
    return null;
  }
  function overlap(a, b) { return a.x < b.x + b.w && a.x + a.w > b.x && a.y < b.y + b.h && a.y + a.h > b.y; }
  function touchingWall(o, side) {
    var tx = side < 0 ? Math.floor((o.x - 1) / T) : Math.floor((o.x + o.w + 1) / T);
    return solidT(tileAt(tx, Math.floor((o.y + 8) / T))) && solidT(tileAt(tx, Math.floor((o.y + o.h - 8) / T)));
  }

  /* ======================================================================= UPDATE */

  function step() {
    time += STEP;
    if (fade > 0 || fadeTo) updateFade();
    if (hitstop > 0) { hitstop -= STEP; return; }
    shake = Math.max(0, shake - STEP * 30);
    flash = Math.max(0, flash - STEP * 3);
    updateParts();
    titleT += STEP;
    if (state !== "play" && state !== "dead") return;
    if (state === "dead") {
      P.deadT += STEP;
      P.vy = Math.min(P.vy + PH.gFall * STEP, PH.maxFall); moveY(P, false);
      updateEnemies(); updateWorld();
      if (P.deadT > 1.8 && !fadeTo) fadeTo = function () { run.deaths++; spawn(); state = "play"; banner = { t: "back online", s: "respawned at the last terminal", at: time }; };
      updateCam();
      return;
    }
    run.time += STEP;
    updatePlayer();
    updateShots();
    updateEnemies();
    updateWorld();
    updateCam();
  }

  function updateFade() {
    if (fadeTo) { fade = Math.min(1, fade + STEP * 2.4); if (fade >= 1) { var f = fadeTo; fadeTo = null; f(); } }
    else fade = Math.max(0, fade - STEP * 2);
  }

  function updatePlayer() {
    var p = P, k = keys;
    ["inv", "drop", "slashCd", "pulseCd", "fwCd", "slamCd", "dashCd", "wallLock", "kickT", "landT", "castT"].forEach(function (n) { p[n] = Math.max(0, p[n] - STEP); });
    p.anim += STEP; p.blockFlash = Math.max(0, p.blockFlash - STEP);
    p.ram = Math.min(RAM_MAX, p.ram + 6 * STEP);   // RAM slowly recharges, so the pulse never runs dry for long
    if (p.hazT > 0) {
      p.hazT -= STEP;
      if (p.hazT <= 0) { p.x = p.safe.x; p.y = p.safe.y; p.vx = 0; p.vy = 0; }
      return;
    }
    var dir = (k.right ? 1 : 0) - (k.left ? 1 : 0);
    var busy = !!p.slam || p.dashT > 0;
    // Debug Shield: hold Q to block hits from the front; raising it just before a hit parries
    var wasBlocking = p.blocking;
    p.blocking = k.block && !busy && p.slashT <= 0 && p.kb <= 0 && !p.sliding;
    if (p.blocking) { if (!wasBlocking) p.blockT = 0; p.blockT += STEP; var bf = aim().x || dir; if (bf) p.face = bf; }

    // focus (heal)
    var focusing = k.focus && p.ground && p.ram >= COST.heal && p.hp < MAX_HP && p.kb <= 0 && p.slashT <= 0 && !busy;
    if (focusing) {
      p.focusT += STEP; p.vx *= 0.8;
      if (Math.random() < 0.7) parts.push({ x: p.x + p.w / 2 + (Math.random() * 60 - 30), y: p.y + p.h, vx: 0, vy: -60 - Math.random() * 60, t: 0, life: 0.6, c: "#8ff4ff", s: 2, glow: true, toward: true });
      if (p.focusT > 0.9) { p.focusT = 0; p.ram -= COST.heal; p.hp++; flash = 0.25; burst(p.x + p.w / 2, p.y + 20, "#8ff4ff", 18, 200, true); }
    } else p.focusT = 0;

    // wall contact: slide when pushing into a wall while falling
    var touchL = touchingWall(p, -1), touchR = touchingWall(p, 1);
    var sliding = false;
    if (!p.ground && !busy && p.vy > 0 && ((dir < 0 && touchL) || (dir > 0 && touchR))) {
      sliding = true; p.wallDir = dir < 0 ? -1 : 1; p.wallCoyote = 0.12; p.djUsed = false; p.airDash = true; p.flipT = -1;
    } else p.wallCoyote = Math.max(0, p.wallCoyote - STEP);
    p.sliding = sliding;

    // dash
    if (pressed.dash) {
      pressed.dash = false;
      if (run.abilities.dash && p.dashCd <= 0 && !p.slam && (p.ground || p.airDash || sliding)) {
        if (sliding) p.face = -p.wallDir; else if (dir) p.face = dir;
        p.dashT = PH.dashT; p.dashCd = 0.5; p.dashHit = []; if (!p.ground) p.airDash = false;
        p.inv = Math.max(p.inv, PH.dashT + 0.05); p.slashT = 0; p.flipT = -1;
        sparks(p.x + p.w / 2, p.y + 24, -p.face, "#8ff4ff");
      }
    }

    if (p.dashT > 0) {
      p.dashT -= STEP;
      p.vx = p.face * PH.dash; p.vy = 0;
      if (Math.floor(p.dashT * 60) % 2 === 0) p.ghosts.push({ x: p.x, y: p.y, face: p.face, t: 0 });
      enemies.forEach(function (e) { if (e.alive && !e.dying && e.st !== "dormant" && p.dashHit.indexOf(e) < 0 && overlap(p, e)) { p.dashHit.push(e); hitEnemy(e, 1, p.face, "dash"); } });
      if (p.dashT <= 0) p.vx = p.face * PH.walk * 0.6;
    } else if (!p.slam) {
      if (p.kb > 0) p.kb -= STEP;
      else if (!focusing && p.wallLock <= 0) {
        var acc = p.ground ? PH.accG : PH.accA;
        if (dir) {
          // over the top speed (after a dash or a kick)? ease back down. Otherwise accelerate up to it.
          var top = p.blocking ? PH.walk * 0.3 : PH.walk;
          if (Math.sign(p.vx) === dir && Math.abs(p.vx) > top) p.vx = dir * Math.max(top, Math.abs(p.vx) - 900 * STEP);
          else { p.vx += dir * acc * STEP; if (dir * p.vx > top) p.vx = dir * top; }
          if (p.slashT <= 0) p.face = dir;
        }
        else { var dec = (p.ground ? PH.decG : PH.decA) * STEP; p.vx = Math.abs(p.vx) <= dec ? 0 : p.vx - Math.sign(p.vx) * dec; }
      }
    }

    // arrow keys turn the hero at once, even standing still (WASD movement can't override them)
    var ax = (k.aimR ? 1 : 0) - (k.aimL ? 1 : 0);
    if (ax && !p.sliding && p.dashT <= 0 && !p.slam && p.slashT <= 0) p.face = ax;

    // jumping: ground / coyote, wall jump, double jump
    if (pressed.jump) {
      pressed.jump = false;
      if (k.down && p.ground && onGrate()) { p.drop = 0.25; p.ground = false; }
      else p.buf = 0.12;
    }
    p.buf = Math.max(0, p.buf - STEP);
    p.coyote = p.ground ? 0.09 : Math.max(0, p.coyote - STEP);
    if (p.buf > 0 && !focusing && !p.slam && p.dashT <= 0) {
      if (p.coyote > 0) {
        p.vy = -PH.jump; p.buf = 0; p.coyote = 0; p.ground = false; p.flipT = -1;
        dust(p.x + p.w / 2, p.y + p.h, 6);
      } else if (p.wallCoyote > 0 || touchL || touchR) {
        var wd = p.wallCoyote > 0 ? p.wallDir : touchL ? -1 : 1;
        p.vx = -wd * PH.wjX; p.vy = -PH.wjY; p.face = -wd; p.wallLock = 0.15; p.kickT = 0.22; p.buf = 0; p.wallCoyote = 0; p.flipT = -1;
        p.djUsed = false; p.airDash = true;
        dust(wd < 0 ? p.x : p.x + p.w, p.y + p.h / 2, 6);
      } else if (run.abilities.dj && !p.djUsed) {
        p.vy = -PH.dj; p.djUsed = true; p.buf = 0; p.flipT = 0; p.kickT = 0;
        burst(p.x + p.w / 2, p.y + p.h, "#8ff4ff", 10, 140, true);
      }
    }
    if (p.flipT >= 0) p.flipT += STEP;

    // gravity
    if (p.dashT <= 0 && !p.slam) {
      var g = p.vy < 0 ? (k.jump ? PH.gHold : PH.gRel) : PH.gFall;
      p.vy = Math.min(p.vy + g * STEP, PH.maxFall);
      if (sliding && p.vy > PH.slide) p.vy = PH.slide;
    }

    // abilities
    if (pressed.slash) { pressed.slash = false; if (p.slashCd <= 0 && !focusing && !busy && !p.blocking) startSlash(); }
    if (pressed.pulse) { pressed.pulse = false; if (run.abilities.pulse && p.pulseCd <= 0 && p.ram >= COST.pulse && !busy) castPulse(); }
    if (pressed.firewall) { pressed.firewall = false; if (run.abilities.firewall && p.fwCd <= 0 && p.ram >= COST.firewall && !busy) castFirewall(); }
    if (pressed.slam) { pressed.slam = false; if (run.abilities.slam && p.slamCd <= 0 && !busy) startSlam(); }
    if (p.slashT > 0) { p.slashT -= STEP; slashHits(); }
    if (p.slam) updateSlam();

    var wasGround = p.ground, vyBefore = p.vy;
    moveX(p, false);
    var hit = moveY(p, true);
    if (hit === "down") {
      p.djUsed = false; p.airDash = true; p.flipT = -1;
      if (!wasGround && vyBefore > 380) { dust(p.x + p.w / 2, p.y + p.h, 8); p.landT = 0.12; }
      if (p.slam && p.slam.phase === "plunge") slamImpact();
    }
    if (p.ground && Math.abs(p.vx) > 20) { p.runT += STEP; if (Math.random() < 0.08) dust(p.x + p.w / 2 - p.face * 8, p.y + p.h, 1); } else p.runT = 0;
    p.ghosts = p.ghosts.filter(function (gh) { gh.t += STEP; return gh.t < 0.25; });

    // spikes: only the pointed part of the tile hurts
    var fy = Math.floor((p.y + p.h - 1) / T);
    for (var sx = Math.floor((p.x + 3) / T); sx <= Math.floor((p.x + p.w - 4) / T); sx++) if (tileAt(sx, fy) === "^" && p.y + p.h > fy * T + 16) { hazard(); break; }
    if (p.y > L.H * T + 40) hazard();
    puddles.forEach(function (pd) { if (pd.t < pd.life - 0.3 && overlap(p, pd)) hurtPlayer(pd.x + pd.w / 2, 1); });

    // safe spot for spike returns
    if (p.ground && p.hazT <= 0) {
      p.safeT += STEP;
      var b1 = tileAt(Math.floor((p.x + 1) / T), Math.floor((p.y + p.h + 1) / T)), b2 = tileAt(Math.floor((p.x + p.w - 1) / T), Math.floor((p.y + p.h + 1) / T));
      var okT = function (ch) { return ch === "#" || ch === "="; };
      if (p.safeT > 0.25 && okT(b1) && okT(b2)) { p.safe = { x: p.x, y: p.y }; p.safeT = 0; }
    }

    // terminals, pickups, gate
    L.terminals.forEach(function (t) {
      if (Math.abs(p.x + p.w / 2 - (t.tx * T + 16)) < 24 && Math.abs(p.y + p.h - (t.ty + 1) * T) < 8 && checkpoint !== t) {
        t.on = true; checkpoint = t; p.hp = MAX_HP; banner = { t: "progress saved", s: "health restored", at: time }; burst(t.tx * T + 16, t.ty * T, "#00e5ff", 24, 200, true); saveRun();
      }
    });
    pickups.forEach(function (it) {
      if (it.got) return;
      it.ph += STEP * 3;
      if (Math.abs(p.x + p.w / 2 - it.x) < 22 && Math.abs(p.y + p.h / 2 - it.y) < 34) {
        it.got = true;
        if (it.kind === "shard") { run.shards[it.id] = true; p.ram = Math.min(RAM_MAX, p.ram + 5); burst(it.x, it.y, "#8ff4ff", 10, 140, true); }
        else {
          run.abilities[it.ab] = true; p.ram = RAM_MAX; flash = 0.5; hitstop = 0.15; shake = 4;
          burst(it.x, it.y, "#ffffff", 40, 320, true);
          banner = { t: "new ability · " + ABILITY_INFO[it.ab][0], s: ABILITY_INFO[it.ab][1], at: time, big: true };
          updateTouchButtons(); saveRun();
        }
      }
    });
    if (L.spec.gate && !fadeTo) {
      var gx = L.spec.gate[0] * T + 16, gy = (L.spec.gate[1] + 1) * T;
      if (Math.abs(p.x + p.w / 2 - gx) < 22 && p.y + p.h > gy - 96 && p.y < gy) fadeTo = function () { enterZone(zoneIndex + 1); state = "play"; };
    }
  }

  function onGrate() {
    var ty = Math.floor((P.y + P.h + 1) / T);
    return tileAt(Math.floor((P.x + 1) / T), ty) === "=" || tileAt(Math.floor((P.x + P.w - 1) / T), ty) === "=";
  }

  // aim direction: the arrow keys when any is held, otherwise W A S D (touch pad)
  function aim() {
    var k = keys;
    if (k.aimL || k.aimR || k.aimU || k.aimD) return { x: (k.aimR ? 1 : 0) - (k.aimL ? 1 : 0), y: (k.aimD ? 1 : 0) - (k.aimU ? 1 : 0) };
    return { x: (k.right ? 1 : 0) - (k.left ? 1 : 0), y: (k.down ? 1 : 0) - (k.up ? 1 : 0) };
  }

  /* ---- Code Slash ---- */
  function startSlash() {
    var p = P;
    p.slashT = 0.26; p.slashCd = 0.34; p.hitList = [];
    if (p.sliding) p.face = -p.wallDir;
    var am = aim();
    if (am.x && !am.y) p.face = am.x;
    p.slashDir = am.y < 0 ? "u" : am.y > 0 && !p.ground ? "d" : "f";
    // the arc art bulges toward its left edge; mirror it so it always sweeps outward, away from the hero
    var ox = p.slashDir === "f" ? p.face * 30 : 0, oy = p.slashDir === "u" ? -22 : p.slashDir === "d" ? 66 : 22;
    var rot = p.slashDir === "u" ? -Math.PI / 2 * p.face : p.slashDir === "d" ? Math.PI / 2 * p.face : 0;
    fx.push({ a: "slash_arc", x: p.x + p.w / 2 + ox, y: p.y + oy, face: -p.face, rot: rot, t: 0, follow: true, ox: ox, oy: oy, add: true });
  }
  function slashBox() {
    var p = P;
    if (p.slashDir === "u") return { x: p.x - 16, y: p.y - 56, w: p.w + 32, h: 60 };
    if (p.slashDir === "d") return { x: p.x - 16, y: p.y + p.h - 6, w: p.w + 32, h: 60 };
    return p.face > 0 ? { x: p.x + p.w - 4, y: p.y - 4, w: 66, h: 50 } : { x: p.x - 62, y: p.y - 4, w: 66, h: 50 };
  }
  function slashHits() {
    var p = P;
    if (p.slashT < 0.08 || p.slashT > 0.22) return;
    var box = slashBox(), any = false;
    enemies.forEach(function (e) {
      if (!e.alive || e.dying || e.st === "dormant" || p.hitList.indexOf(e) >= 0 || !overlap(box, e)) return;
      p.hitList.push(e); any = true;
      var dx = Math.sign(e.x + e.w / 2 - (p.x + p.w / 2)) || p.face;
      hitEnemy(e, 1, dx, "slash");
      p.ram = Math.min(RAM_MAX, p.ram + 10);
    });
    shots.forEach(function (s) {
      if (s.enemy && !s.dead && p.hitList.indexOf(s) < 0 && overlap(box, s)) { p.hitList.push(s); s.dead = true; any = true; impact(s.x + s.w / 2, s.y + s.h / 2); p.ram = Math.min(RAM_MAX, p.ram + 4); }
    });
    if (p.slashDir === "d" && p.vy > -100) {
      var ty = Math.floor((box.y + box.h - 8) / T);
      for (var tx = Math.floor(box.x / T); tx <= Math.floor((box.x + box.w) / T); tx++) if (tileAt(tx, ty) === "^") { any = true; impact(tx * T + 16, ty * T + 16); break; }
    }
    if (any) {
      hitstop = Math.max(hitstop, 0.05); shake = Math.max(shake, 2);
      if (p.slashDir === "d") { p.vy = -520; p.djUsed = false; p.airDash = true; p.flipT = -1; }
      else if (p.slashDir === "f") { p.vx = -p.face * 170; p.kb = 0.08; }
    }
  }

  /* ---- Debug Pulse / Firewall / Laptop Slam ---- */
  function castPulse() {
    var p = P;
    if (p.sliding) p.face = -p.wallDir;
    p.ram -= COST.pulse; p.pulseCd = 0.32; p.castT = 0.3; p.castKind = "pulse";
    // aim: ↑/↓ alone fires straight up/down, ↑/↓ plus ←/→ fires diagonally
    var am = aim(), hx = am.x, vy = am.y;
    if (hx) p.face = hx;
    if (!vy) hx = p.face;
    var len = Math.hypot(hx, vy), dx = hx / len, dy = vy / len, sp = 470;
    var ox = p.x + p.w / 2 + dx * 24, oy = p.y + 20 + dy * 26;
    shots.push({ kind: "pulse", x: ox - 12, y: oy - 10, w: 24, h: 20, vx: dx * sp, vy: dy * sp, t: 0, life: 1.0, face: p.face,
      rot: p.face > 0 ? Math.atan2(dy, dx) : Math.atan2(dy, dx) - Math.PI, hit: [] });
    sparks(ox, oy, p.face, "#00e5ff");
  }
  function castFirewall() {
    var p = P;
    p.ram -= COST.firewall; p.fwCd = 0.8; p.castT = 0.35; p.castKind = "firewall";
    var wx = p.face > 0 ? p.x + p.w + 14 : p.x - 14 - 24;
    var feet = p.y + p.h;
    for (var dy = 0; dy < 4 * T; dy += 4) {
      var ty = Math.floor((feet + dy) / T), ch = tileAt(Math.floor((wx + 12) / T), ty);
      if (solidT(ch) || ch === "=") { feet = ty * T; break; }
    }
    walls.length = 0;
    walls.push({ x: wx, y: feet - 60, w: 24, h: 60, t: 0, life: 3.6 });
  }
  function startSlam() {
    var p = P;
    p.slam = { phase: p.ground ? "hop" : "plunge", t: 0 };
    p.slashT = 0; p.vx = 0; p.flipT = -1;
    p.vy = p.ground ? -320 : 120;
    p.ground = false;
  }
  function updateSlam() {
    var p = P, s = p.slam;
    s.t += STEP;
    if (s.phase === "hop") { p.vy += PH.gFall * STEP; if (s.t > 0.16) { s.phase = "plunge"; s.t = 0; } }
    else if (s.phase === "plunge") { p.vy = Math.min(p.vy + 4000 * STEP, 1000); p.vx = 0; p.inv = Math.max(p.inv, 0.05); }
    else if (s.phase === "land") { p.vx = 0; if (s.t > 0.3) { p.slam = null; p.slamCd = 0.7; } }
  }
  function slamImpact() {
    var p = P, cx = p.x + p.w / 2, by = p.y + p.h;
    p.slam = { phase: "land", t: 0 };
    shake = 8; hitstop = 0.08;
    fx.push({ a: "slam_shockwave", x: cx, y: by, face: 1, t: 0, add: true });
    enemies.forEach(function (e) { if (e.alive && !e.dying && e.st !== "dormant" && Math.abs(e.x + e.w / 2 - cx) < 100 && e.y + e.h > by - 70 && e.y < by + 30) hitEnemy(e, 3, Math.sign(e.x + e.w / 2 - cx) || 1, "slam"); });
    var ty = Math.floor((by + 2) / T), broke = false;
    for (var tx = Math.floor((cx - 40) / T); tx <= Math.floor((cx + 40) / T); tx++) if (breakAround(tx, ty)) broke = true;
    if (broke) { flash = 0.3; shake = 12; }
    burst(cx, by, "#8ff4ff", 24, 260, true);
  }
  function breakAround(tx, ty) {
    if (tileAt(tx, ty) !== "b") return false;
    var q = [[tx, ty]], n = 0;
    while (q.length) {
      var c = q.pop();
      if (tileAt(c[0], c[1]) !== "b") continue;
      L.g[c[1]][c[0]] = "."; n++;
      for (var i = 0; i < 10; i++) parts.push({ x: c[0] * T + Math.random() * 32, y: c[1] * T + Math.random() * 32, vx: (Math.random() * 2 - 1) * 160, vy: -Math.random() * 260, t: 0, life: 0.8 + Math.random() * 0.4, c: i % 2 ? "#2b4a66" : "#7ff3ff", s: 3 });
      q.push([c[0] - 1, c[1]], [c[0] + 1, c[1]], [c[0], c[1] - 1], [c[0], c[1] + 1]);
    }
    return n > 0;
  }

  function hurtPlayer(fromX, dmg, src) {
    var p = P;
    if (p.inv > 0 || state !== "play" || p.hazT > 0 || p.dead) return;
    var fromFront = (fromX - (p.x + p.w / 2)) * p.face > -4;
    if (p.blocking && fromFront) {
      var parry = p.blockT < 0.22;
      p.inv = 0.35; p.vx = -p.face * (parry ? 120 : 220); p.kb = 0.12;
      hitstop = parry ? 0.16 : 0.07; shake = parry ? 6 : 3; flash = parry ? 0.35 : 0;
      sparks(p.x + p.w / 2 + p.face * 18, p.y + 20, -p.face, parry ? "#ffffff" : "#8ff4ff");
      p.ram = Math.min(RAM_MAX, p.ram + (parry ? 20 : 6));
      if (parry && src && src.alive) { src.stun = src.kind === "coder" ? 1.3 : 1.0; src.kb = 0.15; src.kbx = p.face * 200; banner = { t: "parry", s: "", at: time }; }
      p.blockFlash = parry ? 0.25 : 0.12;
      return;
    }
    p.hp -= dmg || 1; p.inv = 1.2; p.kb = 0.2; p.focusT = 0; p.slam = null; p.dashT = 0;
    p.vx = (p.x + p.w / 2 < fromX ? -1 : 1) * 260; p.vy = -360;
    hitstop = 0.14; shake = 7; flash = 0.6;
    burst(p.x + p.w / 2, p.y + 20, "#ffffff", 14, 260, false);
    if (p.hp <= 0) die();
  }
  function hazard() {
    var p = P;
    if (p.hazT > 0 || state !== "play" || p.dead) return;
    p.hp--; hitstop = 0.12; shake = 6; flash = 0.6;
    burst(p.x + p.w / 2, p.y + 24, "#ff4a5e", 16, 240, false);
    if (p.hp <= 0) { die(); return; }
    p.hazT = 0.55; p.inv = 1.2; p.vx = 0; p.vy = 0; p.slam = null; p.dashT = 0;
  }
  function die() {
    var p = P;
    p.dead = true; p.deadT = 0; state = "dead"; shake = 9; p.vx = 0; p.vy = 0; p.slam = null; p.dashT = 0;
    burst(p.x + p.w / 2, p.y + 24, "#00e5ff", 50, 320, true);
  }

  /* ---- projectiles ---- */
  function updateShots() {
    shots.forEach(function (s) {
      s.t += STEP;
      s.x += s.vx * STEP; s.y += s.vy * STEP;
      if (s.t > s.life) s.dead = true;
      var tx = Math.floor((s.x + s.w / 2) / T), ty = Math.floor((s.y + s.h / 2) / T);
      if (solidT(tileAt(tx, ty))) { s.dead = true; impact(s.x + s.w / 2, s.y + s.h / 2); return; }
      if (s.enemy) {
        if (wallBlocks(s)) { s.dead = true; impact(s.x + s.w / 2, s.y + s.h / 2); return; }
        if (P.dashT <= 0 && overlap(s, P)) { s.dead = true; hurtPlayer(s.x + s.w / 2 - Math.sign(s.vx) * 20, s.dmg || 1); }
      } else {
        enemies.forEach(function (e) {
          if (!s.dead && e.alive && !e.dying && e.st !== "dormant" && s.hit.indexOf(e) < 0 && overlap(s, e)) {
            s.hit.push(e); hitEnemy(e, e.kind === "coder" ? 1 : 2, Math.sign(s.vx) || P.face, "pulse"); s.dead = true;
          }
        });
      }
    });
    shots = shots.filter(function (s) { return !s.dead; });
  }

  function updateWorld() {
    walls.forEach(function (w) { w.t += STEP; });
    walls = walls.filter(function (w) { return w.t < w.life; });
    puddles.forEach(function (pd) { pd.t += STEP; });
    puddles = puddles.filter(function (pd) { return pd.t < pd.life; });
    fx.forEach(function (f) { f.t += STEP; if (f.follow) { f.x = P.x + P.w / 2 + f.ox; f.y = P.y + f.oy; } });
    fx = fx.filter(function (f) { return !animDone(A.fx[f.a], f.t); });
    if (Z.boss && !L.bossActive && P.x > 7 * T && state === "play") {
      L.bossActive = true;
      banner = { t: "CORRUPTED CODER", s: "the last bug in the system", at: time, big: true };
      enemies.forEach(function (e) { if (e.kind === "coder") { e.st = "intro"; e.stT = 1.6; e.inv = 0; } });
    }
  }

  /* ======================================================================= ENEMIES */

  function hitEnemy(e, dmg, dirx, kind) {
    if (e.inv > 0 || e.dying) return;
    e.hp -= dmg; e.hurt = 0.13;
    var heavy = e.kind === "brute" ? 0.2 : e.kind === "coder" ? 0 : 1;
    e.kb = 0.18; e.kbx = dirx * 280 * heavy;
    if (e.kind === "drone") { e.vx = dirx * 200; e.vy = -60; }
    if (kind === "pulse" && e.kind !== "coder") e.stun = e.kind === "brute" ? 0.6 : 1.0;   // only a parry stuns the boss
    impact(e.x + e.w / 2, e.y + e.h / 2);
    hitstop = Math.max(hitstop, kind === "slam" ? 0.08 : 0.05); shake = Math.max(shake, 3);
    if (e.hp <= 0) {
      e.dying = true; e.dieT = 0; hitstop = 0.1; shake = 6;
      if (e.kind === "bug") glitchBurst(e, "#d8274d", "#ff8fa3");
      if (e.kind === "leak") glitchBurst(e, "#8a2be2", "#e08bff");
      if (e.kind === "drone") glitchBurst(e, "#4a4f5c", "#ff4a5e");
      if (e.kind === "brute") glitchBurst(e, "#ff8a1f", "#ffd08a");
      if (e.kind === "coder") { glitchBurst(e, "#d63cff", "#ffffff"); shake = 14; hitstop = 0.4; flash = 1; shots = shots.filter(function (s) { return !s.enemy; }); }
    }
  }

  function updateEnemies() {
    enemies.forEach(function (e) {
      if (!e.alive) return;
      if (Math.abs(e.x - P.x) > VW * 1.2 && e.kind !== "coder") return;
      e.animT += STEP;
      e.hurt = Math.max(0, e.hurt - STEP); e.cd = Math.max(0, e.cd - STEP); e.stun = Math.max(0, e.stun - STEP);
      if (e.kind !== "coder") e.inv = Math.max(0, e.inv - STEP);
      if (e.dying) {
        e.dieT += STEP;
        if (e.kind === "drone") { e.vy = Math.min(e.vy + 900 * STEP, 400); e.y += e.vy * STEP; }
        else { e.vy = Math.min((e.vy || 0) + 1500 * STEP, 500); moveY(e, false); }
        if (animDone(A[e.kind].death, e.dieT) && e.dieT > 0.4) { e.alive = false; if (e.kind === "coder") bossDefeated(); }
        return;
      }
      if (e.kb > 0) e.kb -= STEP;
      ({ bug: aiBug, drone: aiDrone, brute: aiBrute, leak: aiLeak, coder: aiCoder })[e.kind](e);
      if (!e.dying && e.st !== "dormant" && e.st !== "out" && P.dashT <= 0 && overlap(P, { x: e.x + 3, y: e.y + 3, w: e.w - 6, h: e.h - 4 })) hurtPlayer(e.x + e.w / 2, 1, e);
    });
    enemies = enemies.filter(function (e) { return e.alive; });
  }

  function groundMove(e, speed) {
    var v = e.kb > 0 ? e.kbx : speed;
    var saved = e.vx; e.vx = v;
    var hit = moveX(e, true);
    e.vx = saved;
    e.vy = Math.min((e.vy || 0) + 1600 * STEP, 600);
    moveY(e, false);
    if (e.kb > 0) { e.kbx *= 0.9; return 0; }
    if (!speed) return 0;
    var dirv = Math.sign(speed);
    var ax = Math.floor((dirv > 0 ? e.x + e.w + 2 : e.x - 2) / T), by = Math.floor((e.y + e.h + 4) / T);
    var below = tileAt(ax, by);
    var ledge = e.ground && !solidT(below) && below !== "=";
    return hit || (ledge ? dirv : 0);
  }

  function aiBug(e) {
    var dx = P.x + P.w / 2 - (e.x + e.w / 2), same = Math.abs(P.y + P.h - (e.y + e.h)) < 40 && !P.dead;
    if (e.stun > 0) { groundMove(e, 0); return; }
    if (e.st === "walk") {
      if (same && Math.abs(dx) < 260 && Math.sign(dx) === e.face && e.cd <= 0) { e.st = "tell"; e.stT = 0.35; e.animT = 0; }
      if (groundMove(e, e.face * 60)) e.face = -e.face;
    } else if (e.st === "tell") {
      groundMove(e, 0); e.stT -= STEP;
      if (e.stT <= 0) { e.st = "charge"; e.stT = 0.75; e.animT = 0; }
    } else if (e.st === "charge") {
      e.stT -= STEP;
      var blocked = groundMove(e, e.face * 240);
      if (blocked || e.stT <= 0) { e.st = "walk"; e.cd = 1.0; if (blocked) e.face = -e.face; }
    }
  }

  function aiDrone(e) {
    var cx = e.x + e.w / 2, cy = e.y + e.h / 2, px = P.x + P.w / 2, py = P.y + 10;
    var dx = px - cx, dy = py - cy, dist = Math.hypot(dx, dy);
    if (e.stun > 0) { e.vy += 200 * STEP; e.vx *= 0.95; }
    else if (e.st === "patrol") {
      e.vx = Math.sin(e.animT * 0.9) * 40; e.vy = (e.homeY + Math.sin(e.animT * 2.1) * 10 - e.y) * 2;
      if (dist < 340 && !P.dead) e.st = "engage";
    } else if (e.st === "engage") {
      var tx = px - Math.sign(dx || 1) * 170, ty = py - 110;
      e.vx += ((tx - cx) * 1.6 - e.vx) * Math.min(1, STEP * 3);
      e.vy += ((ty - cy) * 1.6 - e.vy) * Math.min(1, STEP * 3);
      var sp = Math.hypot(e.vx, e.vy); if (sp > 120) { e.vx *= 120 / sp; e.vy *= 120 / sp; }
      e.face = dx > 0 ? 1 : -1;
      if (dist > 520 || P.dead) e.st = "patrol";
      else if (e.cd <= 0 && dist < 420) { e.st = "shoot"; e.stT = 0; e.animT = 0; e.fired = false; }
    }
    if (e.st === "shoot") {
      e.stT += STEP; e.vx *= 0.9; e.vy *= 0.9;
      if (e.stT > 0.16 && !e.fired) {
        e.fired = true;
        var a = Math.atan2(dy, dx);
        shots.push({ enemy: true, kind: "env", x: cx - 8, y: cy - 8, w: 16, h: 16, vx: Math.cos(a) * 210, vy: Math.sin(a) * 210, t: 0, life: 3, dmg: 1 });
      }
      if (e.stT > 0.34) { e.st = "engage"; e.cd = 1.9 + Math.random() * 0.6; }
    }
    moveX(e, true); moveY(e, false);
  }

  function aiBrute(e) {
    var dx = P.x + P.w / 2 - (e.x + e.w / 2), same = Math.abs(P.y + P.h - (e.y + e.h)) < 90 && !P.dead;
    if (e.stun > 0) { groundMove(e, 0); return; }
    if (e.st === "idle" || e.st === "walk") {
      if (same && Math.abs(dx) < 340) {
        e.face = dx > 0 ? 1 : -1;
        if (Math.abs(dx) < 80 && e.cd <= 0) { e.st = "windup"; e.stT = 0; e.animT = 0; groundMove(e, 0); }
        else if (Math.abs(dx) >= 60) { e.st = "walk"; if (groundMove(e, e.face * 55)) e.st = "idle"; }
        else { e.st = "idle"; groundMove(e, 0); }
      } else { e.st = "idle"; groundMove(e, 0); }
    } else if (e.st === "windup") {
      groundMove(e, 0); e.stT += STEP;
      if (e.stT > 0.42) { e.st = "slam"; e.stT = 0; e.animT = 0; e.fired = false; }
    } else if (e.st === "slam") {
      groundMove(e, 0); e.stT += STEP;
      if (!e.fired && e.stT > 0.08) {
        e.fired = true; shake = Math.max(shake, 7);
        var box = e.face > 0 ? { x: e.x + e.w - 10, y: e.y + 10, w: 82, h: e.h - 10 } : { x: e.x - 72, y: e.y + 10, w: 82, h: e.h - 10 };
        if (overlap(P, box)) hurtPlayer(e.x + e.w / 2, 2, e);
        fx.push({ a: "slam_shockwave", x: e.x + e.w / 2 + e.face * 40, y: e.y + e.h, face: e.face, t: 0 });
      }
      if (e.stT > 0.4) { e.st = "idle"; e.cd = 1.1; }
    }
  }

  function aiLeak(e) {
    var dx = P.x + P.w / 2 - (e.x + e.w / 2), near = Math.abs(dx) < 300 && Math.abs(P.y - e.y) < 80 && !P.dead;
    if (e.stun > 0) { groundMove(e, 0); return; }
    if (near) e.face = dx > 0 ? 1 : -1;
    if (groundMove(e, e.face * (near ? 48 : 30))) e.face = -e.face;
    e.drip -= STEP;
    if (e.drip <= 0 && e.ground) {
      e.drip = 0.8;
      puddles.push({ x: e.x + e.w / 2 - 14, y: e.y + e.h - 8, w: 28, h: 8, t: 0, life: 4.5 });
    }
  }

  function aiCoder(e) {
    var dx = P.x + P.w / 2 - (e.x + e.w / 2);
    if (e.st === "dormant") { e.inv = 1; return; }
    if (P.dead) { groundMove(e, 0); return; }
    if (e.hp <= e.maxHp / 2 && e.phase === 1) {
      e.phase = 2; banner = { t: "PHASE 2", s: "it's rewriting itself", at: time };
      flash = 0.5; shake = 8;
      [[9, 11], [35, 11]].forEach(function (s) { var b = makeEnemy("bug", s[0], s[1]); b.face = s[0] < 20 ? 1 : -1; enemies.push(b); });
    }
    var fast = e.phase === 2 ? 0.7 : 1;
    if (e.stun > 0 && e.st !== "out" && e.st !== "in") { groundMove(e, 0); e.st = "rest"; e.stT = Math.max(e.stT, 0.3); return; }
    e.stT -= STEP;
    if (e.st === "tell") {
      e.face = dx > 0 ? 1 : -1; groundMove(e, 0);
      if (e.stT <= 0) { e.st = "claw"; e.stT = 0.43 * fast; e.animT = 0; }
      return;
    }
    if (e.st === "intro" || e.st === "rest") {
      e.inv = 0; e.face = dx > 0 ? 1 : -1; groundMove(e, 0);
      if (e.stT <= 0) {
        var r = Math.random();
        if (Math.abs(dx) < 120 && r < 0.6) startCoder(e, "claw");
        else if (r < 0.5) startCoder(e, "out");
        else startCoder(e, "cast");
      }
    } else if (e.st === "out") {
      e.inv = 1;
      if (e.stT <= 0) {
        var side = Math.random() < 0.5 ? -1 : 1, target = P.x + P.w / 2 + side * (110 + Math.random() * 40);
        if (target < 3 * T || target > (L.W - 3) * T) target = P.x + P.w / 2 - side * (110 + Math.random() * 40);
        e.x = Math.max(2 * T, Math.min((L.W - 2) * T - e.w, target - e.w / 2)); e.y = 18 * T - e.h;
        e.face = P.x > e.x ? 1 : -1;
        e.st = "in"; e.stT = 0.36 * fast; e.animT = 0;
        burst(e.x + e.w / 2, e.y + e.h / 2, "#d63cff", 16, 220, true);
      }
    } else if (e.st === "in") {
      e.inv = 1;
      if (e.stT <= 0) { e.inv = 0; startCoder(e, Math.random() < 0.7 ? "claw" : "cast"); }
    } else if (e.st === "claw") {
      var pr = 1 - e.stT / (0.43 * fast);
      groundMove(e, pr > 0.25 && pr < 0.7 ? e.face * 160 : 0);
      if (pr > 0.3 && pr < 0.75) {
        var box = e.face > 0 ? { x: e.x + e.w - 6, y: e.y + 8, w: 70, h: e.h - 10 } : { x: e.x - 64, y: e.y + 8, w: 70, h: e.h - 10 };
        if (overlap(P, box)) hurtPlayer(e.x + e.w / 2, 1, e);
      }
      if (e.stT <= 0) { e.st = "rest"; e.stT = e.phase === 2 ? 0.6 : 1.0; }
    } else if (e.st === "cast") {
      groundMove(e, 0);
      if (!e.fired && e.stT < 0.25 * fast) {
        e.fired = true;
        var cx = e.x + e.w / 2, cy = e.y + 20, a0 = Math.atan2(P.y + 20 - cy, P.x + P.w / 2 - cx);
        var n = e.phase === 2 ? 5 : 3;
        for (var i = 0; i < n; i++) {
          var a = a0 + (i - (n - 1) / 2) * 0.22;
          shots.push({ enemy: true, kind: "glyph", x: cx - 7, y: cy - 7, w: 14, h: 14, vx: Math.cos(a) * 200, vy: Math.sin(a) * 200, t: 0, life: 3.5, dmg: 1 });
        }
      }
      if (e.stT <= 0) { e.st = "rest"; e.stT = e.phase === 2 ? 0.6 : 1.0; }
    }
  }
  function startCoder(e, s) {
    var fast = e.phase === 2 ? 0.7 : 1;
    e.st = s; e.animT = 0; e.fired = false;
    if (s === "claw") { e.st = "tell"; e.stT = 0.38 * (e.phase === 2 ? 0.8 : 1); return; }   // a readable wind-up before every claw
    e.stT = s === "cast" ? 0.5 * fast : 0.36 * fast;
    if (s === "out") { e.inv = 1; burst(e.x + e.w / 2, e.y + e.h / 2, "#d63cff", 16, 220, true); }
  }
  function bossDefeated() {
    state = "won";
    var t = Math.round(run.time);
    if (!best || t < best) { best = t; try { localStorage.setItem("anb_devrun_best_time", String(best)); } catch (_) {} }
    try { localStorage.removeItem("anb_devrun_save"); } catch (_) {}
    var got = Object.keys(run.shards).length;
    showOverlay("SYSTEM RESTORED", "the codebase is clean · " + fmtTime(t) + " · " + got + "/" + TOTAL_SHARDS + " shards · " + run.deaths + " crash" + (run.deaths === 1 ? "" : "es"),
      "thanks for playing · space to play again");
    if (ui.best) ui.best.textContent = fmtTime(best);
  }
  function fmtTime(t) { return Math.floor(t / 60) + ":" + String(t % 60).padStart(2, "0"); }

  function clampCam() {
    if (!L) return;
    cam.x = L.W * T < VW ? (L.W * T - VW) / 2 : Math.max(0, Math.min(L.W * T - VW, cam.x));
    cam.y = Math.max(0, Math.min(L.H * T - VH, cam.y));
  }
  function updateCam() {
    var tx = P.x + P.w / 2 - VW / 2 + P.face * 70, ty = P.y + P.h / 2 - VH * 0.55;
    cam.x += (tx - cam.x) * Math.min(1, STEP * 4);
    cam.y += (ty - cam.y) * Math.min(1, STEP * (P.ground ? 4.5 : 3));
    clampCam();
  }

  /* ---- particles ---- */
  function burst(x, y, c, n, sp, glw) {
    for (var i = 0; i < n; i++) { var a = Math.random() * Math.PI * 2, v = sp * (0.3 + Math.random() * 0.7); parts.push({ x: x, y: y, vx: Math.cos(a) * v, vy: Math.sin(a) * v - 60, t: 0, life: 0.5 + Math.random() * 0.5, c: c, s: 2 + (Math.random() < 0.3 ? 1 : 0), glow: glw, drag: true }); }
  }
  function sparks(x, y, dir, c) {
    for (var i = 0; i < 8; i++) parts.push({ x: x, y: y, vx: (dir || (Math.random() < 0.5 ? -1 : 1)) * (120 + Math.random() * 260), vy: (Math.random() * 2 - 1) * 180, t: 0, life: 0.25 + Math.random() * 0.2, c: i % 3 ? "#ffffff" : (c || "#00e5ff"), s: 2, glow: true, drag: true });
  }
  function impact(x, y) { fx.push({ a: "impact_sparks", x: x, y: y, face: Math.random() < 0.5 ? 1 : -1, t: 0, add: true }); }
  function dust(x, y, n) {
    for (var i = 0; i < n; i++) parts.push({ x: x + (Math.random() * 20 - 10), y: y - 2, vx: (Math.random() * 2 - 1) * 70, vy: -Math.random() * 50, t: 0, life: 0.4 + Math.random() * 0.3, c: "#4a6b7d", s: 2, drag: true, nograv: true });
  }
  function glitchBurst(e, c1, c2) {
    for (var i = 0; i < 34; i++) parts.push({ x: e.x + Math.random() * e.w, y: e.y + Math.random() * e.h, vx: (Math.random() * 2 - 1) * 200, vy: -60 - Math.random() * 240, t: 0, life: 0.6 + Math.random() * 0.7, c: i % 4 ? c1 : c2, s: 2 + (i % 3 === 0 ? 1 : 0), glow: i % 4 === 0, drag: true, glitch: true });
  }
  function updateParts() {
    parts = parts.filter(function (q) {
      q.t += STEP;
      if (q.toward && P) { q.x += ((P.x + P.w / 2) - q.x) * STEP * 4; q.y += q.vy * STEP; }
      else {
        if (!q.nograv) q.vy += 900 * STEP;
        if (q.drag) { q.vx *= 0.985; q.vy *= 0.985; }
        q.x += q.vx * STEP; q.y += q.vy * STEP;
        if (q.glitch && Math.random() < 0.05) q.x += (Math.random() < 0.5 ? -4 : 4);
      }
      return q.t < q.life;
    });
  }

  /* ======================================================================= RENDER */

  function render() {
    var x = lc;
    var shx = shake ? Math.round((Math.random() * 2 - 1) * shake) : 0, shy = shake ? Math.round((Math.random() * 2 - 1) * shake) : 0;
    var rcx = cam.x, rcy = cam.y;
    cam.x = Math.round(cam.x + shx); cam.y = Math.round(cam.y + shy);

    drawBackground(x);
    x.drawImage(ART, cam.x, cam.y, VW, VH, 0, 0, VW, VH);
    if (L.spec.wallText) wallText(x);
    drawBreakables(x);
    L.crystals.forEach(function (c) { glow(x, c[0] - cam.x, c[1] - cam.y, 34, "rgba(" + Z.glow + ",.18)"); });

    L.terminals.forEach(function (t) {
      var a = A.props.terminal_checkpoint, wx = t.tx * T + 16, wy = (t.ty + 1) * T - 1;
      var fr = t.on ? a.frames[1 + (Math.floor(time * 8) % 4)] : a.frames[0];
      if (t.on) glow(x, wx - cam.x, wy - 26 - cam.y, 46, "rgba(0,229,255,.22)");
      drawF(x, fr, wx, wy, 1);
    });
    if (L.spec.gate) {
      var gx = L.spec.gate[0] * T + 16, gy = (L.spec.gate[1] + 1) * T - 1;
      glow(x, gx - cam.x, gy - 48 - cam.y, 90, "rgba(0,229,255,.2)");
      drawF(x, frameOf(A.props.exit_gate, time), gx, gy, 1);
    }
    pickups.forEach(function (it) {
      if (it.got) return;
      if (it.kind === "shard") {
        glow(x, it.x - cam.x, it.y - cam.y, 18, "rgba(0,229,255,.3)");
        drawF(x, frameOf(A.props.data_shard, time + it.ph), it.x, it.y + Math.sin(it.ph) * 3, 1);
      } else drawModule(x, it);
    });

    puddles.forEach(function (pd) {
      var a = Math.max(0, Math.min(1, (pd.life - pd.t) / 0.6));
      glow(x, pd.x + pd.w / 2 - cam.x, pd.y - cam.y + 4, 24, "rgba(170,60,255," + (0.25 * a).toFixed(2) + ")");
      drawF(x, frameOf(A.leak.puddle, pd.t), pd.x + pd.w / 2, pd.y + pd.h + 5, 1, { alpha: a });
    });
    walls.forEach(function (w) {
      var a = A.fx.firewall, fr = w.t < 0.5 ? frameOf(a, w.t) : a.frames[3 + (Math.floor(w.t * 10) % 3)];
      var alpha = w.life - w.t < 0.6 ? (Math.floor(w.t * 20) % 2 ? 0.4 : 0.9) : 1;
      glow(x, w.x + 12 - cam.x, w.y + 30 - cam.y, 50, "rgba(255,90,40,.25)");
      drawF(x, fr, w.x + 12, w.y + w.h, 1, { alpha: alpha });
    });

    enemies.forEach(function (e) { drawEnemy(x, e); });
    drawPlayer(x);

    shots.forEach(function (s) {
      var cx = s.x + s.w / 2, cy = s.y + s.h / 2;
      if (s.kind === "pulse") { glow(x, cx - cam.x, cy - cam.y, 30, "rgba(0,229,255,.35)"); drawF(x, frameOf(A.fx.pulse_projectile, s.t), cx, cy, s.face, { add: true, rot: s.rot || 0 }); }
      else if (s.kind === "env") { glow(x, cx - cam.x, cy - cam.y, 16, "rgba(255,80,80,.3)"); drawF(x, frameOf(A.drone.envelope_projectile, s.t), cx, cy, s.vx < 0 ? -1 : 1); }
      else {
        glow(x, cx - cam.x, cy - cam.y, 20, "rgba(214,60,255,.45)");
        var sx = Math.round(cx - cam.x), sy = Math.round(cy - cam.y), j = Math.floor(s.t * 30) % 3 - 1;
        x.fillStyle = "#f08bff"; x.fillRect(sx - 5 + j, sy - 5, 10, 10);
        x.fillStyle = "#ffffff"; x.fillRect(sx - 2, sy - 2 - j, 4, 4);
        x.fillStyle = "#6b0f8a"; x.fillRect(sx - 7, sy + 4 + j, 4, 2);
      }
    });
    fx.forEach(function (f) { drawF(x, frameOf(A.fx[f.a], f.t), f.x, f.y, f.face, { rot: f.rot, add: f.add }); });
    parts.forEach(function (q) {
      var a = 1 - q.t / q.life;
      x.globalAlpha = Math.max(0, a);
      var px = Math.round(q.x - cam.x), py = Math.round(q.y - cam.y);
      if (q.glow) glow(x, px, py, 8, "rgba(" + Z.glow + ",.3)");
      x.fillStyle = q.c; x.fillRect(px, py, q.s, q.s);
    });
    x.globalAlpha = 1;

    drawNear(x);
    var vg = x.createRadialGradient(VW / 2, VH / 2, VH * 0.4, VW / 2, VH / 2, VW * 0.72);
    vg.addColorStop(0, "rgba(0,0,0,0)"); vg.addColorStop(1, "rgba(0,0,0,.55)");
    x.fillStyle = vg; x.fillRect(0, 0, VW, VH);
    if (flash > 0) { x.fillStyle = "rgba(255,255,255," + (flash * 0.3).toFixed(3) + ")"; x.fillRect(0, 0, VW, VH); }
    if (state === "dead") { x.fillStyle = "rgba(0,0,0," + Math.min(0.85, P.deadT / 1.6).toFixed(3) + ")"; x.fillRect(0, 0, VW, VH); }
    if (fade > 0) { x.fillStyle = "rgba(0,0,0," + fade.toFixed(3) + ")"; x.fillRect(0, 0, VW, VH); }

    ctx.imageSmoothingEnabled = false;
    ctx.drawImage(low, 0, 0, VW, VH, 0, 0, Math.round(VW * scale), Math.round(VH * scale));
    signs();
    if (state === "play" || state === "dead") hud();
    cam.x = rcx; cam.y = rcy;
  }

  // faint lines fixed in the middle of the view, behind every character
  function wallText(x) {
    x.save(); x.textAlign = "center"; x.textBaseline = "middle";
    L.spec.wallText.forEach(function (w) {
      x.font = w[2] + "px 'Bebas Neue', sans-serif";
      x.fillStyle = "rgba(" + Z.glow + ",.4)";
      x.fillText(w[1], Math.round(VW / 2), Math.round(VH * w[0]));
    });
    x.restore();
  }

  function drawBackground(x) {
    var gr = x.createLinearGradient(0, 0, 0, VH);
    gr.addColorStop(0, "#02050a"); gr.addColorStop(0.55, "#061019"); gr.addColorStop(1, "#0b1c26");
    x.fillStyle = gr; x.fillRect(0, 0, VW, VH);
    var vy = L.H * T > VH ? cam.y / (L.H * T - VH) : 0;
    layer(x, IMG.far, 0.15, Math.round(VH - 512 + 40 - vy * 40));
    layer(x, IMG.mid, 0.35, Math.round(VH - 512 + 70 - vy * 80));
    x.fillStyle = "rgba(2,6,12,.42)"; x.fillRect(0, 0, VW, VH);
    if (Z.tint) {
      x.globalCompositeOperation = "color"; x.globalAlpha = 0.45; x.fillStyle = Z.tint; x.fillRect(0, 0, VW, VH);
      x.globalCompositeOperation = "source-over"; x.globalAlpha = 1;
    }
    var fog = x.createLinearGradient(0, VH * 0.4, 0, VH);
    fog.addColorStop(0, "rgba(" + Z.glow + ",0)"); fog.addColorStop(1, "rgba(" + Z.glow + ",.07)");
    x.fillStyle = fog; x.fillRect(0, 0, VW, VH);
    var span = L.H * T;
    motes.forEach(function (m) {
      var mx = m.x - cam.x * (0.5 + m.s * 0.5), my = ((m.y - time * 14 * m.s) % span + span) % span - cam.y * (0.5 + m.s * 0.5);
      mx = ((mx % (VW + 60)) + VW + 60) % (VW + 60) - 30;
      if (my < -4 || my > VH + 4) return;
      x.globalAlpha = 0.2 + 0.4 * Math.abs(Math.sin(time + m.ph));
      x.fillStyle = Z.mote; x.fillRect(Math.round(mx), Math.round(my), m.s > 0.7 ? 2 : 1, m.s > 0.7 ? 2 : 1);
    });
    x.globalAlpha = 1;
  }
  function layer(x, img, f, y) {
    if (!img) return;
    var off = -((((cam.x * f) % img.width) + img.width) % img.width);
    for (var bx = off; bx < VW; bx += img.width) x.drawImage(img, Math.round(bx), y);
  }
  function drawNear(x) {
    if (!IMG.near) return;
    x.globalAlpha = 0.5;
    var off = -((((cam.x * 1.15) % 1024) + 1024) % 1024);
    for (var bx = off; bx < VW; bx += 1024) x.drawImage(IMG.near, Math.round(bx), Math.round(VH - 512 + 24));
    x.globalAlpha = 1;
  }
  function drawBreakables(x) {
    var t0 = Math.floor(cam.x / T), t1 = Math.floor((cam.x + VW) / T) + 1, r0 = Math.floor(cam.y / T), r1 = Math.floor((cam.y + VH) / T) + 1;
    for (var ty = r0; ty <= r1; ty++) for (var tx = t0; tx <= t1; tx++) if (tileAt(tx, ty) === "b") {
      var p = TILES.map.rock_centre_b, sx = tx * T - cam.x, sy = ty * T - cam.y;
      x.drawImage(TILES.img, p[0], p[1], 32, 32, sx, sy, 32, 32);
      x.strokeStyle = "rgba(143,244,255," + (0.45 + 0.25 * Math.sin(time * 4 + tx)).toFixed(2) + ")"; x.lineWidth = 1;
      x.beginPath(); x.moveTo(sx + 4, sy + 6); x.lineTo(sx + 14, sy + 14); x.lineTo(sx + 10, sy + 24); x.moveTo(sx + 14, sy + 14); x.lineTo(sx + 26, sy + 10); x.moveTo(sx + 20, sy + 30); x.lineTo(sx + 24, sy + 20); x.stroke();
      if (!solidT(tileAt(tx, ty - 1))) { var q = TILES.map.rock_top; x.drawImage(TILES.img, q[0], q[1], 32, 32, sx, sy - 16, 32, 32); }
    }
  }

  function drawModule(x, it) {
    var sx = Math.round(it.x - cam.x), sy = Math.round(it.y - cam.y + Math.sin(time * 2.5) * 4);
    glow(x, sx, sy, 60, "rgba(255,255,255,.16)"); glow(x, sx, sy, 34, "rgba(" + Z.glow + ",.45)");
    x.save(); x.translate(sx, sy); x.rotate(time * 1.2);
    x.strokeStyle = "#e6fdff"; x.lineWidth = 2; x.beginPath();
    for (var i = 0; i < 6; i++) { var a = i * Math.PI / 3; x[i ? "lineTo" : "moveTo"](Math.cos(a) * 13, Math.sin(a) * 13); }
    x.closePath(); x.stroke(); x.restore();
    x.fillStyle = "#e6fdff"; x.font = "bold 10px 'IBM Plex Mono', monospace"; x.textAlign = "center"; x.textBaseline = "middle";
    x.fillText({ dj: "↑↑", pulse: "))", firewall: "▦", slam: "▼", dash: "»" }[it.ab], sx, sy + 1);
    x.textAlign = "left";
  }

  function drawEnemy(x, e) {
    var set = A[e.kind], fr, bottom = e.y + e.h, cx = e.x + e.w / 2, opt = { flash: e.hurt > 0 && !e.dying }, face = e.face;
    if (e.kind === "bug") {
      fr = e.dying ? frameOf(set.death, e.dieT) : e.hurt > 0 ? frameOf(set.hurt, 0.13 - e.hurt) : e.st === "charge" || e.st === "tell" ? frameOf(set.charge, e.animT) : frameOf(set.walk, e.animT);
      if (e.st === "tell") cx += Math.round(Math.sin(time * 80) * 1.5);
      glow(x, cx - cam.x, bottom - 12 - cam.y, 30, e.st === "charge" || e.st === "tell" ? "rgba(255,45,85,.35)" : "rgba(255,45,85,.14)");
      drawF(x, fr, cx, bottom + 1, face, opt);
    } else if (e.kind === "drone") {
      fr = e.dying ? frameOf(set.death, e.dieT) : e.st === "shoot" ? frameOf(set.shoot, e.animT) : frameOf(set.fly, e.animT);
      glow(x, cx - cam.x, e.y + e.h / 2 - cam.y, 34, "rgba(255,60,60,.2)");
      drawF(x, fr, cx, e.y + e.h / 2, face, opt);
    } else if (e.kind === "brute") {
      fr = e.dying ? frameOf(set.death, e.dieT) : e.hurt > 0 ? frameOf(set.hurt, 0.13 - e.hurt) : e.st === "windup" ? frameOf(set.windup, e.animT) : e.st === "slam" ? frameOf(set.slam, e.animT) : e.st === "walk" ? frameOf(set.walk, e.animT) : frameOf(set.idle, e.animT);
      glow(x, cx - cam.x, bottom - 40 - cam.y, 60, e.st === "windup" ? "rgba(255,120,30,.35)" : "rgba(255,120,30,.15)");
      drawF(x, fr, cx, bottom + 1, face, opt);
    } else if (e.kind === "leak") {
      fr = e.dying ? frameOf(set.death, e.dieT) : frameOf(set.crawl, e.animT);
      glow(x, cx - cam.x, bottom - 8 - cam.y, 30, "rgba(170,60,255,.25)");
      drawF(x, fr, cx, bottom + 1, face, opt);
    } else if (e.kind === "coder") {
      if (e.st === "dormant") { drawF(x, frameOf(set.idle, e.animT), cx, bottom + 1, face, { alpha: 0.35 + 0.15 * Math.sin(time * 3) }); return; }
      fr = e.dying ? frameOf(set.death, e.dieT) : e.hurt > 0 ? frameOf(set.hurt, 0.13 - e.hurt) : e.st === "out" ? frameOf(set.teleport_out, e.animT) : e.st === "in" ? frameOf(set.teleport_in, e.animT) :
        e.st === "tell" ? set.claw.frames[0] : e.st === "claw" ? frameOf(set.claw, e.animT) : e.st === "cast" ? frameOf(set.cast, e.animT) : frameOf(set.idle, e.animT);
      glow(x, cx - cam.x, bottom - 44 - cam.y, e.st === "tell" ? 110 : 80, "rgba(214,60,255," + (e.st === "tell" ? 0.5 : e.phase === 2 ? 0.35 : 0.22) + ")");
      if (e.st === "tell") opt.flash = Math.floor(time * 18) % 2 === 0;
      if (e.phase === 2 && !e.dying && Math.random() < 0.12) drawF(x, fr, cx + (Math.random() * 10 - 5), bottom + 1, face, { alpha: 0.4, add: true });
      drawF(x, fr, cx, bottom + 1, face, opt);
    }
  }

  function playerFrame() {
    var p = P, pa = A.player, ad = A.addon;
    if (p.dead) return frameOf(pa.death, p.deadT);
    if (p.kb > 0 && p.inv > 0.95) return frameOf(pa.hurt, 1.2 - p.inv);
    if (p.dashT > 0) return frameOf(pa.dash, PH.dashT - p.dashT);
    if (p.slam) return p.slam.phase === "land" ? pa.laptop_slam.frames[Math.min(5, 2 + Math.floor(p.slam.t * 14))] : pa.laptop_slam.frames[p.slam.phase === "hop" ? 0 : 1];
    if (p.blocking) return pa.pulse_cast.frames[0];
    if (p.focusT > 0) return frameOf(pa.focus_heal, p.focusT);
    if (p.slashT > 0) { var sa = p.slashDir === "u" ? pa.slash_up : p.slashDir === "d" ? pa.slash_down_air : pa.slash_forward; return sa.frames[Math.min(sa.frames.length - 1, Math.floor((0.26 - p.slashT) / 0.26 * sa.frames.length))]; }
    if (p.castT > 0) { var ca = p.castKind === "pulse" ? pa.pulse_cast : pa.firewall_summon; return ca.frames[Math.min(ca.frames.length - 1, Math.floor((1 - p.castT / 0.35) * ca.frames.length))]; }
    if (p.sliding) return frameOf(ad.wall_slide, p.anim);
    if (p.kickT > 0) return frameOf(ad.wall_jump_kick, 0.22 - p.kickT);
    if (!p.ground) {
      if (p.flipT >= 0 && p.flipT < 0.1) return frameOf(ad.double_jump_start, p.flipT);
      if (p.flipT >= 0.1 && p.flipT < 0.1 + 6 / 14) return frameOf(pa.double_jump_frontflip, p.flipT - 0.1);
      if (p.vy < 0) return pa.jump_rise.frames[p.vy < -420 ? 0 : p.vy < -180 ? 1 : 2];
      return pa.fall.frames[Math.min(2, Math.floor(p.vy / 220))];
    }
    if (p.landT > 0) return frameOf(pa.land, 0.12 - p.landT);
    if (Math.abs(p.vx) > 20) return frameOf(pa.run, p.runT);
    return frameOf(pa.idle, time);
  }

  function drawPlayer(x) {
    var p = P;
    if (p.dead && p.deadT > 1.0) return;
    if (p.hazT > 0 && Math.floor(time * 20) % 2) return;
    var fr = playerFrame();
    var cx = p.x + p.w / 2, by = p.y + p.h;
    glow(x, cx - cam.x, by - 26 - cam.y, 70, "rgba(0,180,210,.1)");
    p.ghosts.forEach(function (g) { drawF(x, A.player.dash.frames[1], g.x + p.w / 2, g.y + p.h, g.face, { alpha: 0.35 * (1 - g.t / 0.25), add: true }); });
    var opt = {};
    if (p.inv > 0 && p.dashT <= 0 && !p.dead && Math.floor(time * 16) % 2) opt.alpha = 0.45;
    if (p.sliding) {
      // keep his back flush against the wall
      if (p.wallDir < 0) drawF(x, fr, p.x - fr.minx + fr.px - 1, by, 1, opt);
      else drawF(x, fr, p.x + p.w + fr.minx - fr.px + 1, by, -1, opt);
    } else drawF(x, fr, cx, by, p.face, opt);
    if (p.blocking || p.blockFlash > 0) drawShield(x, p);
    if (p.focusT > 0) glow(x, cx - cam.x, by - 24 - cam.y, 40 + p.focusT * 40, "rgba(143,244,255," + (0.12 + p.focusT * 0.25).toFixed(2) + ")");
  }

  // the Debug Shield: a hexagonal energy pane in front of the hero
  function drawShield(x, p) {
    var sx = Math.round(p.x + p.w / 2 + p.face * 22 - cam.x), sy = Math.round(p.y + 22 - cam.y);
    var pulse = p.blockFlash > 0 ? 1 : 0.55 + 0.15 * Math.sin(time * 18);
    glow(x, sx, sy, 34, "rgba(0,229,255," + (0.25 * pulse).toFixed(2) + ")");
    x.save(); x.translate(sx, sy); x.globalCompositeOperation = "lighter";
    x.strokeStyle = "rgba(143,244,255," + pulse.toFixed(2) + ")"; x.lineWidth = 2;
    x.beginPath(); x.moveTo(0, -24); x.lineTo(p.face * 8, -12); x.lineTo(p.face * 8, 12); x.lineTo(0, 24); x.stroke();
    x.strokeStyle = "rgba(0,229,255," + (pulse * 0.5).toFixed(2) + ")"; x.lineWidth = 1;
    for (var i = -2; i <= 2; i++) { x.beginPath(); x.moveTo(p.face * 2, i * 8 - 3); x.lineTo(p.face * 6, i * 8 + 3); x.stroke(); }
    x.restore();
  }

  function glow(x, cx, cy, r, color) {
    if (cx < -r || cx > VW + r || cy < -r || cy > VH + r) return;
    var g = x.createRadialGradient(cx, cy, 0, cx, cy, r);
    g.addColorStop(0, color); g.addColorStop(1, "rgba(0,0,0,0)");
    x.globalCompositeOperation = "lighter";
    x.fillStyle = g; x.fillRect(cx - r, cy - r, r * 2, r * 2);
    x.globalCompositeOperation = "source-over";
  }

  function signs() {
    if (state !== "play") return;
    ctx.textAlign = "center"; ctx.textBaseline = "middle";
    ctx.font = "500 " + Math.round(12 * scale) + "px 'IBM Plex Mono', monospace";
    L.spec.signs.forEach(function (s) {
      var wx = s[0] * T, wy = s[1] * T;
      var d = Math.hypot(P.x - wx, (P.y - wy) * 0.6);
      if (d > 340) return;
      var a = Math.max(0, Math.min(1, (340 - d) / 140));
      ctx.fillStyle = "rgba(0,0,0," + (a * 0.5).toFixed(2) + ")";
      ctx.fillText(s[2], (wx - cam.x) * scale + 1, (wy - cam.y) * scale + 1);
      ctx.fillStyle = "rgba(220,250,255," + (a * 0.9).toFixed(2) + ")";
      ctx.fillText(s[2], (wx - cam.x) * scale, (wy - cam.y) * scale);
    });
    ctx.textAlign = "left";
  }

  function hud() {
    var u = hudU, c = ctx, x0 = Math.round(16 * u), y0 = Math.round(14 * u);
    var R = 13 * u, cx = x0 + R, cy = y0 + R;
    c.fillStyle = "rgba(5,10,16,.75)"; c.beginPath(); c.arc(cx, cy, R, 0, Math.PI * 2); c.fill();
    c.save(); c.beginPath(); c.arc(cx, cy, R - 2 * u, 0, Math.PI * 2); c.clip();
    var lvl = P.ram / RAM_MAX, top = cy + (R - 2 * u) - lvl * (R - 2 * u) * 2;
    c.fillStyle = "#8ff4ff"; c.fillRect(cx - R, top + Math.sin(time * 4) * u, R * 2, R * 2);
    c.restore();
    c.strokeStyle = "#e7ebf2"; c.lineWidth = Math.max(1, u * 1.2); c.beginPath(); c.arc(cx, cy, R, 0, Math.PI * 2); c.stroke();
    for (var i = 0; i < MAX_HP; i++) {
      var hx = cx + R + 9 * u + i * 13 * u, hy = cy - 8 * u, s = u * 1.15;
      c.fillStyle = i < P.hp ? "#e7ebf2" : "rgba(231,235,242,.15)";
      c.beginPath();
      c.moveTo(hx + 4 * s, hy); c.lineTo(hx + 8 * s, hy + 2.5 * s); c.lineTo(hx + 8 * s, hy + 8 * s); c.lineTo(hx + 4 * s, hy + 11 * s); c.lineTo(hx, hy + 8 * s); c.lineTo(hx, hy + 2.5 * s); c.closePath();
      c.fill();
      if (i < P.hp) { c.fillStyle = "#00e5ff"; c.fillRect(hx + 3 * s, hy + 4 * s, 2 * s, 3 * s); }
    }
    c.font = "500 " + Math.round(9 * u) + "px 'IBM Plex Mono', monospace"; c.textBaseline = "middle";
    c.fillStyle = "#8ff4ff"; c.fillText("◆ " + Object.keys(run.shards).length, cx + R + 9 * u, cy + 15 * u);
    var ab = [["block", "Q"], ["dj", "↑↑"], ["pulse", "F"], ["firewall", "C"], ["slam", "V"], ["dash", "»"]].filter(function (a) { return a[0] === "block" || run.abilities[a[0]]; });
    c.font = "600 " + Math.round(7.5 * u) + "px 'IBM Plex Mono', monospace";
    ab.forEach(function (a, i) {
      var bx = cx + R + 40 * u + i * 20 * u, by = cy + 10 * u;
      c.strokeStyle = "rgba(143,244,255,.55)"; c.lineWidth = Math.max(1, u * 0.8); c.strokeRect(bx, by, 16 * u, 11 * u);
      c.fillStyle = "#e7ebf2"; c.textAlign = "center"; c.fillText(a[1], bx + 8 * u, by + 6 * u); c.textAlign = "left";
    });
    c.font = "500 " + Math.round(9 * u) + "px 'IBM Plex Mono', monospace";
    c.fillStyle = "rgba(231,235,242,.55)"; c.textAlign = "right";
    c.fillText(Z.tag + " · " + fmtTime(Math.floor(run.time)), cv.width - x0, y0 + 6 * u);
    c.textAlign = "left";
    var boss = enemies.filter(function (e) { return e.kind === "coder" && e.alive && e.st !== "dormant"; })[0];
    if (boss) {
      var bw = cv.width * 0.5, bx2 = (cv.width - bw) / 2, by2 = cv.height - 26 * u;
      c.fillStyle = "rgba(5,10,16,.8)"; c.fillRect(bx2 - 2 * u, by2 - 2 * u, bw + 4 * u, 10 * u);
      c.fillStyle = "#d63cff"; c.fillRect(bx2, by2, bw * Math.max(0, boss.hp) / boss.maxHp, 6 * u);
      c.font = Math.round(13 * u) + "px 'Bebas Neue', sans-serif"; c.fillStyle = "#f3d6ff"; c.textAlign = "center";
      c.fillText("CORRUPTED CODER", cv.width / 2, by2 - 9 * u); c.textAlign = "left";
    }
    if (titleT < 4.2 && state === "play") {
      var a2 = titleT < 0.8 ? titleT / 0.8 : titleT > 3.2 ? Math.max(0, 4.2 - titleT) : 1;
      c.globalAlpha = a2; c.textAlign = "center";
      c.fillStyle = "#e7ebf2"; c.font = Math.round(44 * u) + "px 'Bebas Neue', sans-serif";
      c.fillText(Z.name, cv.width / 2, cv.height * 0.32);
      c.font = "500 " + Math.round(8 * u) + "px 'IBM Plex Mono', monospace"; c.fillStyle = Z.mote;
      c.fillText("— " + Z.tag + " —", cv.width / 2, cv.height * 0.32 - 30 * u);
      c.strokeStyle = "rgba(231,235,242,.6)"; c.lineWidth = Math.max(1, u * 0.6);
      c.beginPath(); c.moveTo(cv.width / 2 - 80 * u, cv.height * 0.32 + 24 * u); c.lineTo(cv.width / 2 + 80 * u, cv.height * 0.32 + 24 * u); c.stroke();
      c.globalAlpha = 1; c.textAlign = "left";
    }
    if (banner && time - banner.at < (banner.big ? 3.6 : 2.4)) {
      var dur = banner.big ? 3.6 : 2.4, ba = Math.min(1, (dur - (time - banner.at)) * 2, (time - banner.at) * 4);
      c.globalAlpha = ba; c.textAlign = "center";
      c.font = Math.round((banner.big ? 26 : 20) * u) + "px 'Bebas Neue', sans-serif"; c.fillStyle = "#e7ebf2";
      var byB = boss ? cv.height * 0.6 : cv.height * 0.74;
      c.fillText(banner.t.toUpperCase(), cv.width / 2, byB);
      c.font = "500 " + Math.round(8 * u) + "px 'IBM Plex Mono', monospace"; c.fillStyle = "#8ff4ff";
      c.fillText(banner.s, cv.width / 2, byB + 17 * u);
      c.globalAlpha = 1; c.textAlign = "left";
    }
  }

  /* ======================================================================= LOOP + UI */

  function frame(now) {
    if (!running) return;
    var dt = last ? Math.min(0.1, (now - last) / 1000) : STEP;
    last = now; acc += dt;
    var n = 0;
    while (acc >= STEP && n < 14) { if (L && state !== "paused") step(); acc -= STEP; n++; }
    if (ready && L) render(); else { ctx.fillStyle = "#05080d"; ctx.fillRect(0, 0, cv.width, cv.height); }
    raf = requestAnimationFrame(frame);
  }

  function resize() {
    if (!cv) return;
    var r = cv.getBoundingClientRect();
    if (r.width < 2 || r.height < 2) return;
    var dpr = Math.min(2, window.devicePixelRatio || 1);
    cv.width = Math.round(r.width * dpr); cv.height = Math.round(r.height * dpr);
    scale = cv.height / VH; hudU = cv.height / 270;
    VW = Math.ceil(cv.width / scale);
    low.width = VW; low.height = VH;
    lc.imageSmoothingEnabled = false;
    clampCam();
  }

  function showOverlay(a, b, c) {
    if (!ui.ov) return;
    ui.ov.style.display = "flex"; ui.t.textContent = a; ui.l1.textContent = b; ui.l2.textContent = c;
  }
  function hideOverlay() { if (ui.ov) ui.ov.style.display = "none"; }

  function updateTouchButtons() {
    (ui.touch || []).forEach(function (b) {
      var need = { pulse: 1, firewall: 1, slam: 1, dash: 1 }[b.dataset.k] ? b.dataset.k : null;
      b.style.display = need && !(run && run.abilities[need]) ? "none" : "";
    });
  }

  function showTitle() {
    state = "title";
    var touch = window.matchMedia("(pointer: coarse)").matches, save = loadSave();
    showOverlay("DEV RUN",
      touch ? "◀ ▶ move · ▲ ▼ aim · A jump (again in mid-air, or off a wall) · B attack · Q block · R heal"
        : "W A S D move · ARROWS turn + aim · SPACE jump · E attack · F shoot · Q block/parry · R heal · ESC pause",
      (touch ? (window.innerHeight > window.innerWidth ? "tip: turn your phone sideways · " : "") + "tap to start" : "SPACE: new game") + (save ? " · " + (touch ? "R: " : "C: ") + "continue zone " + (save.zone + 1) : "") + " · 3 zones + a boss");
  }

  function startGame(cont) {
    newRun();
    var save = cont ? loadSave() : null;
    if (save) { run.abilities = save.abilities || {}; run.shards = save.shards || {}; run.deaths = save.deaths || 0; run.time = save.time || 0; }
    P = null;
    enterZone(save ? save.zone : 0);
    state = "play"; hideOverlay(); updateTouchButtons();
  }

  var KEYMAP = {
    // WASD moves (and aims when no arrow is held); arrows only aim, so you can shoot without walking
    KeyA: "left", KeyD: "right", KeyW: "up", KeyS: "down", ArrowLeft: "aimL", ArrowRight: "aimR", ArrowUp: "aimU", ArrowDown: "aimD",
    Space: "jump", KeyK: "jump", KeyE: "slash", KeyF: "pulse", KeyR: "focus", KeyC: "firewall", KeyO: "firewall",
    KeyV: "slam", KeyU: "slam", KeyQ: "block", ShiftLeft: "dash", ShiftRight: "dash", KeyL: "dash",
  };
  function onKey(e, down) {
    if (!running) return;
    if (e.code === "Escape") {
      // first Esc pauses, a second Esc exits; on the title screen Esc just closes the window
      if (state !== "play" && state !== "dead" && state !== "paused") return;
      e.preventDefault(); e.stopImmediatePropagation();
      if (down) { if (state !== "paused") pause(); else if (menu.dataset.screen === "main") menuAction("resume"); else showMenu("main", menu.dataset.screen === "help" ? 3 : 2); }
      return;
    }
    if (state === "paused") { e.preventDefault(); e.stopImmediatePropagation(); if (down) menuKey(e.code); return; }
    if (down && (state === "title" || state === "won")) {
      if (e.code === "Space" || e.code === "Enter") { e.preventDefault(); e.stopPropagation(); if (ready) startGame(false); return; }
      if (e.code === "KeyC" && state === "title" && loadSave()) { e.preventDefault(); e.stopPropagation(); if (ready) startGame(true); return; }
    }
    var a = KEYMAP[e.code];
    if (!a) { if (state === "play" || state === "dead") e.stopImmediatePropagation(); return; }   // e.g. X would glitch the page behind
    e.preventDefault(); e.stopPropagation();
    if (down && !keys[a]) pressed[a] = true;
    keys[a] = down;
  }
  function press(a, down) {
    if (down && (state === "title" || state === "won")) { if (ready) startGame(state === "title" && a === "focus" && !!loadSave()); return; }
    if (down && !keys[a]) pressed[a] = true;
    keys[a] = down;
  }

  /* ---- pause menu (Esc) ---- */
  var menu = null, menuBtns = [], menuSel = 0, pausedFrom = "play";
  var MENUS = {
    main: { title: "PAUSED", items: [["resume", "Resume"], ["checkpoint", "Restart from last checkpoint"], ["full", "Restart full game"], ["help", "Instructions"], ["exit", "Exit"]],
      note: "↑ ↓ choose · enter select · esc resumes" },
    help: { title: "INSTRUCTIONS", items: [["back", "Back"]], note: "esc or enter to go back", help: true },
    confirm: { title: "ARE YOU SURE?", sub: "Restarting the full game wipes this run and your saved progress.", items: [["yes", "Yes"], ["no", "No"]], row: true,
      note: "← → choose · enter select · esc goes back" },
  };
  function buildMenu() {
    menu = document.createElement("div"); menu.className = "g-menu"; menu.hidden = true;
    menu.setAttribute("role", "dialog"); menu.setAttribute("aria-label", "Pause menu");
    menu.addEventListener("pointerdown", function (e) { e.stopPropagation(); });
    cv.parentNode.appendChild(menu);
    var pb = document.createElement("button");   // phones have no Esc key
    pb.type = "button"; pb.className = "g-pausebtn"; pb.setAttribute("aria-label", "Pause"); pb.textContent = "❚❚";
    pb.addEventListener("pointerdown", function (e) { e.preventDefault(); e.stopPropagation(); pause(); });
    cv.parentNode.appendChild(pb);
  }
  function showMenu(name, sel) {
    var m = MENUS[name], h = "<b>" + m.title + "</b>" + (m.sub ? "<p>" + m.sub + "</p>" : "") + (m.help ? helpHTML() : "");
    menu.dataset.screen = name;
    h += '<div class="g-mlist' + (m.row ? " g-mrow" : "") + '">' + m.items.map(function (it) { return '<button type="button" class="g-mi" data-a="' + it[0] + '">' + it[1] + "</button>"; }).join("") + "</div>";
    menu.innerHTML = h + "<small>" + m.note + "</small>";
    menuBtns = [].slice.call(menu.querySelectorAll(".g-mi"));
    menuBtns.forEach(function (b, i) {
      b.addEventListener("pointerenter", function () { selectItem(i); });
      b.addEventListener("click", function () { menuAction(b.dataset.a); });
    });
    menu.hidden = false;
    selectItem(sel == null ? (name === "confirm" ? 1 : 0) : sel);   // the confirm screen starts on "No"
  }
  // every control, with abilities not yet found dimmed
  function helpHTML() {
    var touch = window.matchMedia("(pointer: coarse)").matches, has = function (a) { return !a || run.abilities[a]; };
    var rows = [
      [touch ? "◀ ▶" : "W A S D", "move · S + jump drops through grates"],
      [touch ? "▲ ▼" : "ARROWS", touch ? "aim" : "turn and aim, standing still"],
      [touch ? "A" : "SPACE", "jump · again in mid-air · jump into a wall, then again to kick off"],
      [touch ? "B" : "E", "attack · aim up, or down in mid-air to bounce off enemies"],
      ["Q", "hold to block · tap just before a hit to parry and stun"],
      ["R", "hold to regenerate health · uses RAM (the blue orb)"],
      [touch ? "X" : "F", "shoot a debug pulse · uses RAM", "pulse"],
      ["C", "firewall · a wall that stops every projectile", "firewall"],
      ["V", "laptop slam · smashes cracked floors", "slam"],
      [touch ? "»" : "SHIFT", "cache dash · fast, works in mid-air, hurts what it hits", "dash"],
      [touch ? "" : "ESC", touch ? "" : "pause"],
    ].filter(function (r) { return r[0]; });
    return '<dl class="g-help">' + rows.map(function (r) {
      var ok = has(r[2]);
      return '<div' + (ok ? "" : ' class="off"') + "><dt>" + r[0] + "</dt><dd>" + r[1] + (ok ? "" : " · not found yet") + "</dd></div>";
    }).join("") + '</dl><p class="g-tips">Terminals save and heal you. The boss flashes before it claws: block or parry, then strike.</p>';
  }
  function selectItem(i) {
    menuSel = (i + menuBtns.length) % menuBtns.length;
    menuBtns.forEach(function (b, j) { b.classList.toggle("sel", j === menuSel); });
  }
  function menuKey(code) {
    if (code === "ArrowUp" || code === "KeyW" || code === "ArrowLeft" || code === "KeyA") selectItem(menuSel - 1);
    else if (code === "ArrowDown" || code === "KeyS" || code === "ArrowRight" || code === "KeyD" || code === "Tab") selectItem(menuSel + 1);
    else if (code === "Enter" || code === "NumpadEnter" || code === "Space") menuAction(menuBtns[menuSel].dataset.a);
  }
  function releaseKeys() { Object.keys(keys).forEach(function (k) { keys[k] = false; pressed[k] = false; }); }
  function pause() {
    if (state !== "play" && state !== "dead") return;
    pausedFrom = state; state = "paused"; releaseKeys(); showMenu("main");
  }
  function closeMenu() { if (menu) menu.hidden = true; releaseKeys(); last = 0; acc = 0; }
  function menuAction(a) {
    if (a === "resume") { closeMenu(); state = pausedFrom; }
    else if (a === "checkpoint") {
      closeMenu(); fadeTo = null; fade = 1; spawn(); state = "play";
      banner = { t: "back online", s: "restarted at the last terminal", at: time };
    }
    else if (a === "full") showMenu("confirm");
    else if (a === "no") showMenu("main", 2);
    else if (a === "help") showMenu("help");
    else if (a === "back") showMenu("main", 3);
    else if (a === "yes") {
      try { localStorage.removeItem("anb_devrun_save"); } catch (_) {}
      closeMenu(); fadeTo = null; fade = 1; startGame(false);
    }
    else if (a === "exit") exitGame();
  }
  // leaves the game paused, so reopening the window brings the menu back
  function exitGame() { releaseKeys(); if (onExit) onExit(); }
  var onExit = null;

  window.ANBGame = {
    init: function (opts) {
      cv = opts.canvas; ctx = cv.getContext("2d");
      low = document.createElement("canvas"); lc = low.getContext("2d");
      ui = opts.ui || {}; ui.touch = opts.touch || []; root = opts.root || ""; onExit = opts.onExit || null;
      buildMenu();
      if (ui.best) ui.best.textContent = best ? fmtTime(best) : "–";
      ZONES.forEach(function (zn) { TOTAL_SHARDS += zn.build().shards.length; });
      document.addEventListener("keydown", function (e) { onKey(e, true); }, true);
      document.addEventListener("keyup", function (e) { onKey(e, false); }, true);
      cv.addEventListener("pointerdown", function (e) { if (e.pointerType === "mouse" && (state === "title" || state === "won") && ready) { e.preventDefault(); startGame(false); } });
      ui.touch.forEach(function (b) {
        var k = b.dataset.k;
        var on = function (e) { e.preventDefault(); b.classList.add("on"); press(k, true); };
        var off = function (e) { e.preventDefault(); b.classList.remove("on"); press(k, false); };
        b.addEventListener("pointerdown", on); b.addEventListener("pointerup", off);
        b.addEventListener("pointercancel", off); b.addEventListener("pointerleave", off);
      });
      if (window.ResizeObserver) new ResizeObserver(function () { if (running) resize(); }).observe(cv);
      newRun(); updateTouchButtons();
    },
    open: function () {
      if (!cv) return;
      running = true; last = 0; acc = 0;
      resize();
      if (state !== "play" && state !== "dead" && state !== "paused") {
        state = "title";
        showOverlay("DEV RUN", "loading sprites…", "");
        loadAssets(root).then(function () { if (state === "title") showTitle(); },
          function () { showOverlay("DEV RUN", "couldn't load the game art", "check your connection and reopen"); });
      }
      cancelAnimationFrame(raf); raf = requestAnimationFrame(frame);
    },
    close: function () {
      running = false; cancelAnimationFrame(raf);
      Object.keys(keys).forEach(function (k) { keys[k] = false; });
    },

    /* ---- hooks for automated checks: run the simulation without waiting for frames ---- */
    _load: function () { return loadAssets(root); },
    _start: function (zone, abilities) { newRun(); run.abilities = abilities || {}; P = null; enterZone(zone || 0); state = "play"; hideOverlay(); updateTouchButtons(); },
    _sim: function (seconds, input) {
      Object.keys(keys).forEach(function (k) { keys[k] = !!(input && input[k]); });
      ["jump", "slash", "pulse", "firewall", "slam", "dash"].forEach(function (k) { if (input && input["press" + k[0].toUpperCase() + k.slice(1)]) pressed[k] = true; });
      for (var t = 0; t < seconds - 1e-9; t += STEP) step();
      return { state: state, zone: zoneIndex, x: Math.round(P.x), y: Math.round(P.y), tx: Math.floor((P.x + P.w / 2) / T), ty: Math.floor((P.y + P.h - 1) / T), ground: P.ground,
        hp: P.hp, ram: P.ram, sliding: P.sliding, enemies: enemies.filter(function (e) { return e.alive && !e.dying; }).length, deaths: run.deaths };
    },
    _teleport: function (tx, ty) { P.x = tx * T + 6; P.y = (ty + 1) * T - P.h; P.vx = 0; P.vy = 0; P.slam = null; P.dashT = 0; P.hazT = 0; cam.x = P.x - VW / 2; cam.y = P.y - VH / 2; clampCam(); },
    _p: function () { return P; }, _enemies: function () { return enemies; }, _tile: function (tx, ty) { return tileAt(tx, ty); },
    _level: function () { return L; }, _art: function () { return ART; }, _run: function () { return run; }, _state: function () { return state; },
  };
})();
