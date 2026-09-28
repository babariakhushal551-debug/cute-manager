// Project detail — tasks, next action highlighted, progress, chat-to-add task.
import { useMemo, useState } from "react";
import { View, Text, TextInput, Pressable } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { ScrollView } from "react-native-gesture-handler";
import { useLocalSearchParams, router, Stack } from "expo-router";
import { useTheme } from "../../src/theme/theme";
import { useStore, projectProgress } from "../../src/data/store";
import { breakDownGoal } from "../../src/ai/aiService";
import { Button, Card, SectionTitle, Symbol, ProgressRing } from "../../src/ui/primitives";
import { haptic } from "../../src/services/haptics";
import type { Task } from "../../src/data/types";

function TaskRow({ task }: { task: Task }) {
  const { palette, typography, space } = useTheme();
  const updateTask = useStore((s) => s.updateTask);
  const removeTask = useStore((s) => s.removeTask);
  const done = task.status === "DONE";

  return (
    <Card style={{ padding: space.l, marginBottom: space.m }}>
      <View style={{ flexDirection: "row", alignItems: "center", gap: space.m }}>
        <Pressable
          onPress={() => {
            haptic.tap();
            updateTask(task.id, { status: done ? "TODO" : "DONE", completedAt: done ? undefined : Date.now() });
            if (!done) haptic.success();
          }}
          style={{
            width: 30,
            height: 30,
            borderRadius: 15,
            borderWidth: 1.5,
            borderColor: done ? palette.mint : palette.hairline,
            backgroundColor: done ? palette.mint : "transparent",
            alignItems: "center",
            justifyContent: "center",
          }}
        >
          {done ? <Symbol name="checkmark" size={14} color="#fff" /> : null}
        </Pressable>
        <View style={{ flex: 1 }}>
          <Text
            style={{
              ...typography.headline,
              color: done ? palette.inkFaint : palette.ink,
              textDecorationLine: done ? "line-through" : "none",
            }}
          >
            {task.title}
          </Text>
          <View style={{ flexDirection: "row", alignItems: "center", gap: 8, marginTop: 3 }}>
            {task.estimatedMin ? (
              <Text style={{ ...typography.footnote, color: palette.inkDim }}>{task.estimatedMin} min</Text>
            ) : null}
            {task.ifThenPlan ? (
              <Text style={{ ...typography.footnote, color: palette.inkFaint }} numberOfLines={1}>
                · {task.ifThenPlan}
              </Text>
            ) : null}
          </View>
        </View>
        <Pressable onPress={() => removeTask(task.id)} hitSlop={8}>
          <Symbol name="xmark" size={13} color={palette.inkFaint} />
        </Pressable>
      </View>
    </Card>
  );
}

