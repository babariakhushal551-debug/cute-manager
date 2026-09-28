// Capture utilities: link metadata fetch (Tier 1, graceful degradation), OCR, voice notes.
import { extractFirstUrl, detectPlatform } from "../ai/aiService";

export interface LinkMeta {
  url: string;
  platform?: string;
  title?: string;
  thumbnailUrl?: string;
}

export function normalizeInput(text: string): { type: "link" | "text"; url?: string } {
  const url = extractFirstUrl(text);
  if (url) return { type: "link", url };
  return { type: "text" };
}

// Fetch Open Graph metadata via microlink (free tier, no key). Fails gracefully offline.
export async function fetchLinkMeta(url: string): Promise<LinkMeta> {
  const platform = detectPlatform(url);
  const fallback: LinkMeta = { url, platform };
  try {
    const res = await fetch(`https://api.microlink.io/?url=${encodeURIComponent(url)}`);
    if (!res.ok) return fallback;
    const data = (await res.json()) as {
      status?: string;
      data?: { title?: string; description?: string; image?: { url?: string } };
    };
    if (data.status !== "success" || !data.data) return fallback;
    return {
      url,
      platform,
      title: data.data.title ?? undefined,
      thumbnailUrl: data.data.image?.url ?? undefined,
    };
  } catch {
    return fallback;
  }
}

// Derive a readable title from a URL when metadata is unavailable
export function titleFromUrl(url: string): string {
  try {
    const u = new URL(url);
    const seg = u.pathname.split("/").filter(Boolean).pop() ?? u.hostname;
    const cleaned = decodeURIComponent(seg)
      .replace(/\.(html?|php)$/i, "")
      .replace(/[-_]+/g, " ")
      .trim();
    const pretty = cleaned.length > 2 ? cleaned : u.hostname.replace(/^www\./, "");
    return pretty.charAt(0).toUpperCase() + pretty.slice(1);
  } catch {
    return url;
  }
}

export function titleFromText(text: string): string {
  const firstLine = text.split("\n").map((l) => l.trim()).find((l) => l.length > 0) ?? "Quick note";
  return firstLine.slice(0, 80);
}
