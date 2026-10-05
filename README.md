# anuragbhandary.github.io

Plain HTML, CSS and JavaScript. No framework, no npm.

| URL | What |
|---|---|
| `/` | Software portfolio (public, linked everywhere) |
| `/data/` | Data portfolio (unlisted, `noindex`; send only with data applications) |

## Edit

1. Change text in `src/content.py` (projects, about, experience, which projects each page shows).
2. Run `python3 src/build.py`. It regenerates `index.html`, `data/index.html` and every `work/*/index.html`.
3. Preview: `python3 -m http.server 8765`, then open http://localhost:8765.

Styles are in `assets/css/site.css` (colours are the variables at the top). Interactions are in `assets/js/site.js`.
Resumes live in `resume/`; `resume.pdf` at the root is kept for old links and is the Software resume.

## Live LeetCode stats

LeetCode's API can't be called from a browser, so `.github/workflows/leetcode.yml` runs `src/leetcode.py`
every 6 hours on GitHub, writes `assets/data/leetcode.json` and commits it if anything changed. The Skills
section reads that file. To refresh by hand: `python3 src/leetcode.py`, or "Run workflow" in the repo's Actions tab.

## Dev Run (the game)

`assets/js/game.js` is a small Hollow Knight-style action platformer: 3 zones and a boss, with wall jumps,
a double jump, Code Slash, Debug Pulse, Firewall, Laptop Slam, Cache Dash and Focus heal. It opens from the
controller icon in the dock.

- Sprites live in `assets/sprites/` (sheets + JSON frame maps). They were generated with ChatGPT and are
  loaded only when the game is opened, so they don't slow down the portfolio itself.
- Levels are built in code (`ZONES` near the top of `game.js`): `carve` cuts rooms, `plat` adds jump-through
  grates, `spikes`, `brk` adds cracked floor that Laptop Slam breaks. Tiles are 32 px.
- Keys: arrows or WASD move and aim, SPACE jump (again in mid-air, or off a wall), E attack,
  F shoot, Q block/parry, R (hold) heal, C firewall, V slam, SHIFT dash, ESC pause menu (with instructions).
