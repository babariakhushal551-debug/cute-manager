// Today — "What matters now?" Single next action, focus timer, tiny daily plan.
import { useMemo, useState, useEffect, useRef } from "react";
import { View, Text, ScrollView, Pressable, Modal } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { router } from "expo-router";
import { LinearGradient } from "expo-linear-gradient";
import { useTheme } from "../../src/theme/theme";
import { useShallow } from "zustand/react/shallow";
import { useStore, selectOpenTasks } from "../../src/data/store";
import { generateDailyPlan } from "../../src/ai/aiService";
import { Button, Card, Chip, EmptyState, SectionTitle, Symbol } from "../../src/ui/primitives";
import { CaptureButton } from "../../src/ui/CaptureButton";
import { haptic } from "../../src/services/haptics";

function greeting() {
  const h = new Date().getHours();
  if (h < 5) return "Still up?";
  if (h < 12) return "Good morning";
  if (h < 17) return "Good afternoon";
  return "Good evening";
}

function FocusTimer({ minutes, onDone, onClose }: { minutes: number; onDone: () => void; onClose: () => void }) {
  const { palette, typography, space, radius } = useTheme();
  const total = minutes * 60;
  const [left, setLeft] = useState(total);
  const interval = useRef<ReturnType<typeof setInterval> | null>(null);

  useEffect(() => {
    interval.current = setInterval(() => {
      setLeft((l) => {
        if (l <= 1) {
          if (interval.current) clearInterval(interval.current);
          haptic.success();
          return 0;
        }
        return l - 1;
      });
    }, 1000);
    return () => {
      if (interval.current) clearInterval(interval.current);
    };
  }, []);

  const mm = Math.floor(left / 60);
  const ss = left % 60;
  const pct = 1 - left / total;

  return (
    <Modal animationType="fade" transparent statusBarTranslucent onRequestClose={onClose}>
      <View style={{ flex: 1, backgroundColor: "rgba(12,8,14,0.92)", alignItems: "center", justifyContent: "center" }}>
        <MotiPct pct={pct} minutes={minutes} mm={mm} ss={ss} palette={palette} radius={radius} />
        <Text style={{ color: "rgba(255,255,255,0.75)", fontSize: 15, marginTop: 28 }}>Stay with it. I've got the rest.</Text>
        <View style={{ flexDirection: "row", gap: 12, marginTop: 36 }}>
          <Pressable
            onPress={onClose}
            style={{
              paddingHorizontal: 22,
              paddingVertical: 12,
              borderRadius: radius.m,
              backgroundColor: "rgba(255,255,255,0.12)",
            }}
          >
            <Text style={{ color: "#fff", fontWeight: "600" }}>Pause / Leave</Text>
          </Pressable>
          <Pressable
            onPress={() => {
              haptic.success();
              onDone();
              onClose();
            }}
            style={{ paddingHorizontal: 22, paddingVertical: 12, borderRadius: radius.m, backgroundColor: palette.mint }}
          >
            <Text style={{ color: "#fff", fontWeight: "700" }}>Done ✓</Text>
          </Pressable>
        </View>
      </View>
    </Modal>
  );
}

// simple animated ring (no extra deps — Moti used elsewhere; keep deterministic here)
function MotiPct({ pct, minutes, mm, ss, palette, radius }: any) {
  void MotiPct;
  void pct;
  const { typography } = useTheme();
  return (
    <View style={{ alignItems: "center" }}>
      <View
        style={{
          width: 210,
          height: 210,
          borderRadius: 105,
          borderWidth: 10,
          borderColor: "rgba(255,255,255,0.14)",
          borderTopColor: palette.pink,
          borderRightColor: palette.violet,
          alignItems: "center",
          justifyContent: "center",
        }}
      >
        <Text style={{ color: "#fff", fontSize: 56, fontWeight: "800", fontVariant: ["tabular-nums"] }}>
          {mm}:{String(ss).padStart(2, "0")}
        </Text>
        <Text style={{ color: "rgba(255,255,255,0.6)", fontSize: 13, marginTop: 4 }}>{minutes} min focus</Text>
      </View>
    </View>
  );
}

