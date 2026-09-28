// Tab bar layout with 6 tabs and blur background.
import { Tabs } from "expo-router";
import { Platform, View, type ColorValue } from "react-native";
import { BlurView } from "expo-blur";
import { useTheme } from "../../src/theme/theme";
import { Symbol } from "../../src/ui/primitives";
import { useStore, selectInbox } from "../../src/data/store";

function TabIcon({ name, focused, color }: { name: string; focused: boolean; color: ColorValue }) {
  return (
    <View style={{ opacity: focused ? 1 : 0.55, transform: [{ scale: focused ? 1.06 : 1 }] }}>
      <Symbol name={name} size={22} color={color} />
    </View>
  );
}

export default function TabsLayout() {
  const { palette, dark } = useTheme();
  const inboxCount = useStore(selectInbox).filter((i) => i.status === "INBOX").length;

  return (
    <Tabs
      screenOptions={{
        headerShown: false,
        tabBarActiveTintColor: palette.pink,
        tabBarInactiveTintColor: palette.inkFaint,
        tabBarStyle: {
          position: "absolute",
          backgroundColor: dark ? "rgba(30,27,32,0.78)" : "rgba(255,255,255,0.82)",
          borderTopColor: palette.hairline,
          height: Platform.select({ ios: 84, default: 64 }),
          paddingTop: 6,
        },
        tabBarBackground: () =>
          Platform.OS === "ios" ? (
            <BlurView intensity={dark ? 60 : 45} tint={dark ? "dark" : "light"} style={{ flex: 1 }} />
          ) : null,
        tabBarLabelStyle: { fontSize: 10.5, fontWeight: "600" },
        sceneStyle: { backgroundColor: palette.bg },
      }}
    >
      <Tabs.Screen
        name="index"
        options={{
          title: "Today",
          tabBarIcon: ({ color, focused }) => <TabIcon name="sun.max.fill" focused={focused} color={color} />,
        }}
      />
      <Tabs.Screen
        name="inbox"
        options={{
          title: "Inbox",
          tabBarBadge: inboxCount > 0 ? inboxCount : undefined,
          tabBarIcon: ({ color, focused }) => <TabIcon name="tray.full.fill" focused={focused} color={color} />,
        }}
      />
      <Tabs.Screen
        name="projects"
        options={{
          title: "Projects",
          tabBarIcon: ({ color, focused }) => <TabIcon name="folder.fill" focused={focused} color={color} />,
        }}
      />
      <Tabs.Screen
        name="library"
        options={{
          title: "Library",
          tabBarIcon: ({ color, focused }) => <TabIcon name="books.vertical.fill" focused={focused} color={color} />,
        }}
      />
      <Tabs.Screen
        name="review"
        options={{
          title: "Review",
          tabBarIcon: ({ color, focused }) => <TabIcon name="chart.bar.xaxis" focused={focused} color={color} />,
        }}
      />
      <Tabs.Screen
        name="settings"
        options={{
          title: "Settings",
          tabBarIcon: ({ color, focused }) => <TabIcon name="gearshape.fill" focused={focused} color={color} />,
        }}
      />
    </Tabs>
  );
}
