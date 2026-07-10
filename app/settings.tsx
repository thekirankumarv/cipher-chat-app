import { useState } from "react";
import { View, Text, Pressable, ScrollView } from "react-native";
import { useRouter } from "expo-router";
import { useTheme, type ThemeModePreference } from "../lib/theme/ThemeProvider";
import { spacing, radii, typeScale } from "../lib/theme/tokens";
import { useIdentity } from "../lib/identity/useIdentity";
import { Avatar } from "../components/Avatar";

const THEME_OPTIONS: { value: ThemeModePreference; label: string }[] = [
  { value: "light", label: "Light" },
  { value: "dark", label: "Dark" },
  { value: "system", label: "System" },
];

function SectionLabel({ children }: { children: string }) {
  const { colors } = useTheme();
  return (
    <Text
      style={{
        color: colors.textTertiary,
        fontSize: typeScale.meta.fontSize,
        fontWeight: "700",
        textTransform: "uppercase",
        marginTop: spacing.xl,
        marginBottom: spacing.sm,
      }}
    >
      {children}
    </Text>
  );
}

export default function SettingsScreen() {
  const { colors, mode, setMode } = useTheme();
  const router = useRouter();
  const displayId = useIdentity((s) => s.displayId);
  const avatarSeed = useIdentity((s) => s.avatarSeed);
  const resetIdentity = useIdentity((s) => s.resetIdentity);

  const [confirmingReset, setConfirmingReset] = useState(false);
  const [resetting, setResetting] = useState(false);
  const [resetError, setResetError] = useState<string | null>(null);

  const handleReset = async () => {
    setResetting(true);
    setResetError(null);
    try {
      await resetIdentity();
      router.replace("/");
    } catch (err) {
      setResetError(err instanceof Error ? err.message : "Couldn't reset. Try again.");
      setResetting(false);
    }
  };

  return (
    <ScrollView style={{ flex: 1, backgroundColor: colors.background }} contentContainerStyle={{ padding: spacing.lg }}>
      <View style={{ flexDirection: "row", alignItems: "center", marginBottom: spacing.lg }}>
        <Pressable testID="settings-back" onPress={() => router.back()} style={{ marginRight: spacing.md }}>
          <Text style={{ color: colors.accent, fontSize: typeScale.header.fontSize }}>‹</Text>
        </Pressable>
        <Text
          style={{ color: colors.text, fontSize: typeScale.screenTitle.fontSize, fontWeight: typeScale.screenTitle.fontWeight }}
        >
          Settings
        </Text>
      </View>

      <SectionLabel>Your identity</SectionLabel>
      <View style={{ flexDirection: "row", alignItems: "center" }}>
        {avatarSeed ? <Avatar seed={avatarSeed} size={48} /> : null}
        <Text
          style={{
            color: colors.text,
            fontSize: typeScale.chatName.fontSize,
            fontWeight: typeScale.chatName.fontWeight,
            marginLeft: spacing.md,
          }}
        >
          {displayId ?? "—"}
        </Text>
      </View>

      <SectionLabel>Appearance</SectionLabel>
      <View style={{ flexDirection: "row", gap: spacing.sm }}>
        {THEME_OPTIONS.map((opt) => (
          <Pressable
            key={opt.value}
            testID={`theme-${opt.value}`}
            onPress={() => setMode(opt.value)}
            style={{
              paddingVertical: spacing.sm,
              paddingHorizontal: spacing.lg,
              borderRadius: radii.button,
              backgroundColor: mode === opt.value ? colors.accent : colors.surface,
            }}
          >
            <Text style={{ color: mode === opt.value ? colors.accentInk : colors.text, fontWeight: "600" }}>
              {opt.label}
            </Text>
          </Pressable>
        ))}
      </View>

      <SectionLabel>About</SectionLabel>
      <Text style={{ color: colors.textSecondary, lineHeight: 20 }}>
        Cipher is a private, anonymous chat for a small group of people you trust. No phone number,
        no email, no real name — just a generated ID and a procedural avatar. Messages are stored
        only for the two people in a conversation.
      </Text>

      <SectionLabel>Danger zone</SectionLabel>
      {!confirmingReset ? (
        <Pressable
          testID="reset-identity-button"
          onPress={() => setConfirmingReset(true)}
          style={{
            borderWidth: 1,
            borderColor: colors.danger,
            borderRadius: radii.button,
            paddingVertical: spacing.md,
            alignItems: "center",
          }}
        >
          <Text style={{ color: colors.danger, fontWeight: "700" }}>Reset identity</Text>
        </Pressable>
      ) : (
        <View style={{ backgroundColor: colors.dangerSurface, borderRadius: radii.card, padding: spacing.lg }}>
          <Text style={{ color: colors.text, marginBottom: spacing.md }}>
            This deletes your local identity and signs you out. Your chats won't be reachable
            afterward — this can't be undone. Continue?
          </Text>
          {resetError ? (
            <Text style={{ color: colors.danger, marginBottom: spacing.md }}>{resetError}</Text>
          ) : null}
          <View style={{ flexDirection: "row", gap: spacing.md }}>
            <Pressable
              testID="reset-identity-confirm"
              onPress={handleReset}
              disabled={resetting}
              style={{
                flex: 1,
                backgroundColor: colors.danger,
                borderRadius: radii.button,
                paddingVertical: spacing.md,
                alignItems: "center",
                opacity: resetting ? 0.6 : 1,
              }}
            >
              <Text style={{ color: "#ffffff", fontWeight: "700" }}>
                {resetting ? "Resetting…" : "Yes, reset"}
              </Text>
            </Pressable>
            <Pressable
              testID="reset-identity-cancel"
              onPress={() => setConfirmingReset(false)}
              disabled={resetting}
              style={{
                flex: 1,
                borderWidth: 1,
                borderColor: colors.border,
                borderRadius: radii.button,
                paddingVertical: spacing.md,
                alignItems: "center",
              }}
            >
              <Text style={{ color: colors.text, fontWeight: "700" }}>Cancel</Text>
            </Pressable>
          </View>
        </View>
      )}
    </ScrollView>
  );
}
