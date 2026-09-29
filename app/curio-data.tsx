// Route target for curio://curio-data?payload=... — sent by the share extension.
// Expo-router mounts this screen with the payload param; ingestion happens in a
// side effect and the screen immediately routes to the Inbox so the user sees
// exactly where their share landed.
import { useEffect } from "react";
import { View, ActivityIndicator, Text, StyleSheet } from "react-native";
import { useLocalSearchParams, router } from "expo-router";
import { ingestCurioPayload } from "../src/capture/shareHandoff";

export default function CurioDataScreen() {
  const { payload } = useLocalSearchParams<{ payload?: string }>();

  useEffect(() => {
    const encoded = Array.isArray(payload) ? payload[0] : payload;
    if (!encoded) {
      router.replace("/(tabs)/inbox");
      return;
    }
    let cancelled = false;
    void (async () => {
      try {
        await ingestCurioPayload(encoded);
      } finally {
        if (!cancelled) router.replace("/(tabs)/inbox");
      }
    })();
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <View style={styles.container}>
      <ActivityIndicator size="large" color="#FF76B0" />
      <Text style={styles.text}>Saving to your inbox…</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#141216",
    alignItems: "center",
    justifyContent: "center",
    gap: 16,
  },
  text: { color: "#A79FA8", fontSize: 15 },
});
