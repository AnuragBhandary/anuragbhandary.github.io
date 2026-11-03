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
    out.push({ prose: text.slice(start, m.index), markers: m[1], cited: (m[1].match(/\d+/g) || []).map(Number) });
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
  let kept = "";
  let dropped = 0;
  for (const claim of out) {
    if (claim.cited.some((n) => n < 1 || n > context.length)) return { ok: false, reason: "bad_citation" };
    // A number is only backed by the passage this claim cites, not by any passage that happened to be retrieved.
    const source = claim.cited.map((n) => `${context[n - 1].title} ${context[n - 1].text}`).join(" ");
    const known = new Set(numbers(source));
    const prose = claim.prose.replace(/^\s*\d+[.)]\s/gm, "");
    const said = durations(source);
    if (numbers(prose).some((n) => !known.has(n)) || durations(prose).some((d) => !said.includes(d))) {
      // Found by running it: the fallback model added one sum of its own to a long, correct answer, and the
      // whole answer was withheld. Only that sentence goes; its leading punctuation still ends the one before.
      dropped++;
      kept += claim.prose.match(/^[\s.,;:!?]*/)[0];
      continue;
    }
    claim.cited.forEach((n) => cited.add(n));
    kept += claim.prose + claim.markers;
  }
  const restBad = numbers(rest).length > 0;
  if (restBad) dropped++;
  else kept += rest;
  // Half or more unsupported means the model wasn't reading the passages, so none of it is trusted.
  if (dropped > 0 && dropped * 2 >= out.length + (restBad ? 1 : 0)) return { ok: false, reason: "unsupported_number" };

  // Replies show as plain text, so markdown markers would appear literally.
  // List items keep their own lines (the chat shows line breaks); their dashes become bullets.
  // gpt-oss writes narrow no-break spaces and no-break hyphens, and now and then misspells his name (seen:
  // "Anuraj", "Anurak"). Plain characters keep the clean-up below working; "AnuRAG" doesn't match.
  const answer = kept.replace(/[\u00a0\u202f\u2009]/g, " ").replace(/[\u2010\u2011]/g, "-").replace(/\bAnura[a-fh-z]\b/g, "Anurag")
    .replace(/[ \t]*\[\s*\d+(?:\s*,\s*\d+)*\s*\]/g, "").replace(/([.!?])(?:[ \t]*[.!?])+/g, "$1").replace(/\*\*|`/g, "")
    .replace(/^[ \t]*[-*•][ \t]+/gm, "• ").replace(/^#+[ \t]*/gm, "")
    .replace(/ +([.,;:!?])/g, "$1").replace(/ {2,}/g, " ").replace(/[ \t]+$/gm, "")
    .replace(/\n+(?!• )([^\n]+:)\n(?=• )/g, "\n\n$1\n").replace(/\n{3,}/g, "\n\n").replace(/^[\s.,;:!?]+/, "").trim();
  return { ok: true, answer, cited: [...cited] };
}
