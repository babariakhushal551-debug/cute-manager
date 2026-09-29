// Inbox — unprocessed captures with AI summary, detected intent, and decision buttons.
import { useMemo, useState } from "react";
import { View, Text, Pressable, ActivityIndicator } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { FlashList } from "@shopify/flash-list";
import { Image } from "expo-image";
import { router } from "expo-router";
import { useTheme } from "../../src/theme/theme";
import { useShallow } from "zustand/react/shallow";
import { useStore, selectInbox } from "../../src/data/store";
import { createProjectFromItem, saveAsReference, dismissItem, archiveItem } from "../../src/ai/pipeline";
import { findSimilar } from "../../src/ai/duplicates";
import { Button, Card, Chip, EmptyState, SectionTitle, Symbol } from "../../src/ui/primitives";
import { CaptureButton } from "../../src/ui/CaptureButton";
import { haptic } from "../../src/services/haptics";
import type { Item, ItemType } from "../../src/data/types";

const TYPE_ICON: Record<ItemType, string> = {
  link: "link",
  text: "note.text",
  image: "photo",
  pdf: "doc.richtext",
  voice: "waveform",
};

const TYPE_LABEL: Record<ItemType, string> = {
  link: "Link",
  text: "Note",
  image: "Screenshot",
  pdf: "PDF",
  voice: "Voice",
};

function ItemCard({ item }: { item: Item }) {
  const { palette, typography, space, radius } = useTheme();
  const updateItem = useStore((s) => s.updateItem);
  const allItems = useStore((s) => s.items);
  const [working, setWorking] = useState(false);
  const [open, setOpen] = useState(false);
  const [projectTitle, setProjectTitle] = useState(item.title);

  const processing = item.status === "PROCESSING" || !item.processedAt;

  // Duplicate banner: recompute on render (cheap, tier-1) — survives app restarts.
  const dupe = useMemo(() => {
    if (processing || item.status === "ACTIONABLE" || item.status === "REFERENCE") return null;
    const matches = findSimilar(item, allItems);
    return matches.length > 0 ? matches[0] : null;
  }, [item, allItems, processing]);

  async function onMakeProject() {
    setWorking(true);
    haptic.tap();
    try {
      const { project } = await createProjectFromItem(item);
      haptic.success();
      setOpen(false);
      router.push({ pathname: "/project/[id]", params: { id: project.id } });
    } finally {
      setWorking(false);
    }
  }

  return (
    <View style={{ paddingHorizontal: space.xl, marginBottom: space.m }}>
      <Card style={{ overflow: "hidden" }}>
        {item.thumbnailUrl ? (
          <Image source={{ uri: item.thumbnailUrl }} style={{ width: "100%", height: 150 }} contentFit="cover" />
        ) : null}
        <View style={{ padding: space.l }}>
          <View style={{ flexDirection: "row", alignItems: "center", gap: 8 }}>
            <View
              style={{
                width: 30,
                height: 30,
                borderRadius: 10,
                backgroundColor: palette.surfaceAlt,
                alignItems: "center",
                justifyContent: "center",
              }}
            >
              <Symbol name={TYPE_ICON[item.type]} size={15} color={palette.violet} />
            </View>
            <Text style={{ ...typography.micro, color: palette.inkFaint, textTransform: "uppercase" }}>
              {TYPE_LABEL[item.type]}
              {item.sourcePlatform ? ` · ${item.sourcePlatform}` : ""}
            </Text>
            {item.category ? (
              <View style={{ marginLeft: "auto" }}>
                <Chip label={item.category} color={palette.statusInbox} />
              </View>
            ) : null}
          </View>

          <Text style={{ ...typography.headline, color: palette.ink, marginTop: space.m }} numberOfLines={2}>
            {item.title}
          </Text>

          {dupe ? (
            <View
              style={{
                marginTop: space.m,
                backgroundColor: palette.surfaceAlt,
                borderRadius: radius.s,
                padding: space.m,
                gap: 6,
              }}
            >
              <Text style={{ ...typography.footnote, color: palette.ink }}>
                {dupe.reason === "same-url" ? "🔗 You already saved this link" : "✨ Similar to something you have"}
                {" "}
                · “{dupe.existing.title.slice(0, 40)}”
              </Text>
              <View style={{ flexDirection: "row", gap: 8 }}>
                <Chip
                  label="Keep both"
                  onPress={() => updateItem(item.id, { intent: item.intent ?? "reference" })}
                />
                <Chip
                  label="Archive the new one"
                  color={palette.statusArchived}
                  onPress={() => {
                    haptic.tap();
                    archiveItem(item);
                  }}
                />
              </View>
            </View>
          ) : null}

          {processing ? (
            <View style={{ flexDirection: "row", alignItems: "center", gap: 8, marginTop: space.s }}>
              <ActivityIndicator size="small" color={palette.pink} />
              <Text style={{ ...typography.callout, color: palette.inkDim }}>AI is reading this…</Text>
            </View>
          ) : item.summary ? (
            <Text style={{ ...typography.callout, color: palette.inkDim, marginTop: space.s, lineHeight: 19 }} numberOfLines={3}>
              {item.summary}
            </Text>
          ) : null}

          {/* Intent question — only when AI is unsure */}
          {!processing && (!item.intent || item.intent === "other") ? (
            <View style={{ marginTop: space.m }}>
              <Text style={{ ...typography.sub, color: palette.ink }}>Why did you save this?</Text>
              <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 8, marginTop: space.s }}>
                <Chip label="Try it" icon="hand.tap" onPress={() => { haptic.tap(); updateItem(item.id, { intent: "try", status: "INBOX" }); }} />
                <Chip label="Learn it" icon="book" onPress={() => { haptic.tap(); updateItem(item.id, { intent: "learn", status: "INBOX" }); }} />
                <Chip label="Just reference" icon="bookmark" onPress={() => { haptic.tap(); updateItem(item.id, { intent: "reference" }); saveAsReference(item); }} />
              </View>
            </View>
          ) : null}

          {/* Actions */}
          <View style={{ flexDirection: "row", gap: 8, marginTop: space.l }}>
            <View style={{ flex: 1 }}>
              <Button title="Make it a project" icon="wand.and.stars" small onPress={onMakeProject} disabled={working} />
            </View>
            <Button title="Save" icon="bookmark" variant="soft" small onPress={() => { haptic.tap(); saveAsReference(item); }} />
            <Button title="" icon="trash" variant="soft" small onPress={() => { haptic.tap(); dismissItem(item); }} />
          </View>
        </View>
      </Card>
    </View>
  );
}

