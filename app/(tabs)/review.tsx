// Review — weekly stats, save→do funnel, stale idea cleanup (gentle, no blame).
import { useMemo } from "react";
import { View, Text, ScrollView } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useTheme } from "../../src/theme/theme";
import { useStore } from "../../src/data/store";
import { archiveItem } from "../../src/ai/pipeline";
import { Button, Card, SectionTitle, Symbol } from "../../src/ui/primitives";
import { haptic } from "../../src/services/haptics";
import type { Item } from "../../src/data/types";

function FunnelBar({ label, value, max, color }: { label: string; value: number; max: number; color: string }) {
  const { typography, space, radius } = useTheme();
  const pct = max > 0 ? Math.max(0.04, value / max) : 0;
  return (
    <View style={{ marginBottom: space.m }}>
      <View style={{ flexDirection: "row", justifyContent: "space-between", marginBottom: 6 }}>
        <Text style={{ ...typography.sub, color: palette_dim(label) }}>{label}</Text>
        <Text style={{ ...typography.sub, color: "#888" }}>{value}</Text>
      </View>
      <View style={{ height: 8, borderRadius: 4, backgroundColor: "rgba(128,128,128,0.15)", overflow: "hidden" }}>
        <View style={{ width: `${pct * 100}%`, height: "100%", borderRadius: 4, backgroundColor: color }} />
      </View>
    </View>
  );
}

// helper to avoid importing theme in module scope
function palette_dim(_label: string) {
  return "#666";
}

export default function ReviewScreen() {
  const { palette, typography, space, radius } = useTheme();
  const items = useStore((s) => s.items);
  const tasks = useStore((s) => s.tasks);
  const projects = useStore((s) => s.projects);
  const doneTasks = tasks.filter((t) => t.status === "DONE");
  const weekAgo = Date.now() - 7 * 864e5;

  const stats = useMemo(() => {
    const saved = items.filter((i) => i.createdAt > weekAgo).length;
    const actionable = items.filter((i) => i.status === "ACTIONABLE").length;
    const converted = items.filter((i) => i.projectId).length;
    const done = doneTasks.filter((t) => t.completedAt && t.completedAt > weekAgo).length;
    const activeProjects = projects.filter((p) => p.status === "ACTIVE").length;
    return { saved, actionable, converted, done, activeProjects };
  }, [items, doneTasks, projects, weekAgo]);

  const stale = useMemo(
    () =>
      items.filter(
        (i) =>
          (i.status === "INBOX" || i.status === "ACTIONABLE") &&
          Date.now() - i.createdAt > 21 * 864e5,
      ),
    [items],
  );

  const max = Math.max(stats.saved, stats.actionable, stats.converted, stats.done, 1);

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: palette.bg }} edges={["top"]}>
      <ScrollView contentContainerStyle={{ paddingBottom: 130 }} showsVerticalScrollIndicator={false}>
        <View style={{ paddingHorizontal: space.xl, paddingTop: space.l }}>
          <Text style={{ ...typography.display, color: palette.ink }}>Review</Text>
          <Text style={{ ...typography.callout, color: palette.inkDim, marginTop: 4 }}>
            Progress, not guilt. Here's your last 7 days.
          </Text>
        </View>

        <SectionTitle text="Save → Do funnel" />
        <View style={{ paddingHorizontal: space.xl }}>
          <Card style={{ padding: space.xl }}>
            <FunnelBar label="Captured" value={stats.saved} max={max} color={palette.violet} />
            <FunnelBar label="Became actionable" value={stats.actionable} max={max} color={palette.pink} />
            <FunnelBar label="Turned into projects" value={stats.converted} max={max} color={palette.amber} />
            <FunnelBar label="Actions completed" value={stats.done} max={max} color={palette.mint} />
          </Card>
        </View>

        <SectionTitle text="Momentum" />
        <View style={{ paddingHorizontal: space.xl, flexDirection: "row", gap: space.m }}>
          <Card style={{ flex: 1, padding: space.l, alignItems: "center" }}>
            <Symbol name="flame.fill" size={22} color={palette.peach} />
            <Text style={{ fontSize: 24, fontWeight: "800", color: palette.ink, marginTop: 6 }}>{stats.activeProjects}</Text>
            <Text style={{ ...typography.footnote, color: palette.inkDim }}>active projects</Text>
          </Card>
          <Card style={{ flex: 1, padding: space.l, alignItems: "center" }}>
            <Symbol name="checkmark.seal.fill" size={22} color={palette.mint} />
            <Text style={{ fontSize: 24, fontWeight: "800", color: palette.ink, marginTop: 6 }}>{stats.done}</Text>
            <Text style={{ ...typography.footnote, color: palette.inkDim }}>done this week</Text>
          </Card>
        </View>

        <SectionTitle text="Gently declutter" />
        <View style={{ paddingHorizontal: space.xl }}>
          {stale.length === 0 ? (
            <Card style={{ padding: space.xl, alignItems: "center" }}>
              <Symbol name="leaf.fill" size={24} color={palette.mint} />
              <Text style={{ ...typography.headline, color: palette.ink, marginTop: space.m }}>Nothing stale</Text>
              <Text style={{ ...typography.callout, color: palette.inkDim, marginTop: 4, textAlign: "center" }}>
                Everything saved in the last 3 weeks has been triaged. Lovely.
              </Text>
            </Card>
          ) : (
            <Card style={{ padding: space.xl }}>
              <Text style={{ ...typography.headline, color: palette.ink }}>
                {stale.length} saved {stale.length === 1 ? "idea" : "ideas"} waiting a while
              </Text>
              <Text style={{ ...typography.callout, color: palette.inkDim, marginTop: 4, lineHeight: 20 }}>
                No pressure — but if these no longer spark anything, archiving keeps your inbox calm.
              </Text>
              {stale.slice(0, 5).map((i: Item) => (
                <View
                  key={i.id}
                  style={{
                    flexDirection: "row",
                    alignItems: "center",
                    gap: space.m,
                    marginTop: space.m,
                    paddingTop: space.m,
                    borderTopWidth: 1,
                    borderTopColor: palette.hairline,
                  }}
                >
                  <View style={{ flex: 1 }}>
                    <Text style={{ ...typography.sub, color: palette.ink }} numberOfLines={1}>
                      {i.title}
                    </Text>
                    <Text style={{ ...typography.footnote, color: palette.inkFaint }}>
                      saved {Math.floor((Date.now() - i.createdAt) / 864e5)}d ago
                    </Text>
                  </View>
                  <Button
                    title="Archive"
                    variant="ghost"
                    small
                    onPress={() => {
                      haptic.tap();
                      archiveItem(i);
                    }}
                  />
                </View>
              ))}
            </Card>
          )}
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}
