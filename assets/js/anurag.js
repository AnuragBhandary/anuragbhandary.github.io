/* AnuRAG chat. Replies are set with textContent, never as HTML, because they come from a model. */
(function () {
  "use strict";

  var CFG = window.ANB || {};
  if (!CFG.chat) return;

  var LINES = CFG.chatLines || {};
  var bags = {};
  var previous = "";

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

  function ask(question) {
    return fetch(CFG.chat, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ question: question, previous: previous, page: CFG.project || "" })
    }).then(function (r) {
      return r.json();
    }).then(function (data) {
      previous = question;
      return { text: data.kind === "answer" ? data.answer : line(data.kind || "error"), sources: data.sources || [],
               next: data.next || [] };
    }).catch(function () {
      return { text: line("error"), sources: [], next: [] };
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
  var busy = false;

  function setOpen(open) {
    panel.hidden = !open;
    toggle.setAttribute("aria-expanded", String(open));
    if (open) input.focus(); else toggle.focus();
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

  function submit(question) {
    if (busy || !question) return;
    busy = true;
    send.disabled = true;
    if (chips) { chips.remove(); chips = null; }
    // Old suggestions would answer an earlier question, so only the latest set stays.
    Array.prototype.forEach.call(log.querySelectorAll(".ask-next"), function (n) { n.remove(); });
    add(question, "me");
    var wait = add(line("waiting"), "bot wait");
    if (hero) hero.classList.add("thinking");
    ask(question).then(function (r) {
      wait.remove();
      addReply(r.text);
      addSources(r.sources);
      addNext(r.next);
    }).finally(function () {
      busy = false;
      send.disabled = false;
      if (hero) hero.classList.remove("thinking");
      input.focus();
    });
  }

  toggle.addEventListener("click", function () { setOpen(panel.hidden); });
  document.getElementById("askClose").addEventListener("click", function () { setOpen(false); });
  panel.addEventListener("keydown", function (e) { if (e.key === "Escape") setOpen(false); });
  form.addEventListener("submit", function (e) {
    e.preventDefault();
    var q = input.value.trim();
    input.value = "";
    submit(q);
  });
  log.addEventListener("click", function (e) {
    if (e.target.classList.contains("ask-chip")) submit(e.target.textContent);
  });
})();
