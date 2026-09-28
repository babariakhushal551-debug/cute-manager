// Item detail — full metadata, source link, related tags, actions.
import { View, Text, ScrollView, Linking, Pressable } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useLocalSearchParams, router } from "expo-router";
import { Image } from "expo-image";
import { useTheme } from "../../src/theme/theme";
import { useStore } from "../../src/data/store";
import { archiveItem, createProjectFromItem, dismissItem, saveAsReference } from "../../src/ai/pipeline";
import { findRelated } from "../../src/ai/related";
import { Button, Card, Chip, SectionTitle, Symbol } from "../../src/ui/primitives";
import { haptic } from "../../src/services/haptics";

export default function ItemScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const { palette, typography, space, radius } = useTheme();
  const item = useStore((s) => s.items.find((i) => i.id === id));
  const tags = useStore((s) => s.tags);
  const itemTags = useStore((s) => s.itemTags.filter((it) => it.itemId === id));
  const allItems = useStore((s) => s.items);
  const allItemTags = useStore((s) => s.itemTags);

  const related = item ? findRelated(item, allItems, allItemTags, tags, 3) : [];

  if (!item) {
    return (
      <SafeAreaView style={{ flex: 1, backgroundColor: palette.bg }}>
        <View style={{ padding: space.xl }}>
          <Button title="Back" onPress={() => router.back()} />
        </View>
      </SafeAreaView>
    );
  }

  const myTags = itemTags.map((it) => tags.find((t) => t.id === it.tagId)?.name).filter(Boolean) as string[];

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: palette.bg }} edges={["top"]}>
      <ScrollView contentContainerStyle={{ paddingBottom: 140 }}>
        <View style={{ paddingHorizontal: space.xl, paddingTop: space.l, flexDirection: "row", alignItems: "center" }}>
          <Pressable onPress={() => router.back()} hitSlop={8} style={{ marginRight: space.m }}>
            <Symbol name="chevron.left" size={22} color={palette.ink} />
          </Pressable>
          <Text style={{ ...typography.micro, color: palette.inkFaint, textTransform: "uppercase" }}>
            {item.type}{item.sourcePlatform ? ` · ${item.sourcePlatform}` : ""}
          </Text>
        </View>

        {item.thumbnailUrl || item.fileUri ? (
          <Image
            source={{ uri: item.thumbnailUrl ?? item.fileUri }}
            style={{ width: "100%", height: 210, marginTop: space.l }}
            contentFit="cover"
          />
        ) : null}

        <View style={{ paddingHorizontal: space.xl, marginTop: space.l }}>
          <Text style={{ ...typography.title, color: palette.ink }}>{item.title}</Text>

          {item.summary ? (
            <Text style={{ ...typography.body, color: palette.inkDim, marginTop: space.m, lineHeight: 22 }}>
              {item.summary}
            </Text>
          ) : null}

          {item.content ? (
            <Text style={{ ...typography.callout, color: palette.inkDim, marginTop: space.m, lineHeight: 20 }}>
              {item.content}
            </Text>
          ) : null}

          {myTags.length > 0 ? (
            <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 8, marginTop: space.l }}>
              {myTags.map((t) => (
                <Chip key={t} label={`#${t}`} color={palette.violet} />
              ))}
            </View>
          ) : null}

          {item.sourceUrl ? (
            <Card style={{ marginTop: space.l, padding: space.l }} onPress={() => Linking.openURL(item.sourceUrl!)}>
              <View style={{ flexDirection: "row", alignItems: "center", gap: space.m }}>
                <Symbol name="safari" size={18} color={palette.blue} />
                <View style={{ flex: 1 }}>
                  <Text style={{ ...typography.sub, color: palette.ink }}>Open source</Text>
                  <Text style={{ ...typography.footnote, color: palette.inkDim }} numberOfLines={1}>
                    {item.sourceUrl}
                  </Text>
                </View>
                <Symbol name="arrow.up.right" size={14} color={palette.inkFaint} />
              </View>
            </Card>
          ) : null}

          <View style={{ flexDirection: "row", gap: 8, marginTop: space.xl }}>
            <View style={{ flex: 1 }}>
              <Button
                title="Make project"
                icon="wand.and.stars"
                onPress={async () => {
                  haptic.tap();
                  const { project } = await createProjectFromItem(item);
                  router.replace({ pathname: "/project/[id]", params: { id: project.id } });
                }}
              />
            </View>
            <Button title="Save" icon="bookmark" variant="soft" onPress={() => { haptic.tap(); saveAsReference(item); }} />
            <Button title="Archive" icon="archivebox" variant="soft" onPress={() => { haptic.tap(); archiveItem(item); router.back(); }} />
            <Button title="" icon="trash" variant="soft" onPress={() => { haptic.tap(); dismissItem(item); router.back(); }} />
          </View>

          {related.length > 0 ? (
            <View style={{ marginTop: space.xxl }}>
              <SectionTitle text="Related in your library" />
              {related.map(({ item: rel, reason }) => (
                <Card
                  key={rel.id}
                  style={{ padding: space.l, marginTop: space.m }}
                  onPress={() => router.push({ pathname: "/item/[id]", params: { id: rel.id } })}
                >
                  <View style={{ flexDirection: "row", alignItems: "center", gap: space.m }}>
                    <Symbol name="link.circle.fill" size={18} color={palette.violet} />
                    <View style={{ flex: 1 }}>
                      <Text style={{ ...typography.sub, color: palette.ink }} numberOfLines={1}>
                        {rel.title}
                      </Text>
                      <Text style={{ ...typography.footnote, color: palette.inkFaint, marginTop: 2 }} numberOfLines={1}>
                        {reason}
                      </Text>
                    </View>
                    <Symbol name="chevron.right" size={12} color={palette.inkFaint} />
                  </View>
                </Card>
              ))}
            </View>
          ) : null}
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}
