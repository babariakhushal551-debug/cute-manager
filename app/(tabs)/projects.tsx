// Projects — visual cards with progress rings.
import { useMemo } from "react";
import { View, Text } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { FlashList } from "@shopify/flash-list";
import { router } from "expo-router";
import { LinearGradient } from "expo-linear-gradient";
import { useTheme } from "../../src/theme/theme";
import { useStore, projectProgress } from "../../src/data/store";
import { Card, EmptyState, Button, Symbol, ProgressRing } from "../../src/ui/primitives";
import type { Project } from "../../src/data/types";

function ProjectCard({ project }: { project: Project }) {
  const { palette, typography, space } = useTheme();
  const tasks = useStore((s) => s.tasks);
  const progress = projectProgress({ tasks } as never, project.id);
  const nextTask = tasks
    .filter((t) => t.projectId === project.id && t.status !== "DONE" && t.status !== "CANCELLED")
    .sort((a, b) => a.createdAt - b.createdAt)[0];

  return (
    <View style={{ paddingHorizontal: space.xl, marginBottom: space.m }}>
      <Card onPress={() => router.push({ pathname: "/project/[id]", params: { id: project.id } })}>
        <LinearGradient
          colors={[palette.pink, palette.violet]}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 1 }}
          style={{ height: 4 }}
        />
        <View style={{ padding: space.l, flexDirection: "row", alignItems: "center", gap: space.l }}>
          <ProgressRing pct={progress.pct} />
          <View style={{ flex: 1 }}>
            <Text style={{ ...typography.headline, color: palette.ink }} numberOfLines={2}>
              {project.title}
            </Text>
            <Text style={{ ...typography.footnote, color: palette.inkDim, marginTop: 3 }}>
              {progress.done}/{progress.total} done{nextTask ? ` · next: ${nextTask.title.slice(0, 40)}` : ""}
            </Text>
          </View>
          <Symbol name="chevron.right" size={14} color={palette.inkFaint} />
        </View>
      </Card>
    </View>
  );
}

export default function ProjectsScreen() {
  const { palette, typography, space } = useTheme();
  const projects = useStore((s) => s.projects);
  const active = useMemo(() => projects.filter((p) => p.status !== "ARCHIVED"), [projects]);

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: palette.bg }} edges={["top"]}>
      <View style={{ paddingHorizontal: space.xl, paddingTop: space.l }}>
        <Text style={{ ...typography.display, color: palette.ink }}>Projects</Text>
        <Text style={{ ...typography.callout, color: palette.inkDim, marginTop: 4 }}>
          Big things, broken into tiny steps.
        </Text>
      </View>
      <FlashList
        data={active}
        keyExtractor={(p) => p.id}
        renderItem={({ item }) => <ProjectCard project={item} />}
        contentContainerStyle={{ paddingTop: space.l, paddingBottom: 130 }}
        ListEmptyComponent={
          <View style={{ paddingHorizontal: space.xl }}>
            <EmptyState
              icon="folder"
              title="No projects yet"
              subtitle="Turn a saved idea into a project and I'll break it into 3–7 tiny tasks you can finish today."
            />
            <View style={{ alignItems: "center" }}>
              <Button title="Start from an idea" icon="sparkles" onPress={() => router.push("/capture")} />
            </View>
          </View>
        }
      />
    </SafeAreaView>
  );
}
