// Global error boundary — the last line of defense against a silent crash.
//
// Deliberately self-contained: NO theme, store, or app imports here. If the
// theme/store code is what crashed, the fallback screen must still be able to
// render. Plain class component (error boundaries require it), fixed colors.
import React from "react";
import { ScrollView, Text, View, Pressable, DevSettings } from "react-native";

interface Props {
  children: React.ReactNode;
  /** Optional hook for future crash reporting (e.g. send to a service). */
  onError?: (error: Error, info: React.ErrorInfo) => void;
}

interface State {
  error: Error | null;
}

const BG = "#141216";
const SURFACE = "#1E1B20";
const PINK = "#FF76B0";
const INK = "#F3EFF0";
const DIM = "#A79FA8";

export class ErrorBoundary extends React.Component<Props, State> {
  state: State = { error: null };

  static getDerivedStateFromError(error: Error): State {
    return { error };
  }

  componentDidCatch(error: Error, info: React.ErrorInfo) {
    // Always leave a breadcrumb in the system log for .ips correlation.
    console.error("[ErrorBoundary]", error.message, info.componentStack ?? "");
    this.props.onError?.(error, info);
  }

  private reset = () => this.setState({ error: null });

  private reloadApp = () => {
    try {
      if (typeof DevSettings?.reload === "function") DevSettings.reload();
    } catch {
      // DevSettings is unavailable in some environments — nothing else to do.
    }
  };

  render() {
    const { error } = this.state;
    if (!error) return this.props.children;

    return (
      <View style={{ flex: 1, backgroundColor: BG, paddingTop: 72, paddingHorizontal: 24 }}>
        <Text style={{ fontSize: 44, marginBottom: 10 }}>🎀</Text>
        <Text style={{ color: INK, fontSize: 24, fontWeight: "800", marginBottom: 6 }}>
          Something broke
        </Text>
        <Text style={{ color: DIM, fontSize: 14, lineHeight: 20, marginBottom: 18 }}>
          The app hit an unexpected error and stopped that screen. Your data is safe —
          it lives on this device and was not affected.
        </Text>

        <ScrollView
          style={{
            backgroundColor: SURFACE,
            borderRadius: 14,
            maxHeight: 220,
            padding: 14,
          }}
        >
          <Text selectable style={{ color: DIM, fontSize: 12, lineHeight: 18, fontFamily: "Menlo" }}>
            {(error.message || String(error)).slice(0, 800)}
          </Text>
        </ScrollView>

        <View style={{ flexDirection: "row", gap: 12, marginTop: 24 }}>
          <Pressable
            onPress={this.reset}
            style={{
              flex: 1,
              backgroundColor: PINK,
              borderRadius: 14,
              paddingVertical: 14,
              alignItems: "center",
            }}
          >
            <Text style={{ color: "#fff", fontWeight: "700", fontSize: 15 }}>Try again</Text>
          </Pressable>
          <Pressable
            onPress={this.reloadApp}
            style={{
              flex: 1,
              backgroundColor: "rgba(255,255,255,0.10)",
              borderRadius: 14,
              paddingVertical: 14,
              alignItems: "center",
            }}
          >
            <Text style={{ color: INK, fontWeight: "700", fontSize: 15 }}>Reload app</Text>
          </Pressable>
        </View>

        <Text style={{ color: "#6E6672", fontSize: 12, marginTop: 18, textAlign: "center" }}>
          If this keeps happening, tap Reload app or reinstall.
        </Text>
      </View>
    );
  }
}
