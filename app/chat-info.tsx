import { useEffect } from "react";
import { View, Text, Pressable } from "react-native";
import { useLocalSearchParams, useRouter } from "expo-router";
import { useTheme } from "../lib/theme/ThemeProvider";
import { spacing, typeScale } from "../lib/theme/tokens";
import { useIdentity } from "../lib/identity/useIdentity";
import { useChats } from "../lib/chat/useChats";
import { useUserPresence, formatLastSeen } from "../lib/presence/useUserPresence";
import { Avatar } from "../components/Avatar";

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

export default function ChatInfoScreen() {
  const { id: rawId } = useLocalSearchParams<{ id: string }>();
  const id = Array.isArray(rawId) ? rawId[0] : rawId;
  const { colors } = useTheme();
  const router = useRouter();
  const uid = useIdentity((s) => s.uid);
  const chatMeta = useChats((s) => s.chats.find((c) => c.id === id));
  const chatsSubscribe = useChats((s) => s.subscribe);
  const presenceByUid = useUserPresence((s) => s.byUid);
  const presenceSubscribe = useUserPresence((s) => s.subscribe);

  useEffect(() => {
    if (!uid) return;
    const unsubscribe = chatsSubscribe(uid);
    return unsubscribe;
  }, [uid, chatsSubscribe]);

  useEffect(() => {
    if (!chatMeta?.otherUid) return;
    const unsubscribe = presenceSubscribe(chatMeta.otherUid);
    return unsubscribe;
  }, [chatMeta?.otherUid, presenceSubscribe]);

  const presence = chatMeta?.otherUid ? presenceByUid[chatMeta.otherUid] : undefined;

  return (
    <View style={{ flex: 1, backgroundColor: colors.background, padding: spacing.lg }}>
      <View style={{ flexDirection: "row", alignItems: "center", marginBottom: spacing.lg }}>
        <Pressable testID="chat-info-back" onPress={() => router.back()} style={{ marginRight: spacing.md }}>
          <Text style={{ color: colors.accent, fontSize: typeScale.header.fontSize }}>‹</Text>
        </Pressable>
        <Text
          style={{ color: colors.text, fontSize: typeScale.screenTitle.fontSize, fontWeight: typeScale.screenTitle.fontWeight }}
        >
          Chat Info
        </Text>
      </View>

      {chatMeta ? (
        <>
          <View style={{ alignItems: "center", marginTop: spacing.lg }}>
            <Avatar seed={chatMeta.otherAvatarSeed} size={72} />
            <Text
              style={{
                color: colors.text,
                fontSize: typeScale.header.fontSize,
                fontWeight: typeScale.header.fontWeight,
                marginTop: spacing.md,
              }}
            >
              {chatMeta.otherDisplayId}
            </Text>
            <Text testID="chat-info-presence" style={{ color: colors.textSecondary, marginTop: spacing.xs }}>
              {presence?.online ? "Online" : formatLastSeen(presence?.lastSeen ?? null)}
            </Text>
          </View>

          <SectionLabel>Disappearing messages</SectionLabel>
          <Text style={{ color: colors.textSecondary }}>
            {chatMeta.disappearingDuration === "off"
              ? "Off — messages stay until deleted."
              : `New messages disappear after ${chatMeta.disappearingDuration}. Change this from the chat screen.`}
          </Text>
        </>
      ) : (
        <Text style={{ color: colors.textSecondary }}>Loading…</Text>
      )}
    </View>
  );
}
