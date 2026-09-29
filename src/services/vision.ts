// Image understanding — turns screenshots/photos into base64 for the AI
// vision pipeline and produces a description of what's in the image.
//
// Flow: local file → (resize/compress) → base64 → Gemini vision → text.
// The description is stored as `ocrText` so it feeds classification, search,
// and summaries (even though it is AI description rather than literal OCR).
import { manipulateAsync, SaveFormat } from "expo-image-manipulator";
import * as FileSystem from "expo-file-system/legacy";
import { classifyImageContent } from "../ai/aiService";

/** Max dimension sent to the vision model — keeps payloads small and cheap. */
const MAX_DIM = 1280;

export interface ImageUnderstanding {
  base64: string | null; // jpeg, no data-uri prefix
  description: string | null; // what the model saw, stored as ocrText
}

/**
 * Prepare an image for the AI: downscale + JPEG-compress, return base64.
 * Returns null if the file can't be read (caller degrades gracefully).
 */
export async function prepareImageBase64(fileUri: string): Promise<string | null> {
  try {
    const info = await FileSystem.getInfoAsync(fileUri);
    if (!info.exists) return null;

    // Try to normalize size/format; if manipulation fails (exotic format),
    // fall back to reading the original bytes.
    let workingUri = fileUri;
    try {
      const resized = await manipulateAsync(
        fileUri,
        [{ resize: { width: MAX_DIM } }], // height scales proportionally
        { compress: 0.75, format: SaveFormat.JPEG },
      );
      workingUri = resized.uri;
    } catch {
      // keep original
    }

    const base64 = await FileSystem.readAsStringAsync(workingUri, {
      encoding: FileSystem.EncodingType.Base64,
    });
    return base64 || null;
  } catch {
    return null;
  }
}

/**
 * Describe an image with the vision model (no store access — pure function).
 */
export async function describeImage(base64: string): Promise<string | null> {
  try {
    return await classifyImageContent(base64);
  } catch {
    return null;
  }
}

/**
 * Full pipeline for a captured image item: base64 + AI description.
 */
export async function understandImage(fileUri: string): Promise<ImageUnderstanding> {
  const base64 = await prepareImageBase64(fileUri);
  if (!base64) return { base64: null, description: null };
  const description = await describeImage(base64);
  return { base64, description };
}
