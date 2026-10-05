"""Generate the static site from content.py.

    python3 src/build.py

Writes index.html, data/index.html, work/<slug>/index.html and data/work/<slug>/index.html.
No dependencies beyond the Python standard library.
"""

from html import escape
from pathlib import Path
import json

from content import EDUCATION, PERSON, PROJECTS, ROLES, SKILLS, TESTIMONIAL, TRACKS, USED_EXTRA

ROOT = Path(__file__).resolve().parent.parent
def _asset_version():
    import hashlib
    h = hashlib.md5()
    for f in ("assets/js/site.js", "assets/js/game.js", "assets/css/site.css"):
        h.update((ROOT / f).read_bytes())
    return h.hexdigest()[:8]


ASSET_VERSION = _asset_version()
ICONS = json.loads((Path(__file__).parent / "icons.json").read_text())


def e(s):
    return escape(str(s), quote=True)


def brand(slug, cls="bi"):
    return f'<svg class="{cls}" viewBox="0 0 24 24" aria-hidden="true"><path d="{ICONS[slug]}"/></svg>'


# ---------------------------------------------------------------------------
# Shared pieces
# ---------------------------------------------------------------------------

LOGO = ('<span class="logo" aria-hidden="true"><span class="lg-a">A</span>'
        '<span class="lg-dot"></span><span class="lg-b">B</span></span>')


def ico(paths):
    return f'<svg class="li" viewBox="0 0 24 24" aria-hidden="true">{paths}</svg>'


DOCK_ICONS = {
    "work": ico('<path d="M3 7a2 2 0 0 1 2-2h4l2 2h8a2 2 0 0 1 2 2v8a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"/><path d="M3 10h18"/>'),
    "about": ico('<circle cx="12" cy="8" r="4"/><path d="M4 21c1.5-4 4.5-6 8-6s6.5 2 8 6"/>'),
    "skills": ico('<rect x="6" y="6" width="12" height="12" rx="2"/><rect x="9.5" y="9.5" width="5" height="5" rx="1"/>'
                  '<path d="M9 2.5v3.5M15 2.5v3.5M9 18v3.5M15 18v3.5M2.5 9H6M2.5 15H6M18 9h3.5M18 15h3.5"/>'),
    "experience": ico('<rect x="3" y="7" width="18" height="13" rx="2"/><path d="M8 7V5a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2M3 13h18M11 13v2h2v-2"/>'),
    "resume": ico('<path d="M14 3H7a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2V8z"/><path d="M14 3v5h5M9 13h6M9 17h4"/>'),
    "contact": ico('<rect x="3" y="5" width="18" height="14" rx="2"/><path d="m3.5 7 8.5 6 8.5-6"/>'),
    "terminal": ico('<rect x="2.5" y="4" width="19" height="16" rx="2.5"/><path d="m7 9 3 3-3 3M12.5 15H17"/>'),
    "game": ico('<path d="M7 8h10a4.5 4.5 0 0 1 4.4 3.6l.8 3.9a2.7 2.7 0 0 1-4.7 2.3L15.6 16H8.4l-1.9 1.8a2.7 2.7 0 0 1-4.7-2.3l.8-3.9A4.5 4.5 0 0 1 7 8z"/>'
                '<path d="M8 10.5v3.4M6.3 12.2h3.4"/><circle class="fill" cx="15.6" cy="11.2" r="1"/><circle class="fill" cx="17.8" cy="13.2" r="1"/>'),
}

THEME_SWITCH = """<button class="dk dk-theme" id="themeToggle" type="button" aria-label="Toggle light and dark mode">
  <span class="sw" aria-hidden="true">
    <span class="sw-stars"><i></i><i></i><i></i><i></i><i></i></span>
    <span class="sw-cloud"></span>
    <span class="sw-knob"><span class="sw-rays"></span><span class="sw-crater c1"></span><span class="sw-crater c2"></span><span class="sw-crater c3"></span></span>
  </span>
  <span class="dk-tip" id="themeTip">Light mode</span>
</button>"""

