import { useEffect } from "react";
import { View, Text, Pressable } from "react-native";
import { Redirect, useRouter } from "expo-router";
import { useTheme } from "../lib/theme/ThemeProvider";
import { spacing, typeScale, radii } from "../lib/theme/tokens";
import { useIdentity } from "../lib/identity/useIdentity";

export default function WelcomeScreen() {
  const { colors } = useTheme();
  const router = useRouter();
  const status = useIdentity((state) => state.status);
  const bootstrap = useIdentity((state) => state.bootstrap);

  useEffect(() => {
    bootstrap();
  }, [bootstrap]);

  if (status === "ready") {
    return <Redirect href="/home" />;
  }

  if (status === "needs-identity") {
    return (
      <View
        style={{
          flex: 1,
          alignItems: "center",
          justifyContent: "center",
          backgroundColor: colors.background,
          padding: spacing.lg,
        }}
      >
        <Text
          style={{
            color: colors.text,
            fontSize: typeScale.screenTitle.fontSize,
            fontWeight: typeScale.screenTitle.fontWeight,
            marginBottom: spacing.md,
          }}
        >
          Cipher
        </Text>
        <Text
          style={{
            color: colors.textSecondary,
            fontSize: typeScale.message.fontSize,
            textAlign: "center",
            marginBottom: spacing.xl,
          }}
        >
          Anonymous, private chat for up to 10 people. No number, no email — just you.
        </Text>
        <Pressable
          testID="get-started-button"
          onPress={() => router.push("/create-identity")}
          style={{
            backgroundColor: colors.accent,
            borderRadius: radii.button,
            paddingVertical: spacing.md,
            paddingHorizontal: spacing.xxl,
          }}
        >
          <Text style={{ color: colors.accentInk, fontWeight: "700" }}>Get started</Text>
        </Pressable>
      </View>
    );
  }

  return (
    <View
      style={{
        flex: 1,
        alignItems: "center",
        justifyContent: "center",
        backgroundColor: colors.background,
      }}
    >
      <Text style={{ color: colors.textSecondary }}>Loading…</Text>
    </View>
  );
}
