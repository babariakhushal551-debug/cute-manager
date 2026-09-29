// Voice transcription via the built-in AI provider (Gemini handles audio
// natively). Falls back gracefully: without AI, voice notes are saved
// untranscribed and the UI hints that transcription is unavailable.
//
// NOTE: expo-file-system legacy API — the modern SDK 54+ barrel no longer
// exports getInfoAsync/readAsStringAsync (they throw at runtime).
import * as FileSystem from "expo-file-system/legacy";
import { transcribeWithAI } from "../ai/aiService";
import { useStore } from "../data/store";

export interface TranscriptionResult {
  transcript: string | null;
  provider: "gemini" | "none";
}

export async function transcribeAudio(fileUri: string): Promise<TranscriptionResult> {
  try {
    const info = await FileSystem.getInfoAsync(fileUri);
    if (!info.exists) return { transcript: null, provider: "none" };
    const base64 = await FileSystem.readAsStringAsync(fileUri, {
      encoding: FileSystem.EncodingType.Base64,
    });
    if (!base64) return { transcript: null, provider: "none" };
    const cfg = useStore.getState().settings.ai;
    const text = await transcribeWithAI(base64, "audio/m4a", {
      provider: cfg.provider,
      apiKey: cfg.apiKey,
      model: cfg.model,
    });
    if (text) return { transcript: text, provider: "gemini" };
  } catch {
    // fall through
  }
  return { transcript: null, provider: "none" };
}
