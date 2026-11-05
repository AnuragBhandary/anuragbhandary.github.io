/* AnuRAG chat. Replies are set with textContent, never as HTML, because they come from a model. */
(function () {
  "use strict";

  var CFG = window.ANB || {};
  if (!CFG.chat) return;

  var LINES = CFG.chatLines || {};
  var bags = {};
  var previous = "";
  // The last few questions with what was said back, so "is this all?" or "tell me more" has something to lean on.
  var history = [];

  // Goes through every line for a moment before any repeats.
  function line(kind) {
    var pool = LINES[kind] || LINES.error || [""];
    if (!bags[kind] || !bags[kind].length) {
      var last = bags[kind + "-last"];
      bags[kind] = pool.slice().sort(function () { return Math.random() - 0.5; });
      if (bags[kind].length > 1 && bags[kind][bags[kind].length - 1] === last) bags[kind].unshift(bags[kind].pop());
    }
    var next = bags[kind].pop();
    bags[kind + "-last"] = next;
    return next;
  }

  // A job description goes as its own kind of request; it's remembered as one short line, not the whole posting.
  function ask(question, job) {
    var body = job ? { mode: "fit", job: job, page: CFG.project || "" }
                   : { question: question, previous: previous, history: history, page: CFG.project || "" };
    return fetch(CFG.chat, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body)
    }).then(function (r) {
      return r.json();
    }).then(function (data) {
      var text = data.kind === "answer" ? data.answer : line(data.kind === "not_found" && job ? "no_fit" : data.kind || "error");
      previous = question;
      // A "busy" or "error" line says nothing about the question, so only real replies are remembered.
      if (data.kind === "answer" || data.kind === "not_found") history = history.concat({ q: question, a: text.slice(0, 700) }).slice(-3);
      return { kind: data.kind, text: text, sources: data.sources || [], next: data.next || [], actions: data.actions || [] };
    }).catch(function () {
      return { kind: "error", text: line("error"), sources: [], next: [], actions: [] };
    });
  }

  window.AnuRAG = { ask: ask, waiting: function () { return line("waiting"); } };

  var panel = document.getElementById("askPanel");
  var toggle = document.getElementById("askToggle");
  if (!panel || !toggle) return;

  var log = document.getElementById("askLog");
  var form = document.getElementById("askForm");
  var input = document.getElementById("askInput");
  var send = form.querySelector("button");
  var chips = document.getElementById("askChips");
  var hero = panel.querySelector(".ask-hero");
  var buddy = document.getElementById("askBuddy");
  var greeting = panel.querySelector(".ask-intro .ask-msg");
  var still = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  var opener = toggle;
  var busy = false;
  var finishGreeting = null;
  var mini = document.getElementById("askMini");
  var fitBtn = document.getElementById("askFit");

  // The header hero: "run" while waiting, then one "cheer" (a flip) or "hurt" (a flinch) before he idles again.
  function react(mood) {
    if (!mini) return;
    mini.classList.remove("run", "cheer", "hurt");
    if (!mood) return;
    void mini.offsetWidth;
    mini.classList.add(mood);
    if (mood !== "run") setTimeout(function () { mini.classList.remove(mood); }, 900);
  }
  var job = document.getElementById("askJob");
  // On phones a focused field pops the keyboard up over the chat, so the visitor taps the box when ready.
  var keyboard = window.matchMedia("(pointer: fine)").matches;
  function focusField(el) { if (keyboard) el.focus(); }
  var fitting = false;

  function setFit(on) {
    fitting = on;
    fitBtn.setAttribute("aria-pressed", String(on));
    fitBtn.textContent = on ? "Back to questions" : "Check his fit for a job: paste the description";
    input.hidden = on;
    job.hidden = !on;
    focusField(on ? job : input);
  }

  // Game-dialogue style: letters appear one at a time with a beat after punctuation. The untyped rest
  // stays in place but invisible, so the bubble keeps its final size instead of growing as it types.
  function typeOut(el, done) {
    var full = el.textContent, i = 0, timer = null;
    var shown = document.createElement("span"), rest = document.createElement("span");
    rest.className = "type-rest";
    function finish() {
      clearTimeout(timer);
      el.textContent = full;
      if (done) { done(); done = null; }
    }
    if (still) { finish(); return finish; }
    el.textContent = "";
    el.append(shown, rest);
    (function step() {
      i++;
      shown.textContent = full.slice(0, i);
      rest.textContent = full.slice(i);
      if (i >= full.length) return finish();
      var c = full[i - 1];
      timer = setTimeout(step, ".!?".indexOf(c) >= 0 ? 260 : c === "," ? 140 : 26);
    })();
    return finish;
  }

  function setOpen(open, from) {
    if (open) opener = from || toggle;
    panel.hidden = !open;
    document.documentElement.classList.toggle("ask-open", open);
    toggle.setAttribute("aria-expanded", String(open));
    if (buddy) buddy.setAttribute("aria-expanded", String(open));
    if (open) focusField(input); else opener.focus();
    // The greeting is spoken the first time the chat opens; aria-busy keeps screen readers from reading each letter.
    if (open && greeting) {
      var g = greeting;
      greeting = null;
      log.setAttribute("aria-busy", "true");
      if (hero) hero.classList.add("thinking");
      finishGreeting = typeOut(g, function () {
        log.removeAttribute("aria-busy");
        if (hero && !busy) hero.classList.remove("thinking");
        finishGreeting = null;
      });
    }
  }

  // The corner hero: a flip on hover and now and then, and one hello per visit.
  if (buddy) {
    var tip = buddy.querySelector(".buddy-tip");
    var talking = false;
    var say = function () {
      if (talking) return;
      talking = true;
      typeOut(tip, function () { talking = false; });
    };
    var flip = function () {
      if (still || buddy.classList.contains("paused") || buddy.classList.contains("flip")) return;
      buddy.classList.add("flip");
      setTimeout(function () { buddy.classList.remove("flip"); }, 650);
    };
    buddy.addEventListener("click", function () { setOpen(true, buddy); });
    // He idles for a few seconds, then stands still; a hover wakes him briefly, and the pause button stills him for good.
    var restTimer = null;
    var rest = function (ms) {
      buddy.classList.remove("rest");
      clearTimeout(restTimer);
      restTimer = setTimeout(function () { buddy.classList.add("rest"); }, ms);
    };
    buddy.addEventListener("mouseenter", function () { rest(4000); flip(); say(); });
    buddy.addEventListener("focus", say);
    rest(12000);
    if (!still) {
      var pause = document.createElement("button");
      pause.type = "button";
      pause.className = "buddy-pause";
      var setPaused = function (on) {
        buddy.classList.toggle("paused", on);
        pause.setAttribute("aria-pressed", String(on));
        pause.setAttribute("aria-label", on ? "Animate the AnuRAG hero" : "Stop the AnuRAG hero moving");
        pause.title = on ? "Let him move" : "Stop him moving";
        pause.textContent = on ? "\u25B6" : "\u23F8\uFE0E";
      };
      var paused = false;
      try { paused = localStorage.getItem("anb-buddy-still") === "1"; } catch (_) {}
      setPaused(paused);
      pause.addEventListener("click", function () {
        paused = !paused;
        setPaused(paused);
        try { localStorage.setItem("anb-buddy-still", paused ? "1" : "0"); } catch (_) {}
      });
      buddy.after(pause);
    }
    var greeted = false;
    try { greeted = sessionStorage.getItem("anb-buddy") === "1"; sessionStorage.setItem("anb-buddy", "1"); } catch (_) {}
    if (!greeted) {
      setTimeout(function () { flip(); buddy.classList.add("say"); say(); }, 4000);
      setTimeout(function () { buddy.classList.remove("say"); }, 10000);
    }
  }

  function add(text, cls) {
    var p = document.createElement("p");
    p.className = "ask-msg " + cls;
    p.textContent = text;
    log.appendChild(p);
    log.scrollTop = log.scrollHeight;
    return p;
  }

  // Lines starting "• " become a real list; other lines are paragraphs. Still textContent only, never HTML.
  function addReply(text) {
    var div = document.createElement("div"), list = null;
    div.className = "ask-msg bot";
    text.split("\n").forEach(function (raw) {
      var l = raw.trim();
      if (!l) { list = null; return; }
      if (l.indexOf("• ") === 0) {
        if (!list) { list = document.createElement("ul"); div.appendChild(list); }
        var li = document.createElement("li");
        li.textContent = l.slice(2);
        list.appendChild(li);
        return;
      }
      list = null;
      var p = document.createElement("p");
      p.textContent = l;
      div.appendChild(p);
    });
    log.appendChild(div);
    log.scrollTop = log.scrollHeight;
    return div;
  }

  // Answers type out like the greeting, but faster: however long, one takes about 2.5 s. Every paragraph and
  // bullet keeps its final size from the start (the untyped rest is invisible), so nothing jumps. A click skips.
  var finishAnswer = null;
  function typeAnswer(div, done) {
    var leaves = Array.prototype.slice.call(div.querySelectorAll("p, li"));
    var parts = leaves.map(function (el) {
      var full = el.textContent, shown = document.createElement("span"), rest = document.createElement("span");
      rest.className = "type-rest";
      rest.textContent = full;
      el.textContent = "";
      el.append(shown, rest);
      return { el: el, full: full, shown: shown, rest: rest };
    });
    var total = parts.reduce(function (n, p) { return n + p.full.length; }, 0);
    var per = Math.max(1, Math.ceil(total / 150)), at = 0, timer = null;
    function finish() {
      clearTimeout(timer);
      parts.forEach(function (p) { p.el.textContent = p.full; });
      div.removeEventListener("click", finish);
      log.removeAttribute("aria-busy");
      finishAnswer = null;
      if (done) { var d = done; done = null; d(); }
    }
    finishAnswer = finish;
    if (still) return finish();
    log.setAttribute("aria-busy", "true");
    div.addEventListener("click", finish);
    (function step() {
      at += per;
      var left = at;
      parts.forEach(function (p) {
        var n = Math.max(0, Math.min(p.full.length, left));
        p.shown.textContent = p.full.slice(0, n);
        p.rest.textContent = p.full.slice(n);
        left -= p.full.length;
      });
      if (at >= total) return finish();
      timer = setTimeout(step, 16);
    })();
  }

  function addNext(questions) {
    if (!questions.length) return;
    var div = document.createElement("div");
    div.className = "ask-chips ask-next";
    questions.forEach(function (q) {
      var b = document.createElement("button");
      b.type = "button";
      b.className = "ask-chip";
      b.textContent = q;
      div.appendChild(b);
    });
    log.appendChild(div);
    log.scrollTop = log.scrollHeight;
  }

  function addSources(sources) {
    // Links come only from the site's own paths or his public repos.
    var safe = sources.filter(function (s) {
      return /^(work\/[a-z0-9-]+\/|#[a-z]+|https:\/\/github\.com\/AnuragBhandary\/[\w-]+\/blob\/main\/[\w./-]+)$/.test(s.url);
    });
    if (!safe.length) return;
    var div = document.createElement("div");
    div.className = "ask-src";
    safe.forEach(function (s) {
      var a = document.createElement("a");
      var external = s.url.indexOf("https://") === 0;
      a.href = external ? s.url : CFG.root + s.url;
      if (external) { a.target = "_blank"; a.rel = "noopener"; }
      a.textContent = s.title;
      div.appendChild(a);
    });
    log.appendChild(div);
    log.scrollTop = log.scrollHeight;
  }

  // Only these two, with links the page builds itself: the worker names an action, never a URL.
  var ACTIONS = {
    resume: function () { return { label: "Open his resume (PDF)", href: CFG.root + CFG.resume, out: true }; },
    contact: function () { return { label: "Go to contact", href: CFG.root + "#contact" }; }
  };
  function addActions(names) {
    var known = names.filter(function (n) { return ACTIONS[n]; });
    if (!known.length) return;
    var div = document.createElement("div");
    div.className = "ask-act";
    known.forEach(function (n) {
      var act = ACTIONS[n](), a = document.createElement("a");
      a.className = "ask-btn";
      a.href = act.href;
      a.textContent = act.label;
      if (act.out) { a.target = "_blank"; a.rel = "noopener"; }
      // The contact link on this page should close the chat so the section is visible.
      else a.addEventListener("click", function () { setOpen(false); });
      div.appendChild(a);
    });
    log.appendChild(div);
    log.scrollTop = log.scrollHeight;
  }

  function submit(question, posting) {
    if (busy || !question) return;
    if (finishGreeting) finishGreeting();
    if (finishAnswer) finishAnswer();
    busy = true;
    send.disabled = true;
    if (chips) { chips.remove(); chips = null; }
    // Old suggestions would answer an earlier question, so only the latest set stays.
    Array.prototype.forEach.call(log.querySelectorAll(".ask-next"), function (n) { n.remove(); });
    add(question, "me");
    var wait = add(line("waiting"), "bot wait");
    if (hero) hero.classList.add("thinking");
    react("run");
    ask(question, posting).then(function (r) {
      wait.remove();
      react(r.kind === "answer" ? "cheer" : "hurt");
      typeAnswer(addReply(r.text), function () {
        addSources(r.sources);
        addActions(r.actions);
        addNext(r.next);
      });
    }).finally(function () {
      busy = false;
      send.disabled = false;
      if (hero) hero.classList.remove("thinking");
      focusField(input);
    });
  }

  toggle.addEventListener("click", function () { setOpen(panel.hidden, toggle); });
  document.getElementById("askClose").addEventListener("click", function () { setOpen(false); });
  panel.addEventListener("keydown", function (e) { if (e.key === "Escape") setOpen(false); });
  form.addEventListener("submit", function (e) {
    e.preventDefault();
    if (fitting) {
      var posting = job.value.trim();
      if (posting.length < 80) { add(line("short_job"), "bot"); return; }
      job.value = "";
      setFit(false);
      submit("Check this job description (" + posting.split(/\s+/).length + " words)", posting);
      return;
    }
    var q = input.value.trim();
    input.value = "";
    submit(q);
  });
  if (fitBtn) fitBtn.addEventListener("click", function () { setFit(!fitting); });
  log.addEventListener("click", function (e) {
    if (e.target.classList.contains("ask-chip")) submit(e.target.textContent);
  });
})();