export default function InboxScreen() {
  const { palette, typography, space, radius } = useTheme();
  // useShallow: selectInbox returns a fresh array; zustand v5 needs shallow
  // equality or this re-renders (and loops) on every store change.
  const items = useStore(useShallow(selectInbox));
  const [filter, setFilter] = useState<"all" | ItemType>("all");

  const filtered = useMemo(
    () => (filter === "all" ? items : items.filter((i) => i.type === filter)),
    [items, filter],
  );

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: palette.bg }} edges={["top"]}>
      <View style={{ paddingHorizontal: space.xl, paddingTop: space.l }}>
        <Text style={{ ...typography.display, color: palette.ink }}>Inbox</Text>
        <Text style={{ ...typography.callout, color: palette.inkDim, marginTop: 4 }}>
          Everything you threw at me. I'll help you decide.
        </Text>
      </View>

      <View style={{ flexDirection: "row", gap: 8, paddingHorizontal: space.xl, marginTop: space.l }}>
        <Chip label="All" active={filter === "all"} onPress={() => setFilter("all")} />
        <Chip label="Links" icon="link" active={filter === "link"} onPress={() => setFilter("link")} />
        <Chip label="Images" icon="photo" active={filter === "image"} onPress={() => setFilter("image")} />
        <Chip label="Notes" icon="note.text" active={filter === "text"} onPress={() => setFilter("text")} />
        <Chip label="PDFs" icon="doc.richtext" active={filter === "pdf"} onPress={() => setFilter("pdf")} />
      </View>

      <FlashList
        data={filtered}
        keyExtractor={(i) => i.id}
        renderItem={({ item }) => <ItemCard item={item} />}
        contentContainerStyle={{ paddingTop: space.l, paddingBottom: 130 }}
        ListEmptyComponent={
          <View style={{ paddingHorizontal: space.xl }}>
            <EmptyState
              icon="tray"
              title="Inbox zero"
              subtitle={"Share anything from Instagram, YouTube or Safari — it lands here and I'll figure out what it is."}
            />
            <View style={{ alignItems: "center" }}>
              <Button title="Capture manually" icon="plus" onPress={() => router.push("/capture")} />
            </View>
          </View>
        }
      />
      <CaptureButton />
    </SafeAreaView>
  );
}
