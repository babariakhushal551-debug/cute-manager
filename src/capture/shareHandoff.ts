// App-side receiver for the entitlement-free share handoff.
//
// The share extension encodes its payload as base64 JSON inside a
// curio://curio-data?payload=... URL. iOS opens the app with that URL and
// expo-router routes it to app/curio-data.tsx, which calls ingestCurioPayload.
//
// Links/text: payload carries the content directly.
// Images: payload says "look at the Pasteboard" (data placed there by the
//   extension, auto-expires in 15 min); we read it via expo-clipboard and
//   write a local file, then the AI vision pipeline takes over.
import { Alert } from "react-native";
import * as Clipboard from "expo-clipboard";
import * as FileSystem from "expo-file-system/legacy";
import { useStore } from "../data/store";
import { ingestShare } from "./shareIntake";
import { haptic } from "../services/haptics";

export interface CurioPayload {
  text?: string;
  webUrl?: string;
  meta?: Record<string, string>;
  pasteboard?: boolean;
  kind?: string; // link | text | image | video | file
  nonce?: string; // unique per share — keeps dedupe from swallowing re-shares
}

const processed = new Set<string>();

function waitForHydration(): Promise<void> {
  return new Promise((resolve) => {
    // Poll + subscribe: covers the race where hydration completes between
    // the state read and the subscription registration.
    const unsubscribe = useStore.subscribe((s) => {
      if (s.hydrated) done();
    });
    const iv = setInterval(() => {
      if (useStore.getState().hydrated) done();
    }, 100);
    let finished = false;
    function done() {
      if (finished) return;
      finished = true;
      unsubscribe();
      clearInterval(iv);
      resolve();
    }
    if (useStore.getState().hydrated) done();
  });
}

function parsePayload(encoded: string): CurioPayload | null {
  try {
    // Encoding chain (Swift side): base64 → manual %-encode (+ / =) →
    // URLComponents %-encodes our % again → router decodes once. So exactly
    // ONE decodeURIComponent is needed here to get back to raw base64.
    const decode = (globalThis as { atob?: (data: string) => string }).atob;
    if (typeof decode !== "function") return null;
    const json = decode(decodeURIComponent(encoded));
    const parsed = JSON.parse(json) as CurioPayload;
    if (parsed && typeof parsed === "object") return parsed;
    return null;
  } catch {
    return null;
  }
}

async function readSharedImageFromPasteboard(): Promise<{ base64: string } | null> {
  try {
    const result = await Clipboard.getImageAsync({ format: "png" });
    if (result?.data) return { base64: result.data };
    return null;
  } catch {
    return null;
  }
}

/**
 * Ingest a share handed off by the CurioShare extension.
 * Safe to call twice with the same payload — duplicates are ignored.
 */
export async function ingestCurioPayload(encodedPayload: string): Promise<void> {
  if (!encodedPayload || processed.has(encodedPayload)) return;
  processed.add(encodedPayload);
  // Keep the dedupe set bounded.
  if (processed.size > 20) {
    const first = processed.values().next().value;
    if (first) processed.delete(first);
  }

  const payload = parsePayload(encodedPayload);
  if (!payload) return;

  await waitForHydration();

  // Media shared via Pasteboard.
  if (payload.pasteboard) {
    if (payload.kind === "image") {
      const img = await readSharedImageFromPasteboard();
      if (!img) {
        Alert.alert("Share missed", "Curio couldn't read that image. Try sharing it again.");
        return;
      }
      const dir = `${FileSystem.documentDirectory}curio-shares/`;
      await FileSystem.makeDirectoryAsync(dir, { intermediates: true }).catch(() => {});
      const path = `${dir}shared-${Date.now()}.png`;
      await FileSystem.writeAsStringAsync(path, img.base64, { encoding: FileSystem.EncodingType.Base64 });
      await ingestShare({
        files: [{ path, mimeType: "image/png", fileName: "Shared image" }],
      });
      haptic.success();
      return;
    }
    // Videos/other files cannot round-trip through the pasteboard as data.
    Alert.alert(
      "Almost there",
      "Curio can't ingest that media type from the share sheet yet — use the + button inside the app for videos and files.",
    );
    return;
  }

  // Link / text share — same intake as manual capture.
  if (payload.webUrl || payload.text) {
    await ingestShare({
      text: payload.text ?? undefined,
      webUrl: payload.webUrl ?? undefined,
    });
    haptic.success();
  }
}
