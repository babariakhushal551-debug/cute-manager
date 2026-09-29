// Quick capture — one input for text/URL, plus photo, PDF and voice. Optimistic save.
import { useState } from "react";
import { View, Text, TextInput, Pressable, KeyboardAvoidingView, Platform, ActivityIndicator, ScrollView } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { router, Stack } from "expo-router";
import * as ImagePicker from "expo-image-picker";
import * as DocumentPicker from "expo-document-picker";
import { useTheme } from "../src/theme/theme";
import { useStore } from "../src/data/store";
import { fetchLinkMeta, normalizeInput, titleFromText, titleFromUrl } from "../src/capture/captureService";
import { processItem } from "../src/ai/pipeline";
import { detectPlatform } from "../src/ai/aiService";
import { transcribeAudio } from "../src/services/transcription";
import { Button, Card, Symbol } from "../src/ui/primitives";
import { VoiceRecorder } from "../src/ui/VoiceRecorder";
import { haptic } from "../src/services/haptics";

export default function CaptureScreen() {
  const { palette, typography, space, radius } = useTheme();
  const addItem = useStore((s) => s.addItem);
  const [text, setText] = useState("");
  const [busy, setBusy] = useState(false);
  const [voiceHint, setVoiceHint] = useState(false);

  async function commit(input: {
    type: "link" | "text" | "image" | "pdf" | "voice";
    title: string;
    content?: string;
    sourceUrl?: string;
    fileUri?: string;
    mimeType?: string;
    thumbnailUrl?: string;
  }) {
    const item = addItem({ ...input, status: "INBOX" });
    void processItem(item);
    haptic.success();
    router.replace("/(tabs)/inbox");
  }

  async function submitText() {
    const raw = text.trim();
    if (!raw) return;
    setBusy(true);
    try {
      const { type, url } = normalizeInput(raw);
      if (type === "link" && url) {
        const meta = await fetchLinkMeta(url);
        await commit({
          type: "link",
          title: meta.title ?? titleFromUrl(url),
          content: raw,
          sourceUrl: url,
          thumbnailUrl: meta.thumbnailUrl,
        });
      } else {
        await commit({ type: "text", title: titleFromText(raw), content: raw });
      }
    } finally {
      setBusy(false);
    }
  }

  async function pickImage() {
    const res = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ["images", "videos"],
      quality: 0.8,
    });
    if (res.canceled || res.assets.length === 0) return;
    const a = res.assets[0];
    await commit({
      type: a.type === "video" ? "link" : "image",
      title: a.fileName ?? (a.type === "video" ? "Shared video" : "Screenshot"),
      fileUri: a.uri,
      mimeType: a.mimeType ?? "image/jpeg",
    });
  }

  async function pickPdf() {
    const res = await DocumentPicker.getDocumentAsync({ type: "application/pdf" });
    if (res.canceled) return;
    const f = res.assets[0];
    await commit({ type: "pdf", title: f.name, fileUri: f.uri, mimeType: "application/pdf" });
  }

  async function saveVoice(result: { uri: string; durationSec: number }) {
    setBusy(true);
    try {
      // Try to transcribe with the configured provider; otherwise save with a note.
      const { transcript, provider } = await transcribeAudio(result.uri);
      const mins = Math.max(1, Math.round(result.durationSec / 60));
      const title = transcript
        ? transcript.split(/[.!?</\n]/)[0].slice(0, 60) || "Voice note"
        : `Voice note · ${mins} min`;
      await commit({
        type: "voice",
        title,
        content: transcript ?? "",
        fileUri: result.uri,
        mimeType: "audio/m4a",
      });
      if (provider === "none") {
        // Non-blocking hint — item is already saved.
        setVoiceHint(true);
      }
    } finally {
      setBusy(false);
    }
  }

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: palette.bg }} edges={["top", "bottom"]}>
      <Stack.Screen options={{ presentation: "card" }} />
      <KeyboardAvoidingView behavior={Platform.OS === "ios" ? "padding" : undefined} style={{ flex: 1 }}>
        <View style={{ paddingHorizontal: space.xl, paddingTop: space.l, flexDirection: "row", alignItems: "center" }}>
          <Pressable onPress={() => router.back()} hitSlop={8} style={{ marginRight: space.m }}>
            <Symbol name="xmark" size={20} color={palette.ink} />
          </Pressable>
          <Text style={{ ...typography.title3, color: palette.ink }}>Capture</Text>
          <View style={{ marginLeft: "auto" }}>
            <Text style={{ ...typography.footnote, color: palette.inkFaint }}>I'll figure out the rest ✨</Text>
          </View>
        </View>

        <ScrollView style={{ flex: 1 }} contentContainerStyle={{ paddingHorizontal: space.xl, paddingTop: space.xl, paddingBottom: space.xl }} showsVerticalScrollIndicator={false}>
          <TextInput
            autoFocus
            multiline
            value={text}
            onChangeText={setText}
            placeholder="Paste a link (YouTube, Instagram, anything) or just start typing…"
            placeholderTextColor={palette.inkFaint}
            style={{
              minHeight: 140,
              backgroundColor: palette.surface,
              borderRadius: radius.l,
              borderWidth: 1,
              borderColor: palette.hairline,
              padding: space.l,
              fontSize: 16,
              lineHeight: 23,
              color: palette.ink,
              textAlignVertical: "top",
            }}
          />

          <View style={{ flexDirection: "row", gap: 10, marginTop: space.l }}>
            <Button title="Photo / Video" icon="photo" variant="soft" small onPress={pickImage} />
            <Button title="PDF" icon="doc.richtext" variant="soft" small onPress={pickPdf} />
          </View>

          <View style={{ marginTop: space.l }}>
            <VoiceRecorder onSaved={saveVoice} />
          </View>

          {voiceHint ? (
            <Card style={{ marginTop: space.m, padding: space.m }}>
              <Text style={{ ...typography.footnote, color: palette.inkDim, lineHeight: 18 }}>
                💡 Saved! Transcription isn't available right now — check your connection or AI settings.
              </Text>
            </Card>
          ) : null}

          <View style={{ marginTop: space.xl }}>
            {busy ? (
              <View style={{ alignItems: "center", padding: space.l }}>
                <ActivityIndicator color={palette.pink} />
              </View>
            ) : (
              <Button title="Save to Inbox" icon="tray.and.arrow.down" onPress={submitText} disabled={!text.trim()} />
            )}
          </View>
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}
