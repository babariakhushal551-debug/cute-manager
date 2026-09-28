// Settings — AI provider & key, ritual reminders, profile name, data export/reset, share-sheet guide.
import { useState } from "react";
import { View, Text, TextInput, ScrollView, Switch, Pressable, Alert, Share } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useTheme } from "../../src/theme/theme";
import { useStore } from "../../src/data/store";
import { scheduleRitualReminders, cancelAllReminders } from "../../src/services/notifications";
import { Button, Card, Chip, SectionTitle, Symbol } from "../../src/ui/primitives";
import { haptic } from "../../src/services/haptics";
import type { Settings } from "../../src/data/types";

const PROVIDERS: { key: Settings["ai"]["provider"]; label: string; hint: string }[] = [
  { key: "auto", label: "Auto (built-in)", hint: "Smart offline engine. Works without any key." },
  { key: "openai", label: "OpenAI", hint: "Paste an sk-… key from platform.openai.com" },
  { key: "gemini", label: "Gemini", hint: "Paste a key from aistudio.google.com" },
  { key: "groq", label: "Groq", hint: "Paste a key from console.groq.com (free tier)" },
  { key: "heuristic", label: "Offline only", hint: "Never use cloud AI. Everything stays on device." },
];

export default function SettingsScreen() {
  const { palette, typography, space, radius } = useTheme();
  const settings = useStore((s) => s.settings);
  const updateSettings = useStore((s) => s.updateSettings);
  const resetAll = useStore((s) => s.resetAll);
  const items = useStore((s) => s.items);
  const projects = useStore((s) => s.projects);
  const tasks = useStore((s) => s.tasks);
  const [showKey, setShowKey] = useState(false);

  const providerInfo = PROVIDERS.find((p) => p.key === settings.ai.provider) ?? PROVIDERS[0];

  async function exportData() {
    const payload = JSON.stringify({ items, projects, tasks }, null, 2);
    try {
      await Share.share({ message: payload.slice(0, 8000), title: "Cute Manager export" });
    } catch {
      // user cancelled
    }
  }

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: palette.bg }} edges={["top"]}>
      <ScrollView contentContainerStyle={{ paddingBottom: 130 }} showsVerticalScrollIndicator={false}>
        <View style={{ paddingHorizontal: space.xl, paddingTop: space.l }}>
          <Text style={{ ...typography.display, color: palette.ink }}>Settings</Text>
        </View>

        <SectionTitle text="AI brain" />
        <View style={{ paddingHorizontal: space.xl }}>
          <Card style={{ padding: space.l }}>
            <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 8 }}>
              {PROVIDERS.map((p) => (
                <Chip
                  key={p.key}
                  label={p.label}
                  active={settings.ai.provider === p.key}
                  color={palette.violet}
                  onPress={() => updateSettings({ ai: { ...settings.ai, provider: p.key } })}
                />
              ))}
            </View>
            <Text style={{ ...typography.footnote, color: palette.inkDim, marginTop: space.m, lineHeight: 18 }}>
              {providerInfo.hint}
            </Text>
            {(settings.ai.provider === "openai" || settings.ai.provider === "gemini" || settings.ai.provider === "groq") && (
              <View style={{ flexDirection: "row", alignItems: "center", marginTop: space.m, gap: 8 }}>
                <TextInput
                  value={settings.ai.apiKey}
                  onChangeText={(t) => updateSettings({ ai: { ...settings.ai, apiKey: t } })}
                  placeholder="Paste API key…"
                  placeholderTextColor={palette.inkFaint}
                  secureTextEntry={!showKey}
                  autoCapitalize="none"
                  autoCorrect={false}
                  style={{
                    flex: 1,
                    backgroundColor: palette.surfaceAlt,
                    borderRadius: radius.s,
                    paddingHorizontal: 12,
                    paddingVertical: 10,
                    color: palette.ink,
                    fontSize: 14,
                  }}
                />
                <Pressable onPress={() => setShowKey((v) => !v)} hitSlop={6}>
                  <Symbol name={showKey ? "eye.slash" : "eye"} size={18} color={palette.inkDim} />
                </Pressable>
              </View>
            )}
            <Text style={{ ...typography.footnote, color: palette.inkFaint, marginTop: space.m, lineHeight: 18 }}>
              Your key is stored only on this device and sent only to the provider you choose.
            </Text>
          </Card>
        </View>

        <SectionTitle text="Daily rituals" />
        <View style={{ paddingHorizontal: space.xl }}>
          <Card style={{ padding: space.l, gap: space.m }}>
            <View style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between" }}>
              <View style={{ flex: 1, paddingRight: space.m }}>
                <Text style={{ ...typography.headline, color: palette.ink }}>Morning & evening reminders</Text>
                <Text style={{ ...typography.footnote, color: palette.inkDim, marginTop: 2 }}>
                  Gentle nudges for the planning ritual. No streaks, no guilt.
                </Text>
              </View>
              <Switch
                value={settings.reminders.enabled}
                onValueChange={async (v) => {
                  haptic.tap();
                  updateSettings({ reminders: { ...settings.reminders, enabled: v } });
                  if (v) {
                    const ok = await scheduleRitualReminders(settings.reminders.morningHour, settings.reminders.eveningHour);
                    if (!ok) Alert.alert("Notifications off", "Enable notifications for Cute Manager in iOS Settings to get reminders.");
                  } else {
                    await cancelAllReminders();
                  }
                }}
                trackColor={{ true: palette.pink, false: palette.hairline }}
              />
            </View>
          </Card>
        </View>

        <SectionTitle text="Profile" />
        <View style={{ paddingHorizontal: space.xl }}>
          <Card style={{ padding: space.l }}>
            <TextInput
              value={settings.profile.name}
              onChangeText={(t) => updateSettings({ profile: { name: t } })}
              placeholder="What should I call you?"
              placeholderTextColor={palette.inkFaint}
              style={{
                backgroundColor: palette.surfaceAlt,
                borderRadius: radius.s,
                paddingHorizontal: 12,
                paddingVertical: 10,
                color: palette.ink,
                fontSize: 15,
              }}
            />
          </Card>
        </View>

        <SectionTitle text="Share to inbox — how it works" />
        <View style={{ paddingHorizontal: space.xl }}>
          <Card style={{ padding: space.l, gap: space.s }}>
            {[
              ["Instagram", "Reel → Share… → Cute Manager"],
              ["YouTube", "Video → Share… → Cute Manager"],
              ["WhatsApp", "Message → Share… → Cute Manager"],
              ["Safari", "Share… → Cute Manager"],
              ["Photos", "Select screenshot → Share… → Cute Manager"],
            ].map(([app, how]) => (
              <View key={app} style={{ flexDirection: "row", alignItems: "center", gap: space.m }}>
                <Symbol name="square.and.arrow.up" size={15} color={palette.pink} />
                <Text style={{ ...typography.sub, color: palette.ink, width: 84 }}>{app}</Text>
                <Text style={{ ...typography.footnote, color: palette.inkDim, flex: 1 }}>{how}</Text>
              </View>
            ))}
            <Text style={{ ...typography.footnote, color: palette.inkFaint, marginTop: 4, lineHeight: 18 }}>
              First time: tap Share → More → enable "Cute Manager".
            </Text>
          </Card>
        </View>

        <SectionTitle text="Data" />
        <View style={{ paddingHorizontal: space.xl, gap: space.m }}>
          <Button title="Export everything" icon="square.and.arrow.up" variant="soft" onPress={exportData} />
          <Button
            title="Reset all data"
            icon="trash"
            variant="danger"
            onPress={() =>
              Alert.alert("Reset everything?", "This deletes all items, projects and tasks on this device.", [
                { text: "Cancel", style: "cancel" },
                { text: "Reset", style: "destructive", onPress: () => { haptic.warn(); resetAll(); } },
              ])
            }
          />
          <Text style={{ ...typography.footnote, color: palette.inkFaint, textAlign: "center", lineHeight: 18 }}>
            Everything is stored locally on your device. {items.length} items · {projects.length} projects · {tasks.length} tasks.
          </Text>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}