GLASS_FILTER = """<svg class="defs" width="0" height="0" aria-hidden="true" focusable="false">
  <filter id="liquid-glass" x="-30%" y="-30%" width="160%" height="160%" color-interpolation-filters="sRGB">
    <feTurbulence type="fractalNoise" baseFrequency="0.012 0.012" numOctaves="2" seed="7" result="noise"/>
    <feGaussianBlur in="noise" stdDeviation="3" result="map"/>
    <feDisplacementMap in="SourceGraphic" in2="map" scale="52" xChannelSelector="R" yChannelSelector="G" result="dR"/>
    <feColorMatrix in="dR" type="matrix" values="1 0 0 0 0  0 0 0 0 0  0 0 0 0 0  0 0 0 1 0" result="cR"/>
    <feDisplacementMap in="SourceGraphic" in2="map" scale="45" xChannelSelector="R" yChannelSelector="G" result="dG"/>
    <feColorMatrix in="dG" type="matrix" values="0 0 0 0 0  0 1 0 0 0  0 0 0 0 0  0 0 0 1 0" result="cG"/>
    <feDisplacementMap in="SourceGraphic" in2="map" scale="38" xChannelSelector="R" yChannelSelector="G" result="dB"/>
    <feColorMatrix in="dB" type="matrix" values="0 0 0 0 0  0 0 0 0 0  0 0 1 0 0  0 0 0 1 0" result="cB"/>
    <feBlend in="cR" in2="cG" mode="screen" result="rg"/>
    <feBlend in="rg" in2="cB" mode="screen"/>
  </filter>
</svg>"""


def head(title, description, root, noindex, canonical):
    robots = '<meta name="robots" content="noindex, nofollow">' if noindex else ""
    canon = f'<link rel="canonical" href="{e(canonical)}">' if canonical and not noindex else ""
    return f"""<!doctype html>
<html lang="en" data-theme="dark">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>{e(title)}</title>
<meta name="description" content="{e(description)}">
{robots}
{canon}
<meta property="og:title" content="{e(title)}">
<meta property="og:description" content="{e(description)}">
<meta property="og:type" content="website">
<meta property="og:image" content="{PERSON['site']}/assets/img/me.jpg">
<meta name="theme-color" content="#07090d">
<link rel="icon" href="{root}favicon.svg" type="image/svg+xml">
<link rel="preconnect" href="https://fonts.googleapis.com">
<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
<link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=Bebas+Neue&family=IBM+Plex+Mono:wght@400;500;600&family=IBM+Plex+Sans:ital,wght@0,400;0,500;0,600;1,400&display=swap">
<link rel="stylesheet" href="{root}assets/css/site.css?v={ASSET_VERSION}">
<script>try{{var t=localStorage.getItem("anb-theme");if(t)document.documentElement.dataset.theme=t}}catch(_){{}}</script>
</head>"""


def dock(home, on_home):
    pre = "" if on_home else home
    item = lambda key, label: (f'<a class="dk" href="{pre}#{key}" data-nav="{key}" aria-label="{label}">'
                               f'<span class="dk-tile">{DOCK_ICONS[key]}</span><span class="dk-tip">{label}</span></a>')
    nav = "".join(item(k, l) for k, l in [("work", "Work"), ("about", "About"), ("skills", "Skills"),
                                          ("experience", "Experience"), ("resume", "Resume"), ("contact", "Contact")])
    apps = ""
    if on_home:
        apps = ('<span class="dk-sep" aria-hidden="true"></span>'
                f'<button class="dk dk-app" type="button" data-open="terminal" aria-label="Terminal"><span class="dk-tile">{DOCK_ICONS["terminal"]}</span><span class="dk-tip">Terminal</span></button>'
                f'<button class="dk dk-app dk-game" type="button" data-open="game" aria-label="Play Dev Run"><span class="dk-tile">{DOCK_ICONS["game"]}</span><span class="dk-tip">Play Dev Run</span></button>')
    return f"""<div class="dock-wrap">
<nav class="dock" id="dock" aria-label="Site">
  <a class="dk dk-home" href="{'#top' if on_home else home}" aria-label="Home"><span class="dk-tile">{LOGO}</span><span class="dk-tip">Home</span></a>
  <span class="dk-sep" aria-hidden="true"></span>
  {nav}
  {apps}
  <span class="dk-sep" aria-hidden="true"></span>
  {THEME_SWITCH}
  <span class="dk-clock" title="My local time"><i></i><b id="clock">--:--</b><small>IST</small></span>
</nav>
</div>"""