export default function ProjectScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const { palette, typography, space, radius } = useTheme();
  const project = useStore((s) => s.projects.find((p) => p.id === id));
  const tasks = useStore((s) => s.tasks.filter((t) => t.projectId === id && t.status !== "CANCELLED"));
  const addTask = useStore((s) => s.addTask);
  const updateProject = useStore((s) => s.updateProject);
  const [newTask, setNewTask] = useState("");
  const [aiWorking, setAiWorking] = useState(false);

  const progress = useMemo(() => projectProgress(useStore.getState(), id), [tasks, id]);
  const nextTask = tasks.find((t) => t.status !== "DONE");

  if (!project) {
    return (
      <SafeAreaView style={{ flex: 1, backgroundColor: palette.bg }}>
        <View style={{ padding: space.xl }}>
          <Button title="Back" onPress={() => router.back()} />
        </View>
      </SafeAreaView>
    );
  }

  async function aiMoreTasks() {
    setAiWorking(true);
    try {
      const breakdown = await breakDownGoal(project!.title, project!.description ?? "", undefined);
      for (const t of breakdown.tasks) {
        addTask({ projectId: id, title: t.title, estimatedMin: t.estimatedMin, ifThenPlan: t.ifThenPlan });
      }
      haptic.success();
    } finally {
      setAiWorking(false);
    }
  }

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: palette.bg }} edges={["top"]}>
      <Stack.Screen options={{ headerShown: false }} />
      <ScrollView contentContainerStyle={{ paddingBottom: 140 }} showsVerticalScrollIndicator={false}>
        <View style={{ paddingHorizontal: space.xl, paddingTop: space.l, flexDirection: "row", alignItems: "center" }}>
          <Pressable onPress={() => router.back()} hitSlop={8} style={{ marginRight: space.m }}>
            <Symbol name="chevron.left" size={22} color={palette.ink} />
          </Pressable>
          <Text style={{ ...typography.micro, color: palette.inkFaint, textTransform: "uppercase" }}>Project</Text>
        </View>

        <View style={{ paddingHorizontal: space.xl, marginTop: space.l, flexDirection: "row", gap: space.l, alignItems: "center" }}>
          <ProgressRing pct={progress.pct} size={64} stroke={7} />
          <View style={{ flex: 1 }}>
            <Text style={{ ...typography.title, color: palette.ink }}>{project.title}</Text>
            {project.description ? (
              <Text style={{ ...typography.callout, color: palette.inkDim, marginTop: 4 }} numberOfLines={3}>
                {project.description}
              </Text>
            ) : null}
          </View>
        </View>

        {nextTask ? (
          <>
            <SectionTitle text="Do this next" />
            <View style={{ paddingHorizontal: space.xl }}>
              <Card style={{ padding: space.xl, backgroundColor: palette.surface }}>
                <Text style={{ ...typography.title3, color: palette.ink }}>{nextTask.title}</Text>
                <View style={{ flexDirection: "row", alignItems: "center", gap: 8, marginTop: space.m }}>
                  <View style={{ backgroundColor: palette.surfaceAlt, paddingHorizontal: 10, paddingVertical: 5, borderRadius: 999 }}>
                    <Text style={{ ...typography.footnote, color: palette.violet }}>{nextTask.estimatedMin ?? 15} min</Text>
                  </View>
                  {nextTask.ifThenPlan ? (
                    <Text style={{ ...typography.footnote, color: palette.inkFaint, flex: 1 }} numberOfLines={2}>
                      {nextTask.ifThenPlan}
                    </Text>
                  ) : null}
                </View>
              </Card>
            </View>
          </>
        ) : (
          <View style={{ paddingHorizontal: space.xl, marginTop: space.xl }}>
            <Card style={{ padding: space.xl, alignItems: "center" }}>
              <Symbol name="party.popper" size={30} color={palette.mint} />
              <Text style={{ ...typography.headline, color: palette.ink, marginTop: space.m }}>
                Project complete 🎉
              </Text>
              <Text style={{ ...typography.callout, color: palette.inkDim, marginTop: 4, textAlign: "center" }}>
                Nice work. Want to mark it done?
              </Text>
              <View style={{ marginTop: space.l }}>
                <Button
                  title="Mark project complete"
                  icon="flag.checkered"
                  small
                  onPress={() => {
                    updateProject(project.id, { status: "COMPLETED" });
                    haptic.success();
                    router.back();
                  }}
                />
              </View>
            </Card>
          </View>
        )}

        <SectionTitle
          text="All tasks"
          action={
            <Button title="AI: add steps" icon="sparkles" variant="ghost" small onPress={aiMoreTasks} disabled={aiWorking} />
          }
        />
        <View style={{ paddingHorizontal: space.xl }}>
          {tasks.map((t) => (
            <TaskRow key={t.id} task={t} />
          ))}
        </View>

        {/* Add task */}
        <View style={{ paddingHorizontal: space.xl, marginTop: space.m }}>
          <Card style={{ padding: space.m }}>
            <View style={{ flexDirection: "row", gap: space.m, alignItems: "center" }}>
              <TextInput
                value={newTask}
                onChangeText={setNewTask}
                placeholder="Add a small task…"
                placeholderTextColor={palette.inkFaint}
                style={{
                  flex: 1,
                  color: palette.ink,
                  fontSize: 15,
                  paddingVertical: 8,
                  paddingHorizontal: 12,
                  backgroundColor: palette.surfaceAlt,
                  borderRadius: radius.s,
                }}
                onSubmitEditing={() => {
                  if (!newTask.trim()) return;
                  addTask({ projectId: id, title: newTask.trim(), estimatedMin: 15 });
                  setNewTask("");
                  haptic.tap();
                }}
              />
              <Button
                title="Add"
                small
                icon="plus"
                onPress={() => {
                  if (!newTask.trim()) return;
                  addTask({ projectId: id, title: newTask.trim(), estimatedMin: 15 });
                  setNewTask("");
                  haptic.tap();
                }}
              />
            </View>
          </Card>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}
