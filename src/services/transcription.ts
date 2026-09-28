// Voice transcription — OpenAI Whisper / Groq Whisper-compatible endpoints.
// Falls back gracefully: without a key, voice notes are saved with transcript = null
// and the app tells the user they can add a key in Settings to auto-transcribe.
import * as FileSystem from "expo-file-system";
import { useStore } from "../data/store";

export interface TranscriptionResult {
  transcript: string | null;
  provider: "openai" | "groq" | "none";
}

async function transcribeWithProvider(
  fileUri: string,
  provider: "openai" | "groq",
  apiKey: string,
  model?: string,
): Promise<string | null> {
  // Read the local recording as base64 and post as multipart via FormData.
  const fileInfo = await FileSystem.getInfoAsync(fileUri);
  if (!fileInfo.exists) throw new Error("Recording file missing");

  const endpoint =
    provider === "groq"
      ? "https://api.groq.com/openai/v1/audio/transcriptions"
      : "https://api.openai.com/v1/audio/transcriptions";
  const modelName = provider === "groq" ? model ?? "whisper-large-v3" : model ?? "whisper-1";

  const form = new FormData();
  form.append("file", {
    uri: fileUri,
    name: "audio.m4a",
    type: "audio/m4a",
  } as unknown as Blob);
  form.append("model", modelName);
  form.append("response_format", "json");

  const res = await fetch(endpoint, {
    method: "POST",
    headers: { Authorization: `Bearer ${apiKey}` },
    body: form,
  });
  if (!res.ok) throw new Error(`${provider} transcription ${res.status}`);
  const data = (await res.json()) as { text?: string };
  return data.text?.trim() || null;
}

export async function transcribeAudio(fileUri: string): Promise<TranscriptionResult> {
  const { provider, apiKey } = useStore.getState().settings.ai;
  try {
    if (apiKey && provider === "openai") {
      const text = await transcribeWithProvider(fileUri, "openai", apiKey);
      return { transcript: text, provider: "openai" };
    }
    if (apiKey && provider === "groq") {
      const text = await transcribeWithProvider(fileUri, "groq", apiKey);
      return { transcript: text, provider: "groq" };
    }
  } catch {
    // fall through to none
  }
  return { transcript: null, provider: "none" };
}
