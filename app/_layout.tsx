import { Stack } from "expo-router";
import { StatusBar } from "expo-status-bar";
import { useEffect, useRef, useState } from "react";
import { AppState as RNAppState, Platform, View } from "react-native";
import { GestureHandlerRootView } from "react-native-gesture-handler";
import { SafeAreaProvider } from "react-native-safe-area-context";
import * as SplashScreen from "expo-splash-screen";
import { ShareIntentProvider, useShareIntentContext } from "expo-share-intent";
import { ThemeProvider, useTheme } from "../src/theme/theme";
import { useStore } from "../src/data/store";
import { ingestShare } from "../src/capture/shareIntake";
import { haptic } from "../src/services/haptics";

SplashScreen.preventAutoHideAsync().catch(() => {});

function ShareIntentBridge() {
  const { hasShareIntent, shareIntent, resetShareIntent } = useShareIntentContext();
  const lastProcessed = useRef<string>("");
  useEffect(() => {
    if (!hasShareIntent || !shareIntent) return;
    const fingerprint = JSON.stringify(shareIntent);
    if (lastProcessed.current === fingerprint) return;
    lastProcessed.current = fingerprint;
    haptic.tap();
    void ingestShare({
      text: shareIntent.text ?? undefined,
      webUrl: shareIntent.webUrl ?? undefined,
      files: shareIntent.files?.map((f) => ({ path: f.path, mimeType: f.mimeType, fileName: f.fileName ?? undefined })),
    }).then(() => resetShareIntent());
  }, [hasShareIntent, shareIntent, resetShareIntent]);
  return null;
}

function HydrationGate({ children }: { children: React.ReactNode }) {
  const hydrated = useStore((s) => s.hydrated);
  const hydrate = useStore((s) => s.hydrate);
  const [ready, setReady] = useState(false);
  useEffect(() => {
    void hydrate();
  }, [hydrate]);
  useEffect(() => {
    if (hydrated) {
      setReady(true);
      SplashScreen.hideAsync().catch(() => {});
    }
  }, [hydrated]);
  if (!ready) return null;
  return <>{children}</>;
}

function Shell() {
  const { dark } = useTheme();
  return (
    <View style={{ flex: 1, backgroundColor: dark ? "#141216" : "#F7F4F0" }}>
      <StatusBar style={dark ? "light" : "dark"} />
      <Stack
        screenOptions={{
          headerShown: false,
          animation: Platform.select({ ios: "default", default: "slide_from_right" }),
          contentStyle: { backgroundColor: "transparent" },
        }}
      />
      <ShareIntentBridge />
    </View>
  );
}

// NOTE: RootLayout must not call useTheme() itself — the ThemeProvider only
// exists below it, and useTheme() throws when used outside the provider.
// Reading the theme inside <Shell /> (which renders under the provider) is safe.
export default function RootLayout() {
  return (
    <GestureHandlerRootView style={{ flex: 1 }}>
      <SafeAreaProvider>
        <ThemeProvider>
          <HydrationGate>
            <ShareIntentProvider>
              <Shell />
            </ShareIntentProvider>
          </HydrationGate>
        </ThemeProvider>
      </SafeAreaProvider>
    </GestureHandlerRootView>
  );
}
