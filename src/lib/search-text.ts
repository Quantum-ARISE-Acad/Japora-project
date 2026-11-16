/**
 * Text matching for customer search (marketplace and shop catalog).
 *
 * Pure functions, safe in the browser: no accents ("lome" finds "Lomé"),
 * no case, singular and plural alike ("robes" finds "Robe"), word prefixes
 * ("ank" finds "Ankara"), one typo allowed in longer words ("ankarra"),
 * and every word of the search must be found somewhere.
 */

const STOP_WORDS = new Set([
  "a", "au", "aux", "avec", "d", "de", "des", "du", "en", "et", "l", "la", "le", "les",
  "pour", "sur", "un", "une", "dans", "the", "of", "and", "for", "in", "with",
]);

/** "Robe Wax — Lomé" → "robe wax lome". */
export function normalizeSearch(text: string): string {
  return (text || "")
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, " ")
    .trim();
}

/** Singular form, good enough for French and English plurals. */
function stem(word: string): string {
  return word.length > 3 && /[sx]$/.test(word) ? word.slice(0, -1) : word;
}

/** The words to look for, without small words like "de" or "la" (unless that is all there is). */
export function searchTerms(query: string): string[] {
  const words = normalizeSearch(query).split(" ").filter(Boolean);
  const useful = words.filter((w) => !STOP_WORDS.has(w));
  return [...new Set((useful.length ? useful : words).map(stem))].slice(0, 8);
}

/** Prepare a text once, to test many search words against it. */
export function searchable(...parts: Array<string | null | undefined>): string[] {
  return normalizeSearch(parts.filter(Boolean).join(" ")).split(" ").filter(Boolean).map(stem);
}

/** At most one letter added, removed or changed between a and b. */
function withinOneEdit(a: string, b: string): boolean {
  if (Math.abs(a.length - b.length) > 1) return false;
  let i = 0;
  let j = 0;
  let edits = 0;
  while (i < a.length && j < b.length) {
    if (a[i] === b[j]) {
      i++;
      j++;
      continue;
    }
    if (++edits > 1) return false;
    if (a.length > b.length) i++;
    else if (b.length > a.length) j++;
    else {
      i++;
      j++;
    }
  }
  return edits + (a.length - i) + (b.length - j) <= 1;
}

/** 2 = whole word, 1 = start of a word or a close spelling, 0 = not found. */
export function termMatch(words: string[], term: string): 0 | 1 | 2 {
  let best: 0 | 1 | 2 = 0;
  for (const w of words) {
    if (w === term) return 2;
    if (w.startsWith(term) || (term.length >= 4 && w.includes(term))) best = 1;
    else if (term.length >= 5 && w.length >= 4 && withinOneEdit(w, term)) best = 1;
  }
  return best;
}

/**
 * Score of a record whose fields carry different weights (name counts more
 * than description). 0 when one search word is found nowhere.
 */
export function scoreFields(fields: Array<{ words: string[]; weight: number }>, terms: string[]): number {
  if (!terms.length) return 0;
  let total = 0;
  for (const term of terms) {
    let best = 0;
    for (const f of fields) {
      const m = termMatch(f.words, term);
      if (m) best = Math.max(best, f.weight * (m === 2 ? 1.5 : 1));
    }
    if (!best) return 0;
    total += best;
  }
  return total;
}

/** Quick yes / no for a list filter (shop catalog search box). */
export function matchesSearch(query: string, ...parts: Array<string | null | undefined>): boolean {
  const terms = searchTerms(query);
  if (!terms.length) return true;
  const words = searchable(...parts);
  return terms.every((t) => termMatch(words, t) > 0);
}
