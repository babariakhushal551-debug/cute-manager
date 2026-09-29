// Shared UI primitives — Apple-style cards, chips, buttons.
import { BlurView } from "expo-blur";
import { LinearGradient } from "expo-linear-gradient";
import { SymbolView } from "expo-symbols";
import { Pressable, ScrollView, Text, View, type ViewStyle, type StyleProp, type TextStyle, type ColorValue } from "react-native";
import { useTheme } from "../theme/theme";
import { haptic } from "../services/haptics";
import type { ReactNode } from "react";

export function Symbol({ name, size = 20, color }: { name: string; size?: number; color?: ColorValue }) {
  const { palette } = useTheme();
  const tint: ColorValue = color ?? palette.ink;
  return (
    <SymbolView
      name={name as never}
      size={size}
      tintColor={tint}
      weight="semibold"
      fallback={
        // Minimal shape fallback for non-Apple platforms
        <View style={{ width: size, height: size, borderRadius: size / 2, backgroundColor: tint as string, opacity: 0.85 }} />
      }
    />
  );
}

export function Card({
  children,
  style,
  onPress,
  glass = false,
}: {
  children: ReactNode;
  style?: StyleProp<ViewStyle>;
  onPress?: () => void;
  glass?: boolean;
}) {
  const { palette, radius, shadow, dark } = useTheme();
  const base: ViewStyle = {
    backgroundColor: glass ? "rgba(255,255,255,0.10)" : palette.surface,
    borderRadius: radius.l,
    borderWidth: 1,
    borderColor: dark ? "rgba(255,255,255,0.08)" : palette.hairline,
    overflow: "hidden",
  };
  if (onPress) {
    return (
      <Pressable
        onPress={() => {
          haptic.tap();
          onPress();
        }}
        style={({ pressed }) => [{ ...base, transform: [{ scale: pressed ? 0.985 : 1 }] }, style]}
      >
        {children}
      </Pressable>
    );
  }
  return <View style={[base, shadow(1), style]}>{children}</View>;
}

export function Chip({
  label,
  color,
  icon,
  active,
  onPress,
}: {
  label: string;
  color?: string;
  icon?: string;
  active?: boolean;
  onPress?: () => void;
}) {
  const { palette, radius, typography, dark } = useTheme();
  const c = color ?? palette.inkDim;
  return (
    <Pressable
      onPress={
        onPress
          ? () => {
              haptic.tap();
              onPress();
            }
          : undefined
      }
      style={({ pressed }) => ({
        flexDirection: "row",
        alignItems: "center",
        gap: 6,
        paddingHorizontal: 12,
        paddingVertical: 7,
        borderRadius: radius.pill,
        backgroundColor: active ? c : dark ? "rgba(255,255,255,0.07)" : palette.surfaceAlt,
        opacity: pressed ? 0.7 : 1,
      })}
    >
      {icon ? <Symbol name={icon} size={13} color={active ? "#fff" : c} /> : null}
      <Text style={{ color: active ? "#fff" : c, fontSize: 12.5, fontWeight: "600" }}>{label}</Text>
    </Pressable>
  );
}

export function Button({
  title,
  onPress,
  variant = "primary",
  icon,
  small,
  disabled,
}: {
  title: string;
  onPress: () => void;
  variant?: "primary" | "ghost" | "soft" | "danger";
  icon?: string;
  small?: boolean;
  disabled?: boolean;
}) {
  const { palette, radius, typography, shadow, dark } = useTheme();
  const pad = small ? { paddingHorizontal: 14, paddingVertical: 8 } : { paddingHorizontal: 18, paddingVertical: 12 };
  if (variant === "primary") {
    return (
      <Pressable
        disabled={disabled}
        onPress={() => {
          haptic.tap();
          onPress();
        }}
        style={({ pressed }) => [
          {
            borderRadius: radius.m,
            opacity: disabled ? 0.4 : pressed ? 0.85 : 1,
            overflow: "hidden",
          },
          shadow(1),
        ]}
      >
        <LinearGradient colors={[palette.pink, palette.violet]} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={{ ...pad, alignItems: "center" }}>
          <View style={{ flexDirection: "row", alignItems: "center", gap: 7 }}>
            {icon ? <Symbol name={icon} size={15} color="#fff" /> : null}
            <Text style={{ color: "#fff", fontWeight: "700", fontSize: small ? 13.5 : 15 }}>{title}</Text>
          </View>
        </LinearGradient>
      </Pressable>
    );
  }
  const bg =
    variant === "danger" ? "rgba(255,93,85,0.12)" : variant === "soft" ? (dark ? "rgba(255,255,255,0.07)" : palette.surfaceAlt) : "transparent";
  const fg = variant === "danger" ? palette.red : palette.ink;
  return (
    <Pressable
      disabled={disabled}
      onPress={() => {
        haptic.tap();
        onPress();
      }}
      style={({ pressed }) => ({
        ...pad,
        borderRadius: radius.m,
        backgroundColor: bg,
        opacity: disabled ? 0.4 : pressed ? 0.6 : 1,
        alignItems: "center",
        borderWidth: variant === "ghost" ? 1 : 0,
        borderColor: palette.hairline,
        flexDirection: "row",
        gap: 7,
        justifyContent: "center",
      })}
    >
      {icon ? <Symbol name={icon} size={15} color={fg} /> : null}
      <Text style={{ color: fg, fontWeight: "650" as never, fontSize: small ? 13.5 : 15 }}>{title}</Text>
    </Pressable>
  );
}

