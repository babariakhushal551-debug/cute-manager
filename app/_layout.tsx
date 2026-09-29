import { useEffect, useState } from "react";
import { Stack } from "expo-router";
import { StatusBar } from "expo-status-bar";
import { Platform, View } from "react-native";
import { GestureHandlerRootView } from "react-native-gesture-handler";
import { SafeAreaProvider } from "react-native-safe-area-context";
import * as SplashScreen from "expo-splash-screen";
import { ThemeProvider, useTheme } from "../src/theme/theme";
import { useStore } from "../src/data/store";
import { ErrorBoundary } from "../src/ui/ErrorBoundary";
import { installGlobalErrorHandlers } from "../src/services/globalErrors";
// Share handoffs arrive as curio://curio-data deep links, which expo-router
// dispatches to the app/curio-data.tsx route (cold start AND foreground).

SplashScreen.preventAutoHideAsync().catch(() => {});

// Surface uncaught (non-render) errors instead of dying silently.
installGlobalErrorHandlers();

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
          {/* ErrorBoundary is hook-free and must stay INSIDE ThemeProvider:
              it catches provider/render crashes below it; anything earlier
              (gesture/safe-area setup) is covered by the global handler. */}
          <ErrorBoundary>
            <HydrationGate>
              <Shell />
            </HydrationGate>
          </ErrorBoundary>
        </ThemeProvider>
      </SafeAreaProvider>
    </GestureHandlerRootView>
  );
}
