/* anuragbhandary.github.io: all interactions, no dependencies. */
(function () {
  "use strict";

  var doc = document.documentElement;
  doc.classList.add("js");
  // Chromium can run SVG filters inside backdrop-filter (the liquid-glass refraction).
  var brands = (navigator.userAgentData && navigator.userAgentData.brands) || [];
  if (brands.some(function (b) { return /Chromium/.test(b.brand); })) doc.classList.add("lg");

  var CFG = window.ANB || {};
  var reduced = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  var fine = window.matchMedia("(pointer: fine)").matches;
  var $ = function (s, r) { return (r || document).querySelector(s); };
  var $$ = function (s, r) { return Array.prototype.slice.call((r || document).querySelectorAll(s)); };
  var store = {
    get: function (k) { try { return localStorage.getItem(k); } catch (_) { return null; } },
    set: function (k, v) { try { localStorage.setItem(k, v); } catch (_) {} },
    sget: function (k) { try { return sessionStorage.getItem(k); } catch (_) { return null; } },
    sset: function (k, v) { try { sessionStorage.setItem(k, v); } catch (_) {} }
  };
  var isDesktopLayout = function () { return window.innerWidth > 900; };
  var cssVar = function (n) { return getComputedStyle(doc).getPropertyValue(n).trim(); };

  /* ---------------------------------------------------------------- theme */
  var themeBtn = $("#themeToggle"), themeTip = $("#themeTip");
  var themeListeners = [];
  function syncThemeTip() {
    if (themeTip) themeTip.textContent = doc.dataset.theme === "light" ? "Dark mode" : "Light mode";
  }
  syncThemeTip();
  function setTheme(t) {
    doc.dataset.theme = t;
    store.set("anb-theme", t);
    syncThemeTip();
    themeListeners.forEach(function (f) { f(t); });
  }
  if (themeBtn) themeBtn.addEventListener("click", function () {
    var next = doc.dataset.theme === "light" ? "dark" : "light";
    if (!document.startViewTransition || reduced) { setTheme(next); return; }
    var r = themeBtn.getBoundingClientRect();
    var x = r.left + r.width / 2, y = r.top + r.height / 2;
    var end = Math.hypot(Math.max(x, innerWidth - x), Math.max(y, innerHeight - y));
    doc.classList.add("theming");
    var vt = document.startViewTransition(function () { setTheme(next); });
    vt.ready.then(function () {
      doc.animate(
        { clipPath: ["circle(0px at " + x + "px " + y + "px)", "circle(" + end + "px at " + x + "px " + y + "px)"] },
        { duration: 700, easing: "cubic-bezier(.2,.7,.1,1)", pseudoElement: "::view-transition-new(root)" }
      );
    }).catch(function () {});
    vt.finished.finally(function () { doc.classList.remove("theming"); });
  });

  /* ---------------------------------------------------------------- clock */
  var clock = $("#clock");
  function tickClock() {
    if (!clock) return;
    clock.textContent = new Date().toLocaleTimeString("en-GB", { hour: "2-digit", minute: "2-digit", hour12: false, timeZone: "Asia/Kolkata" });
  }
  tickClock();
  setInterval(tickClock, 10000);

  /* ------------------------------------------------- dock: magnify + active */
  var dock = $("#dock");
  var dockItems = $$(".dk:not(.dk-theme)", dock || document);
  if (dock && fine && !reduced) {
    // Measure resting centres once per hover, so growing icons don't shift their own targets.
    var centres = [];
    dock.addEventListener("pointerenter", function () {
      centres = dockItems.map(function (it) { var r = it.getBoundingClientRect(); return r.left + r.width / 2; });
    });
    dock.addEventListener("pointermove", function (e) {
      if (!isDesktopLayout()) return;
      dockItems.forEach(function (it, i) {
        var r = it.getBoundingClientRect();
        var c = centres[i] != null ? centres[i] : r.left + r.width / 2;
        var d = Math.abs(e.clientX - c);
        var k = 1 + 0.5 * Math.max(0, Math.cos(Math.min(d / 140, 1) * Math.PI / 2));
        it.style.setProperty("--k", k.toFixed(3));
      });
    });
    dock.addEventListener("pointerleave", function () {
      dockItems.forEach(function (it) { it.style.setProperty("--k", "1"); });
    });
  }
  var navLinks = $$(".dk[data-nav]");
  var sections = CFG.page === "home" ? navLinks.map(function (a) { return document.getElementById(a.dataset.nav); }).filter(Boolean) : [];
  function onScrollNav() {
    if (!sections.length) return;
    var active = null;
    sections.forEach(function (s) { if (s.getBoundingClientRect().top < innerHeight * 0.45) active = s.id; });
    navLinks.forEach(function (a) { a.classList.toggle("active", a.dataset.nav === active); });
  }
  window.addEventListener("scroll", onScrollNav, { passive: true });
  onScrollNav();

  /* --------------------------------------------------------------- reveal */
  var revealHooks = [];
  var reveals = $$(".reveal, .ct-grid, .lc-heat");
  function revealed(el) {
    el.classList.add("in");
    revealHooks.forEach(function (f) { f(el); });
  }
  if ("IntersectionObserver" in window && !reduced) {
    var io = new IntersectionObserver(function (entries) {
      entries.forEach(function (en) {
        if (en.isIntersecting) { revealed(en.target); io.unobserve(en.target); }
      });
    }, { rootMargin: "0px 0px -8% 0px" });
    reveals.forEach(function (el) { io.observe(el); });
  } else {
    setTimeout(function () { reveals.forEach(revealed); }, 0);
  }

  /* --------------------------------------------------------- logo replay */
  function replayLogo(el) {
    var lg = el.classList.contains("logo") ? el : $(".logo", el);
    if (!lg || reduced) return;
    lg.classList.remove("assemble");
    void lg.offsetWidth;
    lg.classList.add("assemble");
  }
  $$(".dk-home, .sys-head").forEach(function (a) { a.addEventListener("mouseenter", function () { replayLogo(a); }); });

  /* ------------------------------------------------------- glitch burst */
  var bursting = false;
  function burst() {
    if (bursting || reduced) return;
    var els = $$(".gw-g, .ph-g");
    if (!els.length) return;
    bursting = true;
    els.forEach(function (el) { el.style.animation = "none"; });
    var n = 0;
    var id = setInterval(function () {
      els.forEach(function (el) {
        el.style.transform = "translate(" + (Math.random() * 18 - 9).toFixed(0) + "px," + (Math.random() * 6 - 3).toFixed(0) + "px)";
        el.style.opacity = String(0.35 + Math.random() * 0.5);
        el.style.clipPath = "inset(" + (Math.random() * 60).toFixed(0) + "% 0 " + (Math.random() * 30).toFixed(0) + "% 0)";
      });
      if (++n > 11) {
        clearInterval(id);
        els.forEach(function (el) { el.style.transform = ""; el.style.opacity = ""; el.style.animation = ""; el.style.clipPath = ""; });
        bursting = false;
      }
    }, 45);
  }
  $$("#glitchName, .ct-title").forEach(function (el) { el.addEventListener("mouseenter", burst); });

  /* ------------------------------------------ card spotlight + contact tilt */
  document.addEventListener("pointermove", function (e) {
    var c = e.target.closest && e.target.closest(".card");
    if (!c) return;
    var r = c.getBoundingClientRect();
    c.style.setProperty("--mx", (e.clientX - r.left).toFixed(0) + "px");
    c.style.setProperty("--my", (e.clientY - r.top).toFixed(0) + "px");
  }, { passive: true });
  if (fine && !reduced) {
    $$(".ct-card:not(.ct-mail)").forEach(function (c) {
      c.addEventListener("pointermove", function (e) {
        var r = c.getBoundingClientRect();
        var px = (e.clientX - r.left) / r.width - 0.5, py = (e.clientY - r.top) / r.height - 0.5;
        c.classList.add("tilting");
        c.style.transform = "perspective(900px) rotateY(" + (px * 12).toFixed(2) + "deg) rotateX(" + (-py * 12).toFixed(2) + "deg) translateZ(6px)";
      });
      c.addEventListener("pointerleave", function () {
        c.classList.remove("tilting");
        c.style.transform = "";
      });
    });
  }

  /* -------------------------------------------------------- copy email */
  var copyBtn = $("#copyMail");
  if (copyBtn) copyBtn.addEventListener("click", function () {
    var done = function () { copyBtn.textContent = "copied ✓"; setTimeout(function () { copyBtn.textContent = "copy"; }, 1800); };
    if (navigator.clipboard) navigator.clipboard.writeText(CFG.email).then(done, function () {});
  });

  /* ---------------------------------------------------------- skills */
  var bento = $(".bento");
  if (bento) {
    $$(".sk-card", bento).forEach(function (card) {
      $$(".skill", card).forEach(function (s, j) { s.style.setProperty("--j", j); });
    });
    bento.addEventListener("pointerover", function (e) { if (e.target.closest(".skill")) bento.classList.add("dim"); });
    bento.addEventListener("pointerout", function (e) { if (e.target.closest(".skill")) bento.classList.remove("dim"); });
  }

  /* --------------------------------------------------------- LeetCode */
  var lcCard = $("#leetcode");
  if (lcCard) {
    fetch(CFG.root + "assets/data/leetcode.json?h=" + Math.floor(Date.now() / 3.6e6))
      .then(function (r) { if (!r.ok) throw new Error(r.status); return r.json(); })
      .then(renderLeetCode)
      .catch(function () {
        $("#lcLabel").textContent = "stats offline";
        $(".lc-meta", lcCard).innerHTML = '<a href="https://leetcode.com/u/anuragb2901/" target="_blank" rel="noopener">see my profile on LeetCode ↗</a>';
      });
  }
  function renderLeetCode(d) {
    var NS = "http://www.w3.org/2000/svg";
    var g = $("#lcArcs"), ring = $(".lc-ring", lcCard);
    var diffs = [["Easy", "easy"], ["Medium", "med"], ["Hard", "hard"]];
    var cx = 100, cy = 100, R = 84, start = 135, sweep = 270, gap = 7;
    var totalQ = d.total.Easy + d.total.Medium + d.total.Hard;
    var usable = sweep - gap * (diffs.length - 1);
    var a0 = start, arcs = {};
    function pt(a) { var t = a * Math.PI / 180; return [cx + R * Math.cos(t), cy + R * Math.sin(t)]; }
    function arcPath(a, b) {
      var p = pt(a), q = pt(b);
      return "M" + p[0].toFixed(2) + " " + p[1].toFixed(2) + " A" + R + " " + R + " 0 " + (b - a > 180 ? 1 : 0) + " 1 " + q[0].toFixed(2) + " " + q[1].toFixed(2);
    }
    diffs.forEach(function (df) {
      var span = usable * d.total[df[0]] / totalQ;
      var a1 = a0 + span;
      var len = R * (span * Math.PI / 180);
      var trk = document.createElementNS(NS, "path");
      trk.setAttribute("d", arcPath(a0, a1)); trk.setAttribute("class", "trk");
      var arc = document.createElementNS(NS, "path");
      arc.setAttribute("d", arcPath(a0, a1)); arc.setAttribute("class", "arc " + df[1]);
      arc.style.strokeDasharray = len.toFixed(2) + " " + (len + 10).toFixed(2);
      arc.style.strokeDashoffset = len.toFixed(2);
      g.appendChild(trk); g.appendChild(arc);
      arcs[df[0]] = { el: arc, len: len, frac: Math.min(1, d.solved[df[0]] / Math.max(1, d.total[df[0]])) };
      a0 = a1 + gap;
    });
    diffs.forEach(function (df) {
      $('[data-t="' + df[0] + '"]', lcCard).textContent = "/" + d.total[df[0]];
    });
    $("#lcOf").textContent = "/" + d.total.All;
    $("#lcStreak").textContent = d.streak;
    $("#lcDays").textContent = d.activeDays;
    $("#lcRank").textContent = Number(d.ranking).toLocaleString("en-US");
    var hrs = Math.max(0, Math.round((Date.now() / 1000 - d.updated) / 3600));
    $("#lcUpd").textContent = "updated " + (hrs < 1 ? "just now" : hrs < 48 ? hrs + "h ago" : Math.round(hrs / 24) + "d ago");

    // heatmap: last 52 weeks (26 on small screens), columns are weeks, rows Sun..Sat
    var heat = $("#lcHeat");
    var weeks = innerWidth < 640 ? 26 : 52;
    var DAY = 86400, now = new Date();
    var todayUTC = Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()) / 1000;
    var todayDow = new Date(todayUTC * 1000).getUTCDay();
    var first = todayUTC - ((weeks - 1) * 7 + todayDow) * DAY;
    var frag = document.createDocumentFragment();
    for (var c = 0; c < weeks; c++) {
      for (var rI = 0; rI < 7; rI++) {
        var ts = first + (c * 7 + rI) * DAY;
        var cell = document.createElement("i");
        cell.style.setProperty("--c", c);
        if (ts > todayUTC) { cell.style.visibility = "hidden"; frag.appendChild(cell); continue; }
        var n = d.calendar[String(ts)] || 0;
        var lvl = n === 0 ? 0 : n <= 2 ? 1 : n <= 5 ? 2 : n <= 9 ? 3 : 4;
        if (lvl) cell.dataset.l = lvl;
        cell.title = n + " submission" + (n === 1 ? "" : "s") + " · " + new Date(ts * 1000).toLocaleDateString("en-GB", { day: "numeric", month: "short", timeZone: "UTC" });
        frag.appendChild(cell);
      }
    }
    heat.style.gridAutoColumns = "1fr";
    heat.appendChild(frag);

    var num = $("#lcNum"), label = $("#lcLabel"), of = $("#lcOf");
    function countTo(el, to, ms) {
      if (reduced) { el.textContent = to; return; }
      var t0 = performance.now(), from = parseInt(el.textContent, 10) || 0;
      (function step(t) {
        var p = Math.min(1, (t - t0) / ms), e = 1 - Math.pow(1 - p, 3);
        el.textContent = Math.round(from + (to - from) * e);
        if (p < 1) requestAnimationFrame(step);
      })(t0);
    }
    function fill() {
      diffs.forEach(function (df) {
        var a = arcs[df[0]];
        a.el.style.strokeDashoffset = (a.len * (1 - a.frac)).toFixed(2);
        var bar = $('.lc-d[data-d="' + df[0] + '"] em u', lcCard);
        bar.style.width = (a.frac * 100).toFixed(1) + "%";
        countTo($('[data-n="' + df[0] + '"]', lcCard), d.solved[df[0]], 1400);
      });
      countTo(num, d.solved.All, 1600);
    }
    var filled = false;
    var tryFill = function (el) { if (!filled && (el === lcCard || el === heat)) { filled = true; setTimeout(fill, 250); } };
    if (lcCard.classList.contains("in")) tryFill(lcCard); else revealHooks.push(tryFill);

    $$(".lc-d", lcCard).forEach(function (b) {
      var on = function () {
        var k = b.dataset.d;
        ring.classList.add("focus");
        diffs.forEach(function (df) { arcs[df[0]].el.classList.toggle("on", df[0] === k); });
        num.textContent = d.solved[k]; of.textContent = "/" + d.total[k]; label.textContent = k;
      };
      var off = function () {
        ring.classList.remove("focus");
        diffs.forEach(function (df) { arcs[df[0]].el.classList.remove("on"); });
        num.textContent = d.solved.All; of.textContent = "/" + d.total.All; label.textContent = "Solved";
      };
      b.addEventListener("pointerenter", on); b.addEventListener("focus", on);
      b.addEventListener("pointerleave", off); b.addEventListener("blur", off);
    });
  }

  /* --------------------------------------------- view transition names */
  $$(".row").forEach(function (row) {
    row.addEventListener("click", function () {
      $$(".row-title").forEach(function (t) { t.style.viewTransitionName = ""; });
      var t = $(".row-title", row);
      if (t) t.style.viewTransitionName = "t-" + row.dataset.slug;
    });
  });
  window.addEventListener("pagereveal", function (ev) {
    if (!ev.viewTransition || !window.navigation || !navigation.activation || !navigation.activation.from) return;
    var m = /\/work\/([^/]+)\//.exec(navigation.activation.from.url || "");
    if (!m) return;
    var t = $('.row-title[data-vt="' + m[1] + '"]');
    if (!t) return;
    t.style.viewTransitionName = "t-" + m[1];
    ev.viewTransition.ready.catch(function () {});
    ev.viewTransition.finished.finally(function () { t.style.viewTransitionName = ""; });
  });
  window.addEventListener("pageshow", function () {
    $$(".row-title").forEach(function (t) { t.style.viewTransitionName = ""; });
  });

  /* ------------------------------------------------------------- keys */
  document.addEventListener("keydown", function (e) {
    var typing = e.target && /^(INPUT|TEXTAREA)$/.test(e.target.tagName);
    if (typing) return;
    if (e.key === "x" || e.key === "X") burst();
  });

  if (CFG.page !== "home") return;

  /* =============================================================== HOME */

  var desktop = $("#desktop");
  var wins = $$(".desktop .win");
  var zTop = 10;

  /* ----------------------------------------------------------- boot */
  var boot = $("#boot");
  function showWindows() {
    wins.forEach(function (w, i) {
      setTimeout(function () { w.classList.add("shown"); }, reduced ? 0 : 120 + i * 120);
    });
    replayLogo($(".dk-home"));
    startTerminal();
  }
  function runBoot() {
    if (!boot || reduced || store.sget("anb-booted")) { if (boot) boot.remove(); showWindows(); return; }
    store.sset("anb-booted", "1");
    boot.classList.add("on");
    var log = $("#bootLog");
    var nProj = $$(".row").length;
    var lines = [
      "A.B/OS 2.6 · booting",
      "<span class=ok>[ ok ]</span> mounting /work (" + nProj + " projects)",
      "<span class=ok>[ ok ]</span> syncing leetcode stats",
      "<span class=ok>[ ok ]</span> calibrating glitch",
      "<span class=ok>[ ok ]</span> status: open to work"
    ];
    var finished = false;
    var finish = function () {
      if (finished) return;
      finished = true;
      boot.classList.add("done");
      setTimeout(function () { boot.remove(); }, 600);
      showWindows();
    };
    lines.forEach(function (l, i) {
      setTimeout(function () { if (!finished) log.innerHTML += l + "\n"; }, 90 + i * 150);
    });
    var bl = $(".boot-logo");
    setTimeout(function () { if (!finished) replayLogo(bl); }, 250);
    setTimeout(function () { if (!finished) bl.classList.add("glitch"); }, 1250);
    setTimeout(finish, 1950);
    $("#bootSkip").addEventListener("click", finish);
    boot.addEventListener("click", finish);
    document.addEventListener("keydown", function k() { finish(); document.removeEventListener("keydown", k); });
  }

  /* ------------------------------------------------------ dragging */
  function makeDraggable(w, barEl, boundsFn) {
    var sx, sy, ox, oy, dragging = false, b;
    barEl.addEventListener("pointerdown", function (e) {
      if (!isDesktopLayout() || e.target.closest("button, a")) return;
      dragging = true;
      barEl.setPointerCapture(e.pointerId);
      sx = e.clientX; sy = e.clientY;
      ox = parseFloat(w.style.getPropertyValue("--dx")) || 0;
      oy = parseFloat(w.style.getPropertyValue("--dy")) || 0;
      var wr = w.getBoundingClientRect(), br = boundsFn();
      b = { minX: br.left - wr.left + ox, maxX: br.right - wr.right + ox, minY: br.top - wr.top + oy, maxY: br.bottom - 40 - wr.top + oy };
      w.classList.add("dragging");
    });
    barEl.addEventListener("pointermove", function (e) {
      if (!dragging) return;
      w.style.setProperty("--dx", Math.min(b.maxX, Math.max(b.minX, ox + e.clientX - sx)) + "px");
      w.style.setProperty("--dy", Math.min(b.maxY, Math.max(b.minY, oy + e.clientY - sy)) + "px");
    });
    var end = function () { dragging = false; w.classList.remove("dragging"); };
    barEl.addEventListener("pointerup", end);
    barEl.addEventListener("pointercancel", end);
  }

  /* -------------------------------------------------------- desktop windows */
  function front(w) { zTop += 1; w.style.zIndex = zTop; }
  function openWin(name) {
    var w = $('.desktop .win[data-win="' + name + '"]');
    if (!w) return;
    var reveal = function () {
      w.classList.remove("closed");
      w.classList.add("shown");
      front(w);
      if (name === "terminal") { var inp = $("#termInput"); if (inp) inp.focus({ preventScroll: true }); }
    };
    if (window.scrollY > 40) { window.scrollTo({ top: 0, behavior: reduced ? "auto" : "smooth" }); setTimeout(reveal, 450); }
    else reveal();
  }
  wins.forEach(function (w) {
    w.addEventListener("pointerdown", function () { front(w); });
    var close = $(".wd-close", w);
    if (close) close.addEventListener("click", function (e) { e.stopPropagation(); w.classList.add("closed"); });
    makeDraggable(w, $(".win-bar", w), function () {
      var r = desktop.getBoundingClientRect();
      return { left: r.left, right: r.right, top: r.top, bottom: r.bottom };
    });
  });

  /* ------------------------------------------------- app windows (game, resume) */
  var openApp = null;
  function showApp(id, after) {
    var el = document.getElementById(id);
    if (!el) return;
    if (openApp && openApp !== el) hideApp(openApp, true);
    el.hidden = false;
    el.classList.remove("closing");
    openApp = el;
    if (after) after(el);
  }
  function hideApp(el, instant) {
    if (!el || el.hidden) return;
    if (el.id === "gameWin" && window.ANBGame) window.ANBGame.close();
    if (instant || reduced) { el.hidden = true; if (openApp === el) openApp = null; return; }
    el.classList.add("closing");
    setTimeout(function () { el.hidden = true; el.classList.remove("closing"); }, 240);
    if (openApp === el) openApp = null;
  }
  $$(".appwin").forEach(function (el) {
    $$("[data-close]", el).forEach(function (c) { c.addEventListener("click", function () { hideApp(el); }); });
    var aw = $(".aw", el);
    makeDraggable(aw, $(".aw-bar", el), function () { return { left: 0, right: innerWidth, top: 0, bottom: innerHeight }; });
  });
  document.addEventListener("keydown", function (e) { if (e.key === "Escape" && openApp) hideApp(openApp); });
  function openGame() {
    showApp("gameWin", function () { if (window.ANBGame) window.ANBGame.open(); });
  }
  var resumeLoaded = false;
  function openResume() {
    showApp("resumeWin", function () {
      if (resumeLoaded) return;
      resumeLoaded = true;
      var body = $("#resumeBody");
      if (fine && innerWidth > 700) {
        var f = document.createElement("iframe");
        f.title = "Resume PDF";
        f.src = body.dataset.pdf + "#view=FitH";
        body.appendChild(f);
      } else {
        var img = document.createElement("img");
        img.src = body.dataset.img; img.alt = "My resume";
        body.appendChild(img);
      }
    });
  }
  $$("[data-open]").forEach(function (b) {
    b.addEventListener("click", function () {
      var what = b.dataset.open;
      if (what === "game") openGame();
      else openWin(what);
    });
  });

  /* ---------------------------------------------- desktop recedes on scroll */
  var ticking = false;
  function onScrollDesk() {
    if (ticking) return;
    ticking = true;
    requestAnimationFrame(function () {
      ticking = false;
      if (!isDesktopLayout() || reduced) { desktop.style.transform = ""; desktop.style.opacity = ""; return; }
      var p = Math.min(1, window.scrollY / innerHeight);
      desktop.style.transform = "scale(" + (1 - 0.07 * p).toFixed(4) + ")";
      desktop.style.opacity = (1 - 0.55 * p).toFixed(3);
      desktop.style.borderRadius = (p * 26).toFixed(1) + "px";
    });
  }
  window.addEventListener("scroll", onScrollDesk, { passive: true });
  window.addEventListener("resize", onScrollDesk);

  /* ------------------------------------------------------ dot grid */
  var dots = $("#dots");
  var mouse = { x: -999, y: -999 };
  document.addEventListener("pointermove", function (e) { mouse.x = e.clientX; mouse.y = e.clientY; }, { passive: true });
  var dctx, dW, dH, dotRGB = cssVar("--dot") || "0,229,255";
  themeListeners.push(function () { setTimeout(function () { dotRGB = cssVar("--dot"); }, 0); });
  function fitDots() {
    if (!dots) return;
    var r = dots.getBoundingClientRect(), d = Math.min(2, window.devicePixelRatio || 1);
    dots.width = r.width * d; dots.height = r.height * d;
    dctx = dots.getContext("2d");
    dctx.setTransform(d, 0, 0, d, 0, 0);
    dW = r.width; dH = r.height;
  }
  function drawDots(t) {
    if (!dctx) return;
    var step = 28;
    dctx.clearRect(0, 0, dW, dH);
    var r = dots.getBoundingClientRect();
    var mx = mouse.x - r.left, my = mouse.y - r.top;
    for (var x = step / 2; x < dW; x += step) {
      for (var y = step / 2; y < dH; y += step) {
        var dx = x - mx, dy = y - my;
        var d = Math.sqrt(dx * dx + dy * dy);
        var wave = reduced ? 0.5 : Math.sin((x + y) * 0.012 - t * 0.0012) * 0.5 + 0.5;
        var near = d < 160 ? 1 - d / 160 : 0;
        var a = 0.06 + wave * 0.06 + near * 0.5;
        var s = 1.2 + near * 2.2;
        dctx.fillStyle = "rgba(" + dotRGB + "," + a.toFixed(3) + ")";
        dctx.fillRect(x - s / 2, y - s / 2, s, s);
      }
    }
  }
  fitDots();
  window.addEventListener("resize", fitDots);

  /* ------------------------------------------------------- photo tilt */
  var photo = $("#photoCard");
  if (photo && fine && !reduced) {
    var tilt = $(".photo-tilt", photo);
    photo.addEventListener("pointermove", function (e) {
      var r = photo.getBoundingClientRect();
      var px = (e.clientX - r.left) / r.width, py = (e.clientY - r.top) / r.height;
      tilt.style.transform = "perspective(800px) rotateY(" + ((px - 0.5) * 12).toFixed(2) + "deg) rotateX(" + ((0.5 - py) * 12).toFixed(2) + "deg) scale(1.03)";
      tilt.style.setProperty("--sx", (px * 100).toFixed(0) + "%");
      tilt.style.setProperty("--sy", (py * 100).toFixed(0) + "%");
    });
    photo.addEventListener("pointerleave", function () { tilt.style.transform = ""; });
    photo.addEventListener("pointerenter", burst);
  }

  /* ---------------------------------------------------------- terminal */
  var tOut = $("#termOut"), tIn = $("#termInput");
  var history = [], hIdx = -1;
  function print(text, cls) {
    var d = document.createElement("div");
    d.className = "tl " + (cls || "tl-out");
    d.textContent = text;
    tOut.appendChild(d);
    tOut.scrollTop = tOut.scrollHeight;
  }
  function startTerminal() {
    if (!tOut) return;
    var lines = $$(".tl[data-type]", tOut);
    if (reduced) return;
    var texts = lines.map(function (l) { return l.textContent; });
    lines.forEach(function (l) { l.textContent = ""; });
    var li = 0, ci = 0;
    (function step() {
      if (li >= lines.length) { print("type `help` to look around", "tl-warn"); return; }
      var full = texts[li];
      if (lines[li].classList.contains("tl-out")) { lines[li].textContent = full; li++; ci = 0; setTimeout(step, 260); return; }
      ci++;
      lines[li].textContent = full.slice(0, ci);
      if (ci >= full.length) { li++; ci = 0; setTimeout(step, 180); }
      else setTimeout(step, 28 + Math.random() * 40);
    })();
  }
  var projectRows = $$(".row");
  function run(raw) {
    var cmd = raw.trim();
    print("$ " + cmd, "tl-cmd");
    if (!cmd) return;
    var parts = cmd.toLowerCase().split(/\s+/), c = parts[0], arg = parts.slice(1).join(" ");
    switch (c) {
      case "help":
        ["help        this list", "whoami      who is this", "ls          list projects", "open <n>    open project n",
         "play        open the game", "resume      print my resume", "contact     ways to reach me", "theme       light / dark",
         "glitch      you'll see", "clear       wipe the screen"].forEach(function (l, i) { print("  " + l, i === 0 ? "tl-hi" : "tl-out"); });
        break;
      case "whoami":
        print(CFG.track === "data" ? "anurag navin bhandary · data engineer" : "anurag navin bhandary · backend engineer", "tl-hi");
        print("m.s. computer science, ut arlington. mumbai, ist.");
        print("status: open to work, open to relocation worldwide", "tl-hi");
        break;
      case "ls": case "projects":
        projectRows.forEach(function (r, i) { print("0" + (i + 1) + "  " + $(".row-title", r).textContent, "tl-hi"); });
        print("try `open 1`", "tl-warn");
        break;
      case "open": case "cd":
        var n = parseInt(arg, 10);
        if (n >= 1 && n <= projectRows.length) { print("opening " + $(".row-title", projectRows[n - 1]).textContent + " …", "tl-warn"); setTimeout(function () { projectRows[n - 1].click(); }, 350); }
        else print("usage: open <1-" + projectRows.length + ">", "tl-err");
        break;
      case "play": case "jump": case "game":
        print("launching dev-run.app …", "tl-warn"); setTimeout(openGame, 300);
        break;
      case "resume": case "cv":
        print("sending to the fax machine …", "tl-warn");
        setTimeout(function () { document.getElementById("resume").scrollIntoView({ behavior: "smooth" }); setTimeout(printFax, 800); }, 300);
        break;
      case "contact": case "email":
        print(CFG.email, "tl-hi");
        print("linkedin.com/in/bhandary-anurag · github.com/AnuragBhandary");
        break;
      case "theme":
        themeBtn.click();
        print("theme → " + (doc.dataset.theme === "light" ? "dark" : "light"), "tl-warn");
        break;
      case "glitch": case "x":
        burst(); print("signal degraded ▓▒░", "tl-err");
        break;
      case "clear":
        tOut.innerHTML = "";
        break;
      case "sudo":
        print("nice try. this incident has been reported.", "tl-err");
        break;
      case "exit":
        $('.win[data-win="terminal"]').classList.add("closed");
        break;
      default:
        print("command not found: " + c, "tl-err");
        print("try `help`", "tl-warn");
    }
  }
  if (tIn) {
    tIn.addEventListener("keydown", function (e) {
      if (e.key === "Enter") {
        var v = tIn.value; history.unshift(v); hIdx = -1; tIn.value = ""; run(v);
      } else if (e.key === "ArrowUp") {
        e.preventDefault(); if (hIdx < history.length - 1) hIdx++; tIn.value = history[hIdx] || "";
      } else if (e.key === "ArrowDown") {
        e.preventDefault(); if (hIdx > 0) hIdx--; else hIdx = -1; tIn.value = hIdx > -1 ? history[hIdx] : "";
      }
    });
    $("#term").addEventListener("click", function () { if (!window.getSelection().toString()) tIn.focus({ preventScroll: true }); });
  }

  /* -------------------------------------------------------------- game */
  if (window.ANBGame && $("#gCanvas")) {
    window.ANBGame.init({
      canvas: $("#gCanvas"),
      ui: { ov: $("#gOv"), t: $("#gOvT"), l1: $("#gOv1"), l2: $("#gOv2"), best: $("#gBest") },
      touch: $$(".g-touch button"),
      root: CFG.root || "",
      onExit: function () { hideApp($("#gameWin")); }
    });
  }

  /* ------------------------------------------------- main animation loop */
  var last = 0, deskVisible = true;
  if ("IntersectionObserver" in window) {
    new IntersectionObserver(function (en) { deskVisible = en[0].isIntersecting && en[0].intersectionRatio > 0.02; }, { threshold: [0, 0.02, 0.5] }).observe(desktop);
  }
  function loop(now) {
    var dt = last ? Math.min(0.05, (now - last) / 1000) : 0.016;
    last = now;
    if (deskVisible && window.scrollY < innerHeight * 1.1) drawDots(now);
    stepTiles(dt);
    requestAnimationFrame(loop);
  }

  /* ----------------------------------------- cursor trail with inertia */
  var tiles = [];
  function stepTiles(dt) {
    if (!tiles.length) return;
    var k = Math.pow(0.9, dt * 60);
    for (var i = tiles.length - 1; i >= 0; i--) {
      var t = tiles[i];
      t.age += dt;
      t.x += t.vx * dt; t.y += t.vy * dt;
      t.vx *= k; t.vy *= k; t.rv *= k; t.rot += t.rv * dt;
      var life = t.age < 0.18 ? t.age / 0.18 : t.age > 0.75 ? Math.max(0, 1 - (t.age - 0.75) / 0.35) : 1;
      var sc = (t.age < 0.18 ? 0.7 + 0.3 * (t.age / 0.18) : 1) * (0.92 + 0.08 * life);
      t.el.style.transform = "translate(" + (t.x - t.w / 2).toFixed(1) + "px," + (t.y - t.h / 2).toFixed(1) + "px) rotate(" + t.rot.toFixed(2) + "deg) scale(" + sc.toFixed(3) + ")";
      t.el.style.opacity = life.toFixed(3);
      if (t.age > 1.1) { t.el.remove(); tiles.splice(i, 1); }
    }
  }
  if (fine && !reduced) {
    $$(".row-wrap").forEach(function (wrap) {
      var row = $(".row", wrap), tpl = $("template.row-tiles", wrap);
      if (!tpl) return;
      var proto = Array.prototype.slice.call(tpl.content.children);
      var idx = 0, lx = null, ly = null, px = 0, py = 0, pt = 0, vx = 0, vy = 0;
      row.addEventListener("pointerenter", function (e) { lx = e.clientX; ly = e.clientY; px = lx; py = ly; pt = performance.now(); });
      row.addEventListener("pointermove", function (e) {
        var now = performance.now(), dtm = Math.max(8, now - pt);
        vx = vx * 0.6 + ((e.clientX - px) / dtm * 1000) * 0.4;
        vy = vy * 0.6 + ((e.clientY - py) / dtm * 1000) * 0.4;
        px = e.clientX; py = e.clientY; pt = now;
        if (lx === null) { lx = px; ly = py; }
        if (Math.hypot(px - lx, py - ly) < 110) return;
        lx = px; ly = py;
        if (tiles.length > 7) { var old = tiles.shift(); old.el.remove(); }
        var el = proto[idx % proto.length].cloneNode(true);
        idx++;
        document.body.appendChild(el);
        var w = el.offsetWidth, h = el.offsetHeight;
        var cap = 1400, sp = Math.hypot(vx, vy), f = sp > cap ? cap / sp : 1;
        tiles.push({ el: el, x: px, y: py, w: w, h: h, vx: vx * f * 0.55, vy: vy * f * 0.55, rot: (Math.random() * 2 - 1) * 6, rv: (Math.random() * 2 - 1) * 30 + vx * 0.02, age: 0 });
      });
    });
  }

  /* --------------------------------------------------------------- fax */
  var faxBtn = $("#faxBtn"), paper = $("#faxPaper"), lcd = $("#faxLcd");
  function printFax() {
    if (!faxBtn || faxBtn.disabled) return;
    faxBtn.disabled = true;
    paper.classList.remove("printing", "printed");
    void paper.offsetWidth;
    lcd.textContent = "DIALING …";
    function done() {
      lcd.textContent = "DONE ✓ OPENING";
      faxBtn.textContent = "print again";
      faxBtn.disabled = false;
      setTimeout(function () { openResume(); lcd.textContent = "DONE ✓ TAP PAGE"; }, 450);
    }
    setTimeout(function () {
      lcd.textContent = "RECEIVING 1/1";
      if (reduced) { paper.classList.add("printed"); done(); return; }
      paper.classList.add("printing");
    }, 650);
    paper.addEventListener("animationend", function h() {
      paper.removeEventListener("animationend", h);
      paper.classList.remove("printing"); paper.classList.add("printed"); done();
    });
  }
  if (faxBtn) faxBtn.addEventListener("click", printFax);
  var paperBtn = $("#paperOpen");
  if (paperBtn) paperBtn.addEventListener("click", function () { if (paper.classList.contains("printed")) openResume(); });

  runBoot();
  requestAnimationFrame(loop);
})();