export function ProgressRing({ pct, size = 44, stroke = 5 }: { pct: number; size?: number; stroke?: number }) {
  const { palette } = useTheme();
  const r = (size - stroke) / 2;
  const c = 2 * Math.PI * r;
  return (
    <View style={{ width: size, height: size, justifyContent: "center", alignItems: "center" }}>
      <View
        style={{
          position: "absolute",
          width: size,
          height: size,
          borderRadius: size / 2,
          borderWidth: stroke,
          borderColor: palette.hairline,
        }}
      />
      <View
        style={{
          position: "absolute",
          width: size,
          height: size,
          borderRadius: size / 2,
          borderWidth: stroke,
          borderColor: palette.pink,
          borderTopColor: "transparent",
          transform: [{ rotate: `${pct * 360 - 90}deg` }],
          opacity: pct > 0 ? 1 : 0,
        }}
      />
      <Text style={{ fontSize: 11, fontWeight: "700", color: palette.ink }}>{Math.round(pct * 100)}%</Text>
    </View>
  );
}

export function EmptyState({
  icon,
  title,
  subtitle,
}: {
  icon: string;
  title: string;
  subtitle: string;
}) {
  const { palette, typography, space } = useTheme();
  return (
    <View style={{ alignItems: "center", paddingVertical: 64, paddingHorizontal: 32, gap: space.m }}>
      <View
        style={{
          width: 76,
          height: 76,
          borderRadius: 38,
          backgroundColor: palette.surfaceAlt,
          alignItems: "center",
          justifyContent: "center",
        }}
      >
        <Symbol name={icon} size={34} color={palette.inkFaint} />
      </View>
      <Text style={{ ...typography.title3, color: palette.ink, textAlign: "center" }}>{title}</Text>
      <Text style={{ ...typography.callout, color: palette.inkDim, textAlign: "center", lineHeight: 20 }}>{subtitle}</Text>
    </View>
  );
}

export function ScreenScroll({ children, style }: { children: ReactNode; style?: StyleProp<ViewStyle> }) {
  const { palette } = useTheme();
  return (
    <ScrollView
      style={{ flex: 1, backgroundColor: palette.bg }}
      contentContainerStyle={{ paddingBottom: 120 }}
      showsVerticalScrollIndicator={false}
    >
      {children}
    </ScrollView>
  );
}

export function SectionTitle({ text, action }: { text: string; action?: ReactNode }) {
  const { palette, typography, space } = useTheme();
  return (
    <View
      style={{
        flexDirection: "row",
        alignItems: "center",
        justifyContent: "space-between",
        paddingHorizontal: space.xl,
        paddingTop: space.xl,
        paddingBottom: space.m,
      }}
    >
      <Text style={{ ...typography.micro, color: palette.inkFaint, textTransform: "uppercase" }}>{text}</Text>
      {action}
    </View>
  );
}

export function GlassHeader({ children }: { children?: ReactNode }) {
  const { dark, space, isIOS } = useTheme();
  if (isIOS) {
    return (
      <BlurView intensity={dark ? 60 : 40} tint={dark ? "dark" : "light"} style={{ position: "absolute", top: 0, left: 0, right: 0, height: 0 }}>
        {children}
      </BlurView>
    );
  }
  return <View style={{ paddingHorizontal: space.xl }}>{children}</View>;
}

export function Row({ children, style }: { children: ReactNode; style?: StyleProp<ViewStyle> }) {
  return (
    <View style={{ flexDirection: "row", alignItems: "center", gap: 10, ...(style as object) }}>{children}</View>
  );
}

export function MetaText({ children, style }: { children: ReactNode; style?: StyleProp<TextStyle> }) {
  const { palette, typography } = useTheme();
  return <Text style={[{ color: palette.inkDim, fontSize: 13 }, style]}>{children}</Text>;
}
