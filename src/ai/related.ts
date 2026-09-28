// Related content suggestions — finds other saved items sharing tags/topics.
// Tier-1: shared item tags first, then token overlap as backup. No network needed.

import type { Item, ItemTag, Tag } from "../data/types";
import { itemToText, extractFirstUrl } from "./aiService";
import { jaccard, tokenizeText } from "./duplicates";

export interface RelatedItem {
  item: Item;
  reason: string;
  score: number;
}

export function findRelated(
  item: Item,
  allItems: Item[],
  itemTags: ItemTag[],
  tags: Tag[],
  limit = 4,
): RelatedItem[] {
  if (item.status === "DISMISSED") return [];
  const myTagIds = new Set(itemTags.filter((it) => it.itemId === item.id).map((it) => it.tagId));
  const myTokens = tokenizeText(itemToText(item));
  const myUrls = new Set(
    [item.sourceUrl, extractFirstUrl(itemToText(item))].filter(Boolean) as string[],
  );

  const results: RelatedItem[] = [];

  for (const other of allItems) {
    if (other.id === item.id) continue;
    if (other.status === "DISMISSED") continue;

    const otherTagIds = new Set(itemTags.filter((it) => it.itemId === other.id).map((it) => it.tagId));
    const shared = [...myTagIds].filter((t) => otherTagIds.has(t));

    let score = 0;
    let reason = "";
    if (shared.length > 0) {
      const names = shared
        .map((id) => tags.find((t) => t.id === id)?.name)
        .filter(Boolean)
        .slice(0, 2);
      score = 0.5 + Math.min(0.3, shared.length * 0.15);
      reason = `Both tagged ${names.map((n) => `#${n}`).join(" · ")}`;
    }

    const tokenScore = jaccard(myTokens, tokenizeText(itemToText(other)));
    if (tokenScore > 0.18 && tokenScore * 0.8 > score * 0.5) {
      if (!reason || tokenScore > 0.45) {
        score = Math.max(score, tokenScore * 0.8);
        reason = reason || "Similar topic";
      }
    }

    // same source domain (e.g. both YouTube videos from same channel page)
    const otherUrl = other.sourceUrl ?? extractFirstUrl(itemToText(other));
    if (myUrls.size && otherUrl && !reason) {
      try {
        const d1 = new URL(myUrls.values().next().value!).host;
        const d2 = new URL(otherUrl).host;
        if (d1 === d2) {
          score = Math.max(score, 0.25);
          reason = `Also from ${d1.replace(/^www\./, "")}`;
        }
      } catch {
        // ignore malformed urls
      }
    }

    if (score >= 0.25 && reason) {
      results.push({ item: other, reason, score });
    }
  }

  return results.sort((a, b) => b.score - a.score).slice(0, limit);
}
