// BM25 over the site's content. The corpus is a few dozen short passages, so this needs no vector store.

const K1 = 1.2;
const B = 0.75;

// "anurag" is on every page, so a question that only names him has asked nothing yet.
const STOP = new Set(("a about all also am an and any are as at be been but by can could did do does for from "
  + "get give has have he her him his how i if in into is it its just know like me more my of on or our she "
  + "should so tell than that the their them then there these they this to us was we were what when where "
  + "which who why will with would you your anurag bhandary please").split(" "));

export function tokens(text) {
  return (text.toLowerCase().match(/[a-z0-9+#]+/g) || [])
    .filter((t) => !STOP.has(t))
    .map((t) => (t.length > 3 && t.endsWith("s") && !t.endsWith("ss") ? t.slice(0, -1) : t));
}

export function buildIndex(chunks) {
  const docs = chunks.map((chunk) => {
    const counts = new Map();
    const words = tokens(`${chunk.title} ${chunk.title} ${chunk.text}`);
    for (const w of words) counts.set(w, (counts.get(w) || 0) + 1);
    return { chunk, counts, length: words.length };
  });
  const df = new Map();
  for (const d of docs) for (const w of d.counts.keys()) df.set(w, (df.get(w) || 0) + 1);
  const avg = docs.reduce((sum, d) => sum + d.length, 0) / docs.length;
  return { docs, df, avg };
}

export function search(index, question, k = 4) {
  const terms = [...new Set(tokens(question))];
  const n = index.docs.length;
  return index.docs
    .map((d) => {
      let score = 0;
      for (const t of terms) {
        const f = d.counts.get(t);
        if (!f) continue;
        const df = index.df.get(t);
        const idf = Math.log(1 + (n - df + 0.5) / (df + 0.5));
        score += idf * (f * (K1 + 1)) / (f + K1 * (1 - B + B * d.length / index.avg));
      }
      return { chunk: d.chunk, score };
    })
    .filter((r) => r.score > 0)
    .sort((a, b) => b.score - a.score)
    .slice(0, k)
    .map((r) => r.chunk);
}
