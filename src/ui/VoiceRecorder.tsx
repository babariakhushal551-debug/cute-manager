// Voice memo capture — record with expo-audio, save as a voice item, auto-transcribe when a key is set.
import { useEffect, useRef, useState } from "react";
import { View, Text, Pressable, Alert, ActivityIndicator } from "react-native";
import {
  createAudioPlayer,
  requestRecordingPermissionsAsync,
  setAudioModeAsync,
  useAudioRecorder,
  RecordingPresets,
} from "expo-audio";
import { useTheme } from "../theme/theme";
import { Symbol } from "./primitives";
import { haptic } from "../services/haptics";

export interface VoiceRecordingResult {
  uri: string;
  durationSec: number;
}

export function VoiceRecorder({ onSaved }: { onSaved: (result: VoiceRecordingResult) => void }) {
  const { palette, typography, space, radius } = useTheme();
  const recorder = useAudioRecorder(RecordingPresets.HIGH_QUALITY);
  const [recording, setRecording] = useState(false);
  const [seconds, setSeconds] = useState(0);
  const [saving, setSaving] = useState(false);
  const timer = useRef<ReturnType<typeof setInterval> | null>(null);

  useEffect(() => {
    setAudioModeAsync({ allowsRecording: true, playsInSilentMode: true }).catch(() => {});
    return () => {
      if (timer.current) clearInterval(timer.current);
    };
  }, []);

  async function start() {
    const perm = await requestRecordingPermissionsAsync();
    if (!perm.granted) {
      Alert.alert("Microphone off", "Enable the microphone for Curio in iOS Settings to record voice notes.");
      return;
    }
    haptic.tap();
    await recorder.prepareToRecordAsync();
    recorder.record();
    setRecording(true);
    setSeconds(0);
    timer.current = setInterval(() => setSeconds((s) => s + 1), 1000);
  }

  async function stop() {
    if (!recording) return;
    haptic.tap();
    setSaving(true);
    if (timer.current) clearInterval(timer.current);
    setRecording(false);
    try {
      await recorder.stop();
      const uri = recorder.uri;
      if (uri) {
        onSaved({ uri, durationSec: seconds });
      }
    } catch {
      Alert.alert("Oops", "That recording didn't save. Try again?");
    } finally {
      setSaving(false);
    }
  }

  const mm = Math.floor(seconds / 60);
  const ss = String(seconds % 60).padStart(2, "0");

  return (
    <View
      style={{
        flexDirection: "row",
        alignItems: "center",
        gap: space.m,
        backgroundColor: palette.surfaceAlt,
        borderRadius: radius.m,
        padding: space.m,
      }}
    >
      <Pressable
        onPress={recording ? stop : start}
        disabled={saving}
        style={({ pressed }) => ({
          width: 52,
          height: 52,
          borderRadius: 26,
          alignItems: "center",
          justifyContent: "center",
          backgroundColor: recording ? palette.red : palette.violet,
          opacity: pressed ? 0.8 : 1,
        })}
      >
        {saving ? (
          <ActivityIndicator color="#fff" />
        ) : (
          <Symbol name={recording ? "stop.fill" : "mic.fill"} size={20} color="#fff" />
        )}
      </Pressable>
      <View style={{ flex: 1 }}>
        <Text style={{ ...typography.headline, color: palette.ink }}>
          {saving ? "Saving…" : recording ? "Recording" : "Voice note"}
        </Text>
        <Text style={{ ...typography.footnote, color: palette.inkDim, marginTop: 2 }}>
          {recording ? `${mm}:${ss} — tap stop when done` : "Tap the mic to capture a thought hands-free"}
        </Text>
      </View>
      {recording ? (
        <View style={{ flexDirection: "row", gap: 3, alignItems: "flex-end", height: 22 }}>
          {[6, 12, 18, 10, 16, 8].map((h, i) => (
            <View
              key={i}
              style={{
                width: 3,
                height: recording ? h : 4,
                borderRadius: 2,
                backgroundColor: palette.pink,
                opacity: 0.5 + ((i * 7) % 10) / 20,
              }}
            />
          ))}
        </View>
      ) : null}
    </View>
  );
}
