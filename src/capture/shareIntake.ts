// Share-extension intake: converts shareIntent payloads into items (from Instagram, YouTube, WhatsApp, Photos, Safari…).
import { useStore } from "../data/store";
import { normalizeInput, fetchLinkMeta, titleFromUrl, titleFromText } from "./captureService";
import { processItem } from "../ai/pipeline";
import { detectPlatform } from "../ai/aiService";
import type { ItemType } from "../data/types";

export interface IncomingShare {
  text?: string;
  webUrl?: string;
  files?: { path: string; mimeType: string; fileName?: string }[];
}

function typeFromMime(mime: string): ItemType {
  if (mime.startsWith("image/")) return "image";
  if (mime.startsWith("video/")) return "link"; // treat shared videos as media items
  if (mime === "application/pdf") return "pdf";
  if (mime.startsWith("audio/")) return "voice";
  return "text";
}

/** Route an incoming share (from Instagram/YouTube/WhatsApp share sheet) into the inbox and kick off AI processing. */
export async function ingestShare(share: IncomingShare): Promise<string | null> {
  const store = useStore.getState();
  let createdId: string | null = null;

  // 1) URL / text share
  const rawText = [share.text, share.webUrl].filter(Boolean).join("\n").trim();
  if (rawText) {
    const { type, url } = normalizeInput(rawText);
    let title = titleFromText(rawText);
    let thumbnailUrl: string | undefined;
    let sourceUrl: string | undefined;

    if (type === "link" && url) {
      sourceUrl = url;
      const meta = await fetchLinkMeta(url);
      title = meta.title ?? titleFromUrl(url);
      thumbnailUrl = meta.thumbnailUrl;
    }

    const item = store.addItem({
      type,
      title,
      content: rawText,
      sourceUrl,
      sourcePlatform: sourceUrl ? detectPlatform(sourceUrl) : undefined,
      thumbnailUrl,
      status: "INBOX",
    });
    createdId = item.id;
    void processItem(item);
  }

  // 2) File share (screenshot / video / pdf)
  for (const f of share.files ?? []) {
    const type = typeFromMime(f.mimeType);
    const item = store.addItem({
      type,
      title: f.fileName ?? "Shared file",
      content: "",
      fileUri: f.path,
      mimeType: f.mimeType,
      status: "INBOX",
    });
    createdId = createdId ?? item.id;
    void processItem(item);
  }

  return createdId;
}