def footer():
    return f"""<footer class="foot">
  <span>© 2026 {e(PERSON['full'])}</span>
  <span class="foot-mid">Plain HTML, CSS and JavaScript · press <kbd>X</kbd> for a glitch</span>
  <a href="#top" class="foot-top">back to top ↑</a>
</footer>"""


def scripts(root, page, track_key):
    return f"""<div class="scan" aria-hidden="true"></div>
{GLASS_FILTER}
<script>window.ANB={json.dumps({"page": page, "track": track_key, "email": PERSON["email"], "root": root})};</script>
{f'<script src="{root}assets/js/game.js?v={ASSET_VERSION}" defer></script>' if page == "home" else ""}
<script src="{root}assets/js/site.js?v={ASSET_VERSION}" defer></script>
</body>
</html>
"""


def glitch_word(word, cls=""):
    w = e(word)
    return (f'<span class="gw {cls}"><span class="gw-base">{w}</span>'
            f'<span class="gw-g gw-a" aria-hidden="true">{w}</span>'
            f'<span class="gw-g gw-b" aria-hidden="true">{w}</span></span>')


def tile_html(t, root):
    k = t["kind"]
    if k == "img":
        return f'<div class="tile tile-img"><img src="{root}{e(t["src"])}" alt="" loading="lazy"></div>'
    if k == "code":
        return f'<div class="tile tile-code"><pre>{e(t["text"])}</pre></div>'
    if k == "score":
        return (f'<div class="tile tile-score"><span class="live">● LIVE</span>'
                f'<b>{e(t["big"])}</b><small>{e(t["small"])}</small></div>')
    return f'<div class="tile tile-metric"><b>{e(t["big"])}</b><small>{e(t["small"])}</small></div>'


# ---------------------------------------------------------------------------
# Skills + LeetCode
# ---------------------------------------------------------------------------

def used_in(name, track_key):
    key = name.lower().replace("aws ", "")
    hits = []
    for slug in TRACKS[track_key]["projects"]:
        p = PROJECTS[slug]
        if any(key in s.lower() for s in p["stack"]):
            hits.append(p["short"])
    for extra in USED_EXTRA.get(name, []):
        if extra not in hits:
            hits.append(extra)
    return hits


def skills_html(track_key):
    cards = []
    for i, c in enumerate(SKILLS[track_key]):
        chips = []
        for name, icon, glyph in c["items"]:
            mark = brand(icon) if icon else f'<span class="glyph">{e(glyph)}</span>'
            used = used_in(name, track_key)
            tip = f' data-used="{e(" · ".join(used))}"' if used else ""
            chips.append(f'<li class="skill"{tip} tabindex="0">{mark}<span>{e(name)}</span></li>')
        tags = "".join(f"<li>{e(t)}</li>" for t in c.get("tags", []))
        tags = f'<ul class="sk-tags">{tags}</ul>' if tags else ""
        note = f'<p class="sk-note">{e(c["note"])}</p>' if c.get("note") else ""
        if i == 3:
            cards.append(LEETCODE)
        cards.append(f"""<div class="sk-card card reveal {c['cls']}" style="--i:{i}">
  <h3><span class="sk-n">0{i + 1}</span>{e(c['title'])}</h3>
  <ul class="skills">{''.join(chips)}</ul>
  {tags}{note}
</div>""")
    return "".join(cards)


