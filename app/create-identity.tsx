import { View, Text, Pressable } from "react-native";
import { useRouter } from "expo-router";
import { useTheme } from "../lib/theme/ThemeProvider";
import { spacing, typeScale, radii } from "../lib/theme/tokens";
import { useIdentity } from "../lib/identity/useIdentity";
import { Avatar } from "../components/Avatar";

export default function CreateIdentityScreen() {
  const { colors } = useTheme();
  const router = useRouter();
  const draftDisplayId = useIdentity((state) => state.draftDisplayId);
  const draftAvatarSeed = useIdentity((state) => state.draftAvatarSeed);
  const shuffleDraft = useIdentity((state) => state.shuffleDraft);
  const confirmIdentity = useIdentity((state) => state.confirmIdentity);

  const handleContinue = async () => {
    await confirmIdentity();
    router.replace("/home");
  };

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
          marginBottom: spacing.xl,
        }}
      >
        Create your identity
      </Text>
      <Avatar seed={draftAvatarSeed} size={96} />
      <Text
        style={{
          color: colors.text,
          fontSize: typeScale.chatName.fontSize,
          fontWeight: typeScale.chatName.fontWeight,
          marginTop: spacing.md,
        }}
      >
        {draftDisplayId}
      </Text>
      <Pressable testID="shuffle-button" onPress={shuffleDraft} style={{ marginTop: spacing.md }}>
        <Text style={{ color: colors.accent }}>Shuffle</Text>
      </Pressable>
      <Pressable
        testID="continue-button"
        onPress={handleContinue}
        style={{
          backgroundColor: colors.accent,
          borderRadius: radii.button,
          paddingVertical: spacing.md,
          paddingHorizontal: spacing.xxl,
          marginTop: spacing.xl,
        }}
      >
        <Text style={{ color: colors.accentInk, fontWeight: "700" }}>Continue</Text>
      </Pressable>
    </View>
  );
}
