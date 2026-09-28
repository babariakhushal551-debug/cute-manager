// Design tokens — Apple-flavored warm minimalism (iOS 26 "Liquid Glass" vibes with graceful fallback).
import { Platform } from "react-native";

export const IS_IOS = Platform.OS === "ios";

export const palette = {
  // Core surfaces
  bg: "#F7F4F0",
  surface: "#FFFFFF",
  surfaceAlt: "#F1EDE7",
  // Text
  ink: "#1C1B1A",
  inkDim: "#6E6862",
  inkFaint: "#9C958D",
  // Separators
  hairline: "rgba(60,50,40,0.10)",
  // Brand gradient
  pink: "#FF76B0",
  violet: "#7C5CFF",
  peach: "#FFB88C",
  mint: "#3ECF8E",
  amber: "#FFB020",
  red: "#FF5D55",
  blue: "#4C7DFF",
  // Status colors
  statusInbox: "#7C5CFF",
  statusActionable: "#FF76B0",
  statusReference: "#3ECF8E",
  statusArchived: "#9C958D",
};

export type Palette = typeof palette;

export const typography = {
  display: { fontSize: 30, fontWeight: "800" as const, letterSpacing: -0.8 },
  title: { fontSize: 22, fontWeight: "700" as const, letterSpacing: -0.4 },
  title3: { fontSize: 18, fontWeight: "700" as const, letterSpacing: -0.3 },
  headline: { fontSize: 16, fontWeight: "600" as const },
  body: { fontSize: 15, fontWeight: "400" as const },
  callout: { fontSize: 14, fontWeight: "400" as const },
  sub: { fontSize: 13, fontWeight: "500" as const },
  footnote: { fontSize: 12, fontWeight: "500" as const },
  micro: { fontSize: 10.5, fontWeight: "600" as const, letterSpacing: 0.4 },
};

export const space = {
  xs: 4,
  s: 8,
  m: 12,
  l: 16,
  xl: 20,
  xxl: 28,
  xxxl: 36,
};

export const radius = {
  s: 10,
  m: 14,
  l: 18,
  xl: 24,
  pill: 999,
};

// Soft ambient shadows (iOS: native shadow props are fine)
export const shadow = (elev = 1) =>
  Platform.select({
    ios: {
      shadowColor: "#3A2B20",
      shadowOpacity: 0.10 + elev * 0.03,
      shadowRadius: 10 + elev * 6,
      shadowOffset: { width: 0, height: 4 + elev * 2 },
    },
    android: { elevation: 2 + elev * 2 },
    default: {},
  }) as object;

export const glassProps = (dark = false) => ({
  blurIntensity: dark ? 60 : 50,
});

export const gradients = {
  brand: [palette.pink, palette.violet] as const,
  warm: [palette.peach, palette.pink] as const,
  cool: [palette.blue, palette.violet] as const,
  mint: ["#7FE6BC", palette.mint] as const,
};