LEETCODE = """<div class="sk-card card reveal lc" id="leetcode" style="--i:6">
  <h3><span class="sk-n">LC</span>Problem solving <a class="lc-user" href="https://leetcode.com/u/anuragb2901/" target="_blank" rel="noopener">@anuragb2901 ↗</a></h3>
  <div class="lc-top">
    <div class="lc-ring">
      <svg viewBox="0 0 200 200" aria-hidden="true"><g id="lcArcs"></g></svg>
      <div class="lc-center"><b id="lcNum">0</b><span id="lcOf">/ –</span><small id="lcLabel">Solved</small></div>
    </div>
    <div class="lc-diffs">
      <button type="button" class="lc-d easy" data-d="Easy"><span>Easy</span><b><i data-n="Easy">0</i><small data-t="Easy">/ –</small></b><em><u></u></em></button>
      <button type="button" class="lc-d med" data-d="Medium"><span>Med.</span><b><i data-n="Medium">0</i><small data-t="Medium">/ –</small></b><em><u></u></em></button>
      <button type="button" class="lc-d hard" data-d="Hard"><span>Hard</span><b><i data-n="Hard">0</i><small data-t="Hard">/ –</small></b><em><u></u></em></button>
    </div>
  </div>
  <div class="lc-heat" id="lcHeat" aria-label="Submission calendar"></div>
  <div class="lc-meta"><span><b id="lcStreak">–</b> day streak</span><span><b id="lcDays">–</b> active days</span><span>rank <b id="lcRank">–</b></span><span class="lc-upd" id="lcUpd"></span></div>
</div>"""


# ---------------------------------------------------------------------------
# Home page
# ---------------------------------------------------------------------------

def contact_html():
    gh = PERSON["github"].rsplit("/", 1)[-1]
    linkedin_icon = ('<svg class="bi" viewBox="0 0 24 24" aria-hidden="true"><path d="M20.45 20.45h-3.56v-5.57c0-1.33-.02-3.04-1.85-3.04-1.85 0-2.14 1.45-2.14 2.94v5.67H9.35V9h3.41v1.56h.05c.48-.9 1.64-1.85 3.37-1.85 3.6 0 4.27 2.37 4.27 5.46zM5.34 7.43a2.06 2.06 0 1 1 0-4.13 2.06 2.06 0 0 1 0 4.13zM7.12 20.45H3.56V9h3.56zM22.22 0H1.77C.79 0 0 .77 0 1.73v20.54C0 23.23.79 24 1.77 24h20.45c.98 0 1.78-.77 1.78-1.73V1.73C24 .77 23.2 0 22.22 0z"/></svg>')
    cards = [
        ("github", PERSON["github"], brand("github"), "GitHub", "@" + gh, "Code, CI, the receipts"),
        ("linkedin", PERSON["linkedin"], linkedin_icon, "LinkedIn", "in/bhandary-anurag", "The professional bit"),
        ("leetcode", PERSON["leetcode"], brand("leetcode"), "LeetCode", "@anuragb2901", "Daily problem habit"),
    ]
    big = "".join(f"""<a class="ct-card card {k}" href="{e(h)}" target="_blank" rel="noopener">
  <span class="ct-ico">{i}</span>
  <span class="ct-name">{e(n)}</span>
  <span class="ct-handle">{e(hd)}</span>
  <span class="ct-desc">{e(d)}</span>
  <span class="ct-arrow" aria-hidden="true">↗</span>
</a>""" for k, h, i, n, hd, d in cards)
    return f"""<section class="sec contact" id="contact">
    <div class="ct-radar" aria-hidden="true"><i></i><i></i><i></i><i></i></div>
    <div class="sec-head reveal"><span class="sec-num">06</span><h2 class="ct-title">{glitch_word("LET'S TALK")}</h2>
      <p class="sec-sub"><span class="ct-live"><i></i> online</span> I usually reply within a day.</p></div>
    <div class="ct-grid">
      {big}
      <div class="ct-card card ct-mail" id="ctMailCard">
        <span class="ct-ico">{brand("gmail")}</span>
        <span class="ct-name">Email</span>
        <a class="ct-email" href="mailto:{e(PERSON['email'])}">{e(PERSON['email'])}</a>
        <span class="ct-actions"><a href="mailto:{e(PERSON['email'])}">write ↗</a><button type="button" id="copyMail">copy</button></span>
      </div>
    </div>
  </section>"""


