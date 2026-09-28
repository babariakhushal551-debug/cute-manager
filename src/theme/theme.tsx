import { createContext, useContext, useMemo } from "react";
import { useColorScheme } from "react-native";
import { palette, typography, space, radius, shadow, gradients, IS_IOS } from "./tokens";

export interface Theme {
  dark: boolean;
  palette: typeof palette;
  darkPalette: typeof darkPalette;
  typography: typeof typography;
  space: typeof space;
  radius: typeof radius;
  shadow: typeof shadow;
  gradients: typeof gradients;
  isIOS: boolean;
}

export const darkPalette = {
  bg: "#141216",
  surface: "#1E1B20",
  surfaceAlt: "#262229",
  ink: "#F3EFF0",
  inkDim: "#A79FA8",
  inkFaint: "#6E6672",
  hairline: "rgba(255,255,255,0.10)",
  pink: "#FF76B0",
  violet: "#9D85FF",
  peach: "#FFB88C",
  mint: "#3ECF8E",
  amber: "#FFB020",
  red: "#FF5D55",
  blue: "#6E96FF",
  statusInbox: "#9D85FF",
  statusActionable: "#FF76B0",
  statusReference: "#3ECF8E",
  statusArchived: "#6E6672",
};

const ThemeContext = createContext<Theme | null>(null);

export function ThemeProvider({ children }: { children: React.ReactNode }) {
  const scheme = useColorScheme();
  const value = useMemo<Theme>(
    () => ({
      dark: scheme === "dark",
      palette: scheme === "dark" ? darkPalette : palette,
      darkPalette,
      typography,
      space,
      radius,
      shadow,
      gradients,
      isIOS: IS_IOS,
    }),
    [scheme],
  );
  return <ThemeContext.Provider value={value}>{children}</ThemeContext.Provider>;
}

export function useTheme(): Theme {
  const ctx = useContext(ThemeContext);
  if (!ctx) throw new Error("useTheme must be used inside ThemeProvider");
  return ctx;
}
