import { View, Text, Pressable } from "react-native";
import { useRouter } from "expo-router";
import { useTheme } from "../lib/theme/ThemeProvider";
import { spacing, radii, typeScale } from "../lib/theme/tokens";

export default function HomeScreen() {
  const { colors } = useTheme();
  const router = useRouter();
  return (
    <View
      style={{
        flex: 1,
        backgroundColor: colors.background,
        alignItems: "center",
        justifyContent: "center",
        padding: spacing.lg,
      }}
    >
      <Text
        style={{
          color: colors.text,
          fontSize: typeScale.header.fontSize,
          fontWeight: typeScale.header.fontWeight,
          marginBottom: spacing.xl,
        }}
      >
        No connections yet
      </Text>
      <Pressable
        testID="connect-fab"
        onPress={() => router.push("/connect")}
        style={{
          backgroundColor: colors.accent,
          borderRadius: radii.button,
          paddingVertical: spacing.md,
          paddingHorizontal: spacing.xxl,
        }}
      >
        <Text style={{ color: colors.accentInk, fontWeight: "700" }}>Connect with someone</Text>
      </Pressable>
    </View>
  );
}