export default function TodayScreen() {
  const { palette, typography, space, radius, shadow } = useTheme();
  // useShallow: selectOpenTasks returns a new array each call; in zustand v5
  // an unstable array snapshot re-renders on every store change (Object.is check fails).
  const tasks = useStore(useShallow(selectOpenTasks));
  const projects = useStore((s) => s.projects);
  const items = useStore((s) => s.items);
  const updateTask = useStore((s) => s.updateTask);
  const profileName = useStore((s) => s.settings.profile.name);

  const plan = useMemo(() => generateDailyPlan(tasks, projects), [tasks, projects]);
  const next = plan[0];
  const [focusing, setFocusing] = useState(false);

  const stats = useMemo(() => {
    const weekAgo = Date.now() - 7 * 864e5;
    const done = tasks.filter((t) => t.status === "DONE").length;
    const savedThisWeek = items.filter((i) => i.createdAt > weekAgo).length;
    return { done, savedThisWeek, open: tasks.length };
  }, [items, tasks]);

  function completeNext() {
    if (!next) return;
    updateTask(next.taskId, { status: "DONE", completedAt: Date.now() });
    haptic.success();
  }

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: palette.bg }} edges={["top"]}>
      <ScrollView contentContainerStyle={{ paddingBottom: 130 }} showsVerticalScrollIndicator={false}>
        {/* Greeting */}
        <View style={{ paddingHorizontal: space.xl, paddingTop: space.l }}>
          <Text style={{ ...typography.footnote, color: palette.inkFaint, textTransform: "uppercase" }}>
            {new Date().toLocaleDateString(undefined, { weekday: "long", month: "long", day: "numeric" })}
          </Text>
          <Text style={{ ...typography.display, color: palette.ink, marginTop: 4 }}>
            {greeting()}{profileName ? `, ${profileName}` : ""} 👋
          </Text>
        </View>

        {/* Next action hero */}
        {next ? (
          <View style={{ paddingHorizontal: space.xl, marginTop: space.xl }}>
            <LinearGradient
              colors={[palette.pink, palette.violet]}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 1 }}
              style={{
                borderRadius: radius.xl,
                padding: space.xxl,
                ...shadow(2),
              }}
            >
              <View style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between" }}>
                <Text style={{ color: "rgba(255,255,255,0.85)", fontSize: 12, fontWeight: "700", letterSpacing: 1 }}>
                  YOUR NEXT ACTION
                </Text>
                <View style={{ backgroundColor: "rgba(255,255,255,0.2)", paddingHorizontal: 10, paddingVertical: 5, borderRadius: 999 }}>
                  <Text style={{ color: "#fff", fontSize: 11.5, fontWeight: "700" }}>{next.estimatedMin} min</Text>
                </View>
              </View>
              <Text style={{ color: "#fff", fontSize: 24, fontWeight: "800", marginTop: 14, lineHeight: 30 }}>
                {next.title}
              </Text>
              {next.ifThenPlan ? (
                <Text style={{ color: "rgba(255,255,255,0.85)", fontSize: 13.5, marginTop: 10, fontStyle: "italic", lineHeight: 19 }}>
                  {next.ifThenPlan}
                </Text>
              ) : null}
              <Text style={{ color: "rgba(255,255,255,0.7)", fontSize: 12.5, marginTop: 12 }}>{next.reason}</Text>
              <View style={{ flexDirection: "row", gap: 12, marginTop: 22 }}>
                <Pressable
                  onPress={() => {
                    haptic.tap();
                    setFocusing(true);
                  }}
                  style={{
                    flex: 1,
                    backgroundColor: "#fff",
                    paddingVertical: 14,
                    borderRadius: radius.m,
                    alignItems: "center",
                    flexDirection: "row",
                    justifyContent: "center",
                    gap: 8,
                  }}
                >
                  <Symbol name="play.fill" size={14} color={palette.violet} />
                  <Text style={{ color: palette.violet, fontWeight: "800", fontSize: 15 }}>Start focus</Text>
                </Pressable>
                <Pressable
                  onPress={completeNext}
                  style={{
                    paddingHorizontal: 18,
                    paddingVertical: 14,
                    borderRadius: radius.m,
                    backgroundColor: "rgba(255,255,255,0.22)",
                    alignItems: "center",
                    justifyContent: "center",
                  }}
                >
                  <Symbol name="checkmark" size={16} color="#fff" />
                </Pressable>
              </View>
            </LinearGradient>
          </View>
        ) : (
          <View style={{ paddingHorizontal: space.xl, marginTop: space.l }}>
            <Card>
              <EmptyState
                icon="sparkles"
                title="All clear for today"
                subtitle={"Capture an idea with the + button, and I'll turn it into a tiny next action you can actually do."}
              />
              <View style={{ paddingHorizontal: space.xl, paddingBottom: space.xl, alignItems: "center" }}>
                <Button title="Capture something" icon="plus" onPress={() => router.push("/capture")} />
              </View>
            </Card>
          </View>
        )}

        {/* Rest of today's plan */}
        {plan.length > 1 ? (
          <>
            <SectionTitle text="Up next today" />
            <View style={{ paddingHorizontal: space.xl, gap: space.m }}>
              {plan.slice(1).map((slot) => (
                <Card key={slot.taskId} style={{ padding: space.l }}>
                  <View style={{ flexDirection: "row", alignItems: "center", gap: space.m }}>
                    <View style={{ width: 38, height: 38, borderRadius: 19, backgroundColor: palette.surfaceAlt, alignItems: "center", justifyContent: "center" }}>
                      <Text style={{ fontWeight: "800", color: palette.violet, fontSize: 12 }}>{slot.estimatedMin}m</Text>
                    </View>
                    <View style={{ flex: 1 }}>
                      <Text style={{ ...typography.headline, color: palette.ink }}>{slot.title}</Text>
                      <Text style={{ ...typography.footnote, color: palette.inkDim, marginTop: 2 }}>{slot.reason}</Text>
                    </View>
                    <Pressable
                      onPress={() => {
                        updateTask(slot.taskId, { status: "DONE", completedAt: Date.now() });
                        haptic.success();
                      }}
                      style={{
                        width: 34,
                        height: 34,
                        borderRadius: 17,
                        borderWidth: 1.5,
                        borderColor: palette.hairline,
                        alignItems: "center",
                        justifyContent: "center",
                      }}
                    >
                      <Symbol name="checkmark" size={14} color={palette.inkDim} />
                    </Pressable>
                  </View>
                </Card>
              ))}
            </View>
          </>
        ) : null}

        {/* Gentle stats */}
        <SectionTitle text="This week" />
        <View style={{ paddingHorizontal: space.xl, flexDirection: "row", gap: space.m }}>
          <Card style={{ flex: 1, padding: space.l }}>
            <Text style={{ fontSize: 26, fontWeight: "800", color: palette.pink }}>{stats.done}</Text>
            <Text style={{ ...typography.footnote, color: palette.inkDim, marginTop: 2 }}>actions completed</Text>
          </Card>
          <Card style={{ flex: 1, padding: space.l }}>
            <Text style={{ fontSize: 26, fontWeight: "800", color: palette.violet }}>{stats.savedThisWeek}</Text>
            <Text style={{ ...typography.footnote, color: palette.inkDim, marginTop: 2 }}>things captured</Text>
          </Card>
          <Card style={{ flex: 1, padding: space.l }}>
            <Text style={{ fontSize: 26, fontWeight: "800", color: palette.mint }}>{stats.open}</Text>
            <Text style={{ ...typography.footnote, color: palette.inkDim, marginTop: 2 }}>open actions</Text>
          </Card>
        </View>

        <View style={{ paddingHorizontal: space.xl, marginTop: space.xxl }}>
          <Chip label="No guilt. Just next steps. →" icon="heart" onPress={() => router.push("/review")} />
        </View>
      </ScrollView>

      <CaptureButton />
      {next ? (
        <FocusTimer
          minutes={next.estimatedMin}
          onDone={completeNext}
          onClose={() => setFocusing(false)}
        />
      ) : null}
    </SafeAreaView>
  );
}
