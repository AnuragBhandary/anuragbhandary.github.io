// Lists the questions AnuRAG couldn't answer, newest first: `npm run misses` (add a number for more than 50).
// Each one is a gap to fill: a passage, a page, or a routing rule.
import { execFileSync } from "node:child_process";

const limit = Number(process.argv[2]) || 50;
const raw = execFileSync("npx", ["wrangler", "kv", "key", "list", "--binding", "MISSES", "--remote"], { encoding: "utf8" });
const misses = JSON.parse(raw.slice(raw.indexOf("["))).map((k) => k.metadata).filter(Boolean)
  .sort((a, b) => b.at.localeCompare(a.at));

if (!misses.length) console.log("No missed questions yet.");
for (const m of misses.slice(0, limit)) {
  const where = m.page ? ` (on ${m.page})` : "";
  console.log(`${m.at.slice(0, 16).replace("T", " ")}  ${m.reason.padEnd(18)}  ${m.q}${where}`);
}
if (misses.length > limit) console.log(`\n...and ${misses.length - limit} older. Run \`npm run misses ${misses.length}\` for all.`);
