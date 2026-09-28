// Library — reference/archive items with search (title, summary, content, OCR).
import { useMemo, useState } from "react";
import { View, Text, TextInput, FlatList } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { Image } from "expo-image";
import { router } from "expo-router";
import { useTheme } from "../../src/theme/theme";
import { useStore } from "../../src/data/store";
import { Card, EmptyState, Symbol } from "../../src/ui/primitives";
import { haptic } from "../../src/services/haptics";
import type { Item } from "../../src/data/types";

function LibraryCard({ item }: { item: Item }) {
  const { palette, typography, space, radius } = useTheme();
  return (
    <View style={{ paddingHorizontal: space.xl, marginBottom: space.m }}>
      <Card style={{ padding: space.l }} onPress={() => item.sourceUrl && router.push({ pathname: "/item/[id]", params: { id: item.id } })}>
        <View style={{ flexDirection: "row", gap: space.m }}>
          {item.thumbnailUrl || item.fileUri ? (
            <Image
              source={{ uri: item.thumbnailUrl ?? item.fileUri }}
              style={{ width: 54, height: 54, borderRadius: radius.s }}
              contentFit="cover"
            />
          ) : (
            <View
              style={{
                width: 54,
                height: 54,
                borderRadius: radius.s,
                backgroundColor: palette.surfaceAlt,
                alignItems: "center",
                justifyContent: "center",
              }}
            >
              <Symbol name={item.type === "text" ? "note.text" : item.type === "pdf" ? "doc.richtext" : "link"} size={20} color={palette.violet} />
            </View>
          )}
          <View style={{ flex: 1 }}>
            <Text style={{ ...typography.headline, color: palette.ink }} numberOfLines={1}>
              {item.title}
            </Text>
            {item.category ? (
              <View
                style={{
                  alignSelf: "flex-start",
                  backgroundColor: palette.surfaceAlt,
                  paddingHorizontal: 8,
                  paddingVertical: 3,
                  borderRadius: 999,
                  marginTop: 4,
                }}
              >
                <Text style={{ fontSize: 11, fontWeight: "600", color: palette.inkDim }}>{item.category}</Text>
              </View>
            ) : null}
            {item.summary ? (
              <Text style={{ ...typography.footnote, color: palette.inkDim, marginTop: 4 }} numberOfLines={2}>
                {item.summary}
              </Text>
            ) : null}
          </View>
        </View>
      </Card>
    </View>
  );
}

export default function LibraryScreen() {
  const { palette, typography, space, radius } = useTheme();
  const items = useStore((s) => s.items);
  const [query, setQuery] = useState("");

  const library = useMemo(
    () => items.filter((i) => i.status === "REFERENCE" || i.status === "ACTIONABLE" || i.status === "ARCHIVED"),
    [items],
  );

  const results = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return library;
    return library.filter((i) =>
      [i.title, i.summary, i.content, i.ocrText, i.category].filter(Boolean).join(" ").toLowerCase().includes(q),
    );
  }, [library, query]);

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: palette.bg }} edges={["top"]}>
      <View style={{ paddingHorizontal: space.xl, paddingTop: space.l }}>
        <Text style={{ ...typography.display, color: palette.ink }}>Library</Text>
        <Text style={{ ...typography.callout, color: palette.inkDim, marginTop: 4 }}>
          Saved for later. Search anything you kept.
        </Text>
        <TextInput
          value={query}
          onChangeText={setQuery}
          placeholder="Search — e.g. “that chicken recipe”"
          placeholderTextColor={palette.inkFaint}
          style={{
            marginTop: space.l,
            backgroundColor: palette.surface,
            borderRadius: radius.m,
            borderWidth: 1,
            borderColor: palette.hairline,
            paddingHorizontal: space.l,
            paddingVertical: 12,
            fontSize: 15,
            color: palette.ink,
          }}
        />
      </View>
      <FlatList
        data={results}
        keyExtractor={(i) => i.id}
        renderItem={({ item }) => <LibraryCard item={item} />}
        contentContainerStyle={{ paddingTop: space.l, paddingBottom: 130 }}
        ListEmptyComponent={
          <View style={{ paddingHorizontal: space.xl }}>
            <EmptyState
              icon="books.vertical"
              title={query ? "Nothing found" : "Your library is empty"}
              subtitle={
                query
                  ? "Try a different word — search covers titles, summaries, notes and OCR text."
                  : "When you save something as reference, it lives here, searchable forever."
              }
            />
          </View>
        }
      />
    </SafeAreaView>
  );
}
