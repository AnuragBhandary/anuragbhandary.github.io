// Asks AnuRAG real questions on the real models and checks the key facts in each answer.
//   npm run check            a temporary copy of the worker in this folder (run before deploying)
//   npm run check -- --live  the deployed worker
// Uses real quota (about 16 model calls) and waits between questions to stay under 10 a minute, so it takes a few
// minutes. The report prints here and is saved in checks/ so runs can be compared.
import { spawn } from "node:child_process";
import { mkdirSync, readFileSync, writeFileSync } from "node:fs";

const LIVE = "https://anurag-chat.anuragbhandary.workers.dev/chat";
const PORT = 8799;
const GAP_MS = 6500;
const ORIGIN = "https://anuragbhandary.github.io";
const live = process.argv.includes("--live");
const { conversations } = JSON.parse(readFileSync(new URL("../test/conversations.json", import.meta.url), "utf8"));
const wait = (ms) => new Promise((r) => setTimeout(r, ms));
// Local time, as "2026-11-04 09:30".
const stamp = new Date().toLocaleString("sv-SE").slice(0, 16);

// --remote runs this folder's code on Cloudflare with the deployed worker's keys, without deploying it.
async function startPreview() {
  const dev = spawn("npx", ["wrangler", "dev", "--remote", "--port", String(PORT)], { stdio: ["ignore", "pipe", "pipe"] });
  let log = "";
  await new Promise((resolve, reject) => {
    const seen = (chunk) => { log += chunk; if (log.includes("Ready on")) resolve(); };
    dev.stdout.on("data", seen);
    dev.stderr.on("data", seen);
    dev.on("exit", () => reject(new Error(`wrangler dev stopped:\n${log.slice(-800)}`)));
    setTimeout(() => reject(new Error(`wrangler dev not ready after 90 s:\n${log.slice(-800)}`)), 90000);
  });
  return dev;
}

function judge(turn, data) {
  const text = data.kind === "answer" ? data.answer : "";
  const fails = [];
  if (turn.kind && data.kind !== turn.kind) fails.push(`kind was ${data.kind}, expected ${turn.kind}`);
  for (const w of turn.has || []) if (!text.toLowerCase().includes(w.toLowerCase())) fails.push(`missing "${w}"`);
  for (const w of turn.not || []) if (text.toLowerCase().includes(w.toLowerCase())) fails.push(`contains "${w}"`);
  for (const a of turn.actions || []) if (!(data.actions || []).includes(a)) fails.push(`no ${a} button`);
  return fails;
}

const url = live ? LIVE : `http://localhost:${PORT}/chat`;
const dev = live ? null : await startPreview();
const lines = [`# AnuRAG check, ${stamp} (${live ? "live" : "this folder"})`, ""];
let passed = 0, total = 0, first = true;
try {
  for (const convo of conversations) {
    let history = [];
    for (const turn of convo) {
      if (!first) await wait(GAP_MS);
      first = false;
      const body = turn.job ? { mode: "fit", job: turn.job } : { question: turn.q, history, previous: history.at(-1)?.q || "" };
      const res = await fetch(url, { method: "POST", headers: { "Content-Type": "application/json", Origin: ORIGIN }, body: JSON.stringify(body) });
      const data = await res.json().catch(() => ({ kind: `http_${res.status}` }));
      const fails = judge(turn, data);
      total++;
      if (!fails.length) passed++;
      const asked = turn.job ? `[job description, ${turn.job.split(/\s+/).length} words]` : turn.q;
      const answer = data.kind === "answer" ? data.answer : `[${data.kind}]`;
      lines.push(`${fails.length ? "✗" : "✓"} **${asked}**${data.model ? `  _(${data.model})_` : ""}`, "",
        ...answer.split("\n").map((l) => `> ${l}`), "");
      if (data.next?.length || data.actions?.length) lines.push(`buttons: ${[...(data.actions || []), ...(data.next || [])].join(" · ")}`, "");
      if (fails.length) lines.push(`**failed:** ${fails.join("; ")}`, "");
      console.log(`${fails.length ? "✗" : "✓"} ${asked}${fails.length ? `  (${fails.join("; ")})` : ""}`);
      if (data.kind === "answer" || data.kind === "not_found") history = [...history, { q: turn.q || "Check this job description", a: answer.slice(0, 700) }].slice(-3);
    }
  }
} finally {
  dev?.kill();
}

lines.push(`**${passed}/${total} checks passed.**`);
mkdirSync(new URL("../checks/", import.meta.url), { recursive: true });
const file = new URL(`../checks/${stamp.replace(/[: ]/g, "-")}${live ? "-live" : ""}.md`, import.meta.url);
writeFileSync(file, lines.join("\n") + "\n");
console.log(`\n${passed}/${total} checks passed. Full report: worker/checks/${file.pathname.split("/").pop()}`);
process.exit(passed === total ? 0 : 1);