def home(track_key):
    tr = TRACKS[track_key]
    root = "../" * tr["prefix"].count("/")
    projs = [(slug, PROJECTS[slug]) for slug in tr["projects"]]
    n = len(projs)

    rows = []
    for i, (slug, p) in enumerate(projs, 1):
        tiles = "".join(tile_html(t, root) for t in p["tiles"])
        chips = "".join(f"<li>{e(s)}</li>" for s in p["stack"][:4])
        rows.append(f"""<li class="row-wrap reveal">
  <a class="row" href="work/{slug}/" data-slug="{slug}">
    <span class="row-idx">0{i}</span>
    <span class="row-main">
      <span class="row-kicker">{e(p['kicker'])}</span>
      <span class="row-title" data-vt="{slug}">{e(p['title'])}</span>
      <span class="row-one">{e(p['oneliner'])}</span>
      <ul class="row-chips">{chips}</ul>
    </span>
    <span class="row-metric"><b>{e(p['headline'][0])}</b><small>{e(p['headline'][1])}</small></span>
    <span class="row-arrow" aria-hidden="true">↗</span>
  </a>
  <template class="row-tiles">{tiles}</template>
</li>""")

    term_lines = "".join(
        f'<div class="tl {"tl-cmd" if not l.startswith(">") else "tl-out"}" data-type>{e(l if l.startswith(">") else "$ " + l)}</div>'
        for l in tr["terminal"])
    facts = "".join(f'<div><dt>{e(k)}</dt><dd>{e(v)}</dd></div>' for k, v in tr["facts"])
    edu = "".join(f"""<div class="edu card reveal">
  <span class="edu-when">{e(x['when'])}</span>
  <b>{e(x['degree'])}</b>
  <span>{e(x['school'])}</span>
  <span class="edu-meta">{e(x['score'])} · {e(x['where'])}</span>
</div>""" for x in EDUCATION)
    feed = "".join(f"""<li class="feed-item reveal"><span class="feed-tick">{i:02d}'</span><p>{e(b)}</p></li>"""
                   for i, b in enumerate(tr["experience"], 1))
    roles = "".join(f'<div class="role"><b>{e(t)}</b><span>{e(w)}</span></div>' for t, w in ROLES)
    resume = tr["resume"]
    preview = "assets/img/resume-" + ("Data" if track_key == "data" else "Software") + ".png"
    resume_name = resume.rsplit("/", 1)[-1]

    page = head(tr["title"], tr["description"], root, tr["noindex"], PERSON["site"] + "/") + f"""
<body class="home" id="top">
<div class="boot" id="boot" aria-hidden="true">
  <div class="boot-log" id="bootLog"></div>
  <div class="boot-logo">{LOGO}</div>
  <button class="boot-skip" type="button" id="bootSkip">skip ↵</button>
</div>

<section class="desktop" id="desktop" aria-label="Intro">
  <canvas class="dots" id="dots" aria-hidden="true"></canvas>
  <header class="masthead">
    <p class="wall-role"><span class="wall-dash"></span>{e(tr['role'])} · {e(tr['tagline'])}<span class="mh-status"><i></i>open to work<span class="mh-sep">·</span><svg class="globe" viewBox="0 0 24 24" aria-hidden="true"><circle cx="12" cy="12" r="9"/><path d="M3 12h18M12 3c2.6 2.8 3.9 5.8 3.9 9s-1.3 6.2-3.9 9c-2.6-2.8-3.9-5.8-3.9-9S9.4 5.8 12 3z"/></svg>relocation worldwide</span></p>
    <h1 class="wall-name" id="glitchName" aria-label="{e(PERSON['full'])}">
      {glitch_word(PERSON['first'])}
      {glitch_word(PERSON['middle'], 'accent')}
      {glitch_word(PERSON['last'])}
    </h1>
  </header>

  <div class="win win-term" data-win="terminal">
    <div class="win-bar"><span class="win-dots"><button class="wd wd-close" aria-label="Close terminal"></button><i></i><i></i></span><span class="win-title">anurag@anb: ~</span></div>
    <div class="win-body term" id="term">
      <div class="term-out" id="termOut">{term_lines}</div>
      <label class="term-in"><span>$</span><input id="termInput" type="text" autocomplete="off" spellcheck="false" aria-label="Terminal. Type help for commands" placeholder="type help"></label>
    </div>
  </div>

  <div class="win win-note" data-win="note">
    <div class="win-bar"><span class="win-dots"><button class="wd wd-close" aria-label="Close note"></button><i></i><i></i></span><span class="win-title">now.txt</span></div>
    <div class="win-body note">
      <p><b>Now:</b> looking for {e(tr['role'].lower())} roles.</p>
      <p>Based in Mumbai (IST). Open to relocating anywhere in the world.</p>
      <p class="note-game">Bored? Hit the <button type="button" data-open="game">controller</button> in the dock.</p>
      <a href="#work">see the work ↓</a>
    </div>
  </div>

  <div class="win win-photo" data-win="photo">
    <div class="win-bar"><span class="win-dots"><button class="wd wd-close" aria-label="Close photo"></button><i></i><i></i></span><span class="win-title">me.jpg</span></div>
    <div class="win-body photo" id="photoCard">
      <div class="photo-tilt">
        <img src="{root}assets/img/me.jpg" alt="Photo of {e(PERSON['full'])} at the Golden Gate Bridge" width="1000" height="1000">
        <img class="ph-g ph-a" src="{root}assets/img/me.jpg" alt="" aria-hidden="true">
        <img class="ph-g ph-b" src="{root}assets/img/me.jpg" alt="" aria-hidden="true">
        <span class="photo-shine" aria-hidden="true"></span>
      </div>
      <div class="photo-cap"><span>{e(PERSON['location'])}</span><span><svg class="globe" viewBox="0 0 24 24" aria-hidden="true"><circle cx="12" cy="12" r="9"/><path d="M3 12h18M12 3c2.6 2.8 3.9 5.8 3.9 9s-1.3 6.2-3.9 9c-2.6-2.8-3.9-5.8-3.9-9S9.4 5.8 12 3z"/></svg> relocation: worldwide</span></div>
    </div>
  </div>
</section>

<main class="sheet" id="main">
  <section class="sec" id="work">
    <div class="sec-head reveal">
      <span class="sec-num">01</span>
      <h2>Selected work</h2>
      <p class="sec-sub">{n} projects, each with the tests and numbers that back it up. Hover to peek, click for the full story.</p>
    </div>
    <ol class="rows">{''.join(rows)}</ol>
  </section>

  <section class="sec about" id="about">
    <div class="sec-head reveal"><span class="sec-num">02</span><h2>About</h2></div>
    <div class="about-grid">
      <div class="about-text reveal">{''.join(f'<p>{e(p)}</p>' for p in tr['about'])}</div>
      <div class="sysinfo card reveal">
        <div class="sys-head">{LOGO}<div><b>anurag@anb</b><span>uptime: 1 yr production</span></div></div>
        <dl>{facts}</dl>
      </div>
    </div>
    <div class="edu-row">{edu}</div>
  </section>

  <section class="sec skills-sec" id="skills">
    <div class="sec-head reveal"><span class="sec-num">03</span><h2>Skills</h2>
      <p class="sec-sub">Hover a skill to see where I've actually used it.</p></div>
    <div class="bento">{skills_html(track_key)}</div>
  </section>

  <section class="sec exp" id="experience">
    <div class="sec-head reveal"><span class="sec-num">04</span><h2>Experience</h2></div>
    <div class="broadcast card reveal">
      <div class="bc-top">
        <span class="bc-live">● ON AIR</span>
        <span class="bc-co">FAYBLE INC.</span>
        <span class="bc-meta">AI sports-simulation startup · California · remote</span>
      </div>
      <div class="bc-roles">{roles}</div>
      <ol class="feed">{feed}</ol>
      <figure class="quote">
        <img src="{root}{e(TESTIMONIAL['photo'])}" alt="{e(TESTIMONIAL['name'])}" loading="lazy">
        <blockquote>“{e(TESTIMONIAL['quote'])}”</blockquote>
        <figcaption><a class="quote-link" href="{e(TESTIMONIAL['url'])}" target="_blank" rel="noopener"><b>{e(TESTIMONIAL['name'])}</b></a> · {e(TESTIMONIAL['role'])} <span class="quote-go">LinkedIn ↗</span></figcaption>
      </figure>
    </div>
  </section>

  <section class="sec fax-sec" id="resume">
    <div class="sec-head reveal"><span class="sec-num">05</span><h2>Resume</h2><p class="sec-sub">One page. Press the button.</p></div>
    <div class="fax-stage reveal">
      <div class="fax" id="fax">
        <div class="paper" id="faxPaper">
          <button class="paper-inner" type="button" id="paperOpen" aria-label="Open resume">
            <img src="{root}{preview}" alt="Preview of my resume" loading="lazy">
          </button>
        </div>
        <div class="fax-body">
          <div class="fax-slot"></div>
          <div class="fax-panel">
            <div class="fax-lcd" id="faxLcd">READY · 1 PAGE</div>
            <button class="fax-btn" id="faxBtn" type="button">print resume</button>
          </div>
          <div class="fax-grille"><i></i><i></i><i></i><i></i><i></i></div>
        </div>
      </div>
      <noscript><a href="{root}{e(resume)}">Download my resume (PDF)</a></noscript>
    </div>
  </section>

  {contact_html()}
  {footer()}
</main>

{dock("./", True)}

<div class="appwin" id="gameWin" hidden>
  <div class="aw-back" data-close></div>
  <div class="aw aw-game" role="dialog" aria-label="Dev Run game">
    <div class="win-bar aw-bar"><span class="win-dots"><button class="wd wd-close" data-close aria-label="Close game"></button><i></i><i></i></span><span class="win-title">dev-run.app</span><span class="win-score">BEST TIME <b id="gBest">–</b></span></div>
    <div class="win-body game" id="gWrap">
      <canvas id="gCanvas"></canvas>
      <div class="g-ov" id="gOv"><b id="gOvT">DEV RUN</b><span id="gOv1">loading</span><span id="gOv2" class="g-hint"></span></div>
      <div class="g-touch" aria-hidden="true">
        <div class="g-pad"><button type="button" data-k="up" class="g-up">▲</button><button type="button" data-k="left">◀</button><button type="button" data-k="right">▶</button><button type="button" data-k="down" class="g-down">▼</button></div>
        <div class="g-acts"><div class="g-abil"><button type="button" data-k="pulse" class="g-sm">X</button><button type="button" data-k="firewall" class="g-sm">C</button><button type="button" data-k="slam" class="g-sm">V</button><button type="button" data-k="dash" class="g-sm">»</button><button type="button" data-k="block" class="g-sm">Q</button><button type="button" data-k="focus" class="g-sm">R</button></div><button type="button" data-k="slash">B</button><button type="button" data-k="jump" class="g-jump">A</button></div>
      </div>
    </div>
  </div>
</div>

<div class="appwin" id="resumeWin" hidden>
  <div class="aw-back" data-close></div>
  <div class="aw aw-resume" role="dialog" aria-label="Resume">
    <div class="win-bar aw-bar"><span class="win-dots"><button class="wd wd-close" data-close aria-label="Close resume"></button><i></i><i></i></span><span class="win-title">{e(resume_name)}</span>
      <span class="aw-tools"><a href="{root}{e(resume)}" download>download ↓</a><a href="{root}{e(resume)}" target="_blank" rel="noopener">new tab ↗</a></span></div>
    <div class="aw-body resume-body" id="resumeBody" data-pdf="{root}{e(resume)}" data-img="{root}{preview}"></div>
  </div>
</div>

""" + scripts(root, "home", track_key)
    out = ROOT / tr["prefix"] / "index.html"
    out.parent.mkdir(parents=True, exist_ok=True)
    out.write_text(page)
    return out


