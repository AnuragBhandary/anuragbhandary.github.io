// Checks a model reply before a visitor sees it. A wrong number about him costs more than a refusal.

export const NOT_FOUND = "NOT_IN_CONTEXT";

function numbers(text) {
  return (text.match(/\d[\d,.]*\d|\d/g) || []).map((n) => n.replace(/,/g, ""));
}

function durations(text) {
  return (text.toLowerCase().match(/\d+\+?\s*(?:years?|yrs?|months?)\b/g) || []).map((d) => d.replace(/\s+/g, " "));
}

// Text up to each group of markers, paired with the passages those markers name: "A [1][2] B [3]".
function claims(text) {
  const out = [];
  // Models also write one marker with several numbers: [1, 2].
  const re = /((?:\s*\[\s*\d+(?:\s*,\s*\d+)*\s*\])+)/g;
  let start = 0;
  let m;
  while ((m = re.exec(text))) {
    out.push({ prose: text.slice(start, m.index), cited: (m[1].match(/\d+/g) || []).map(Number) });
    start = m.index + m[0].length;
  }
  return { out, rest: text.slice(start) };
}

// Returns { ok, answer, cited } where cited holds 1-based passage numbers actually used.
export function check(reply, context) {
  const text = (reply || "").trim();
  if (!text || text.includes(NOT_FOUND)) return { ok: false, reason: "not_found" };

  const { out, rest } = claims(text);
  if (out.length === 0) return { ok: false, reason: "no_citation" };

  const cited = new Set();
  for (const claim of out) {
    if (claim.cited.some((n) => n < 1 || n > context.length)) return { ok: false, reason: "bad_citation" };
    claim.cited.forEach((n) => cited.add(n));
    // A number is only backed by the passage this claim cites, not by any passage that happened to be retrieved.
    const source = claim.cited.map((n) => `${context[n - 1].title} ${context[n - 1].text}`).join(" ");
    const known = new Set(numbers(source));
    const prose = claim.prose.replace(/^\s*\d+[.)]\s/gm, "");
    if (numbers(prose).some((n) => !known.has(n))) return { ok: false, reason: "unsupported_number" };
    const said = durations(source);
    if (durations(prose).some((d) => !said.includes(d))) return { ok: false, reason: "unsupported_number" };
  }
  if (numbers(rest).length > 0) return { ok: false, reason: "unsupported_number" };

  // Replies show as plain text, so markdown markers would appear literally.
  const answer = text.replace(/\s*\[\s*\d+(?:\s*,\s*\d+)*\s*\]/g, "").replace(/\*\*|`/g, "")
    .replace(/ +([.,;:!?])/g, "$1").replace(/ {2,}/g, " ").trim();
  return { ok: true, answer, cited: [...cited] };
}
