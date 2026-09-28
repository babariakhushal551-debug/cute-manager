// Floating "+" capture button — zero-friction universal capture (PRD §8).
import { Pressable, View, Platform } from "react-native";
import { router } from "expo-router";
import { LinearGradient } from "expo-linear-gradient";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useTheme } from "../theme/theme";
import { Symbol } from "./primitives";
import { haptic } from "../services/haptics";

export function CaptureButton() {
  const { palette, shadow } = useTheme();
  const insets = useSafeAreaInsets();
  const bottom = insets.bottom + (Platform.OS === "ios" ? 92 : 84);

  return (
    <View pointerEvents="box-none" style={{ position: "absolute", right: 20, bottom, zIndex: 50 }}>
      <Pressable
        onPress={() => {
          haptic.tap();
          router.push("/capture");
        }}
        style={({ pressed }) => ({
          transform: [{ scale: pressed ? 0.92 : 1 }],
          borderRadius: 32,
          overflow: "hidden",
          ...shadow(2),
        })}
      >
        <LinearGradient
          colors={[palette.pink, palette.violet]}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 1 }}
          style={{ width: 62, height: 62, borderRadius: 31, alignItems: "center", justifyContent: "center" }}
        >
          <Symbol name="plus" size={26} color="#fff" />
        </LinearGradient>
      </Pressable>
    </View>
  );
}