# ---------------------------------------------------------------------------
# Project page
# ---------------------------------------------------------------------------

def project(track_key, idx):
    tr = TRACKS[track_key]
    slugs = tr["projects"]
    slug = slugs[idx]
    p = PROJECTS[slug]
    nxt_slug = slugs[(idx + 1) % len(slugs)]
    nxt = PROJECTS[nxt_slug]
    depth = tr["prefix"].count("/") + 2
    root = "../" * depth
    home_url = "../../"

    metrics = "".join(f'<div class="met card reveal"><b>{e(v)}</b><span>{e(l)}</span></div>' for v, l in p["metrics"])
    chips = "".join(f"<li>{e(s)}</li>" for s in p["stack"])
    flow = '<span class="flow-arrow" aria-hidden="true"></span>'.join(
        f'<div class="flow-node card"><b>{e(a)}</b><span>{e(b)}</span></div>' for a, b in p["flow"])
    g_title = "What made it fast" if slug == "taxi-postgres-tuning" else "How it stays correct"
    guarantees = ""
    if p["guarantees"]:
        g = "".join(f'<div class="g-row card reveal"><b>{e(a)}</b><p>{e(b)}</p></div>' for a, b in p["guarantees"])
        guarantees = f'<section class="cs-sec"><h2 class="cs-h">{g_title}</h2><div class="g-list">{g}</div></section>'
    results = "".join(f'<div class="r-row"><dt>{e(a)}</dt><dd>{e(b)}</dd></div>' for a, b in p["results"])
    images = ""
    if p["images"]:
        figs = "".join(f'<figure class="cs-fig card reveal"><img src="{root}{e(s)}" alt="{e(a)}" loading="lazy"><figcaption>{e(c)}</figcaption></figure>'
                       for s, a, c in p["images"])
        images = f'<div class="cs-figs">{figs}</div>'

    canonical = f"{PERSON['site']}/work/{slug}/"
    page = head(f"{p['title']} · Anurag Bhandary", p["oneliner"], root, tr["noindex"], canonical) + f"""
<body class="case-page" id="top">
<main class="case">
  <header class="cs-hero">
    <a class="cs-back" href="{home_url}#work">← all work</a>
    <p class="cs-kicker">0{idx + 1} / 0{len(slugs)} · {e(p['kicker'])}</p>
    <h1 class="cs-title" style="view-transition-name:t-{slug}">{e(p['title'])}</h1>
    <p class="cs-one">{e(p['oneliner'])}</p>
    <div class="cs-actions">
      <a class="btn" href="{e(p['repo'])}" target="_blank" rel="noopener">{brand("github", "bi btn-ic")} source on GitHub ↗</a>
    </div>
    <ul class="chips">{chips}</ul>
  </header>

  <div class="mets">{metrics}</div>

  <section class="cs-sec">
    <h2 class="cs-h">Why I built this</h2>
    <div class="why">
      <div class="why-card card reveal"><span class="why-k">In the real world</span><p>{e(p['why'][0])}</p></div>
      <div class="why-card card reveal me"><span class="why-k">What I wanted to find out</span><p>{e(p['why'][1])}</p></div>
    </div>
  </section>

  <section class="cs-sec">
    <h2 class="cs-h">What I built</h2>
    <div class="cs-prose reveal">{''.join(f'<p>{e(x)}</p>' for x in p['problem'])}</div>
  </section>

  <section class="cs-sec">
    <h2 class="cs-h">How it works</h2>
    <div class="flow reveal">{flow}</div>
    <p class="flow-note reveal">{e(p['flow_note'])}</p>
  </section>

  {guarantees}

  <section class="cs-sec">
    <h2 class="cs-h">Measured</h2>
    <dl class="results reveal">{results}</dl>
    {images}
  </section>

  <a class="next" href="../{nxt_slug}/">
    <span class="next-label">next project</span>
    <span class="next-title">{e(nxt['title'])}</span>
    <span class="next-arrow" aria-hidden="true">→</span>
  </a>
</main>
{footer()}
{dock(home_url, False)}
""" + scripts(root, "project", track_key)
    out = ROOT / tr["prefix"] / "work" / slug / "index.html"
    out.parent.mkdir(parents=True, exist_ok=True)
    out.write_text(page)
    return out


def main():
    written = []
    for key, tr in TRACKS.items():
        written.append(home(key))
        for i in range(len(tr["projects"])):
            written.append(project(key, i))
    for w in written:
        print("wrote", w.relative_to(ROOT))


if __name__ == "__main__":
    main()
