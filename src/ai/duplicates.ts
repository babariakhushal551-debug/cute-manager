// Duplicate & similar-item detection (PRD Phase 1.1).
// Tier-1 approach: exact URL match + token-overlap (Jaccard) similarity on title/content.
// Cheap, deterministic, no network required.

import type { Item } from "../data/types";
import { itemToText } from "./aiService";

export interface DuplicateMatch {
  existing: Item;
  score: number; // 0..1
  reason: "same-url" | "similar-text";
}

const STOPWORDS = new Set(
  "a an and are as at be but by for from has have how i in is it its of on or that the this to was what when where which who why will with you your".split(
    " ",
  ),
);

function tokenize(text: string): Set<string> {
  return new Set(
    text
      .toLowerCase()
      .replace(/https?:\/\/\S+/g, " ")
      .split(/[^a-z0-9]+/)
      .filter((t) => t.length > 2 && !STOPWORDS.has(t)),
  );
}

/** Exported alias for related-items scoring. */
export const tokenizeText = tokenize;

export function jaccard(a: Set<string>, b: Set<string>): number {
  if (a.size === 0 || b.size === 0) return 0;
  let inter = 0;
  for (const t of a) if (b.has(t)) inter++;
  return inter / (a.size + b.size - inter);
}

function normalizeUrl(url: string): string {
  try {
    const u = new URL(url);
    // strip tracking params & trailing slash, lowercase host
    const drop = [...u.searchParams.keys()].filter((k) =>
      /^(utm_|fbclid|igsh|si|feature|app)$/.test(k),
    );
    drop.forEach((k) => u.searchParams.delete(k));
    let s = `${u.host.replace(/^www\./, "")}${u.pathname.replace(/\/+$/, "")}`;
    const q = u.searchParams.toString();
    if (q) s += `?${q}`;
    return s.toLowerCase();
  } catch {
    return url.toLowerCase();
  }
}

function extractUrls(text: string): string[] {
  return text.match(/https?:\/\/[^\s]+/gi) ?? [];
}

/** Find duplicates/similar items among the user's existing items (all statuses). */
export function findSimilar(item: Item, allItems: Item[]): DuplicateMatch[] {
  const matches: DuplicateMatch[] = [];
  const newUrls = new Set(
    [item.sourceUrl, ...extractUrls(itemToText(item))].filter(Boolean).map((u) => normalizeUrl(u!)),
  );
  const newTokens = tokenize(itemToText(item));

  for (const other of allItems) {
    if (other.id === item.id) continue;

    // 1) URL match — strongest signal
    const otherUrls = new Set(
      [other.sourceUrl, ...extractUrls(itemToText(other))].filter(Boolean).map((u) => normalizeUrl(u!)),
    );
    for (const u of newUrls) {
      if (u && otherUrls.has(u)) {
        matches.push({ existing: other, score: 1, reason: "same-url" });
        break;
      }
    }
    if (matches.some((m) => m.existing.id === other.id)) continue;

    // 2) Text similarity
    const score = jaccard(newTokens, tokenize(itemToText(other)));
    if (score >= 0.55) {
      matches.push({ existing: other, score, reason: "similar-text" });
    }
  }

  return matches.sort((a, b) => b.score - a.score).slice(0, 3);
}
