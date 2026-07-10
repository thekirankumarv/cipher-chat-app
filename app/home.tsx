import { useEffect } from "react";
import { View, Text, Pressable, FlatList } from "react-native";
import { useRouter } from "expo-router";
import { useTheme } from "../lib/theme/ThemeProvider";
import { spacing, radii, typeScale } from "../lib/theme/tokens";
import { useIdentity } from "../lib/identity/useIdentity";
import { useChats } from "../lib/chat/useChats";
import { Avatar } from "../components/Avatar";

function formatTime(ms: number | null) {
  if (!ms) return "";
  return new Date(ms).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
}

export default function HomeScreen() {
  const { colors } = useTheme();
  const router = useRouter();
  const uid = useIdentity((s) => s.uid);
  const chats = useChats((s) => s.chats);
  const loading = useChats((s) => s.loading);
  const subscribe = useChats((s) => s.subscribe);

  useEffect(() => {
    if (!uid) return;
    const unsubscribe = subscribe(uid);
    return unsubscribe;
  }, [uid, subscribe]);

  return (
    <View style={{ flex: 1, backgroundColor: colors.background }}>
      <View
        style={{
          flexDirection: "row",
          justifyContent: "space-between",
          alignItems: "center",
          padding: spacing.lg,
        }}
      >
        <Text
          style={{
            color: colors.text,
            fontSize: typeScale.screenTitle.fontSize,
            fontWeight: typeScale.screenTitle.fontWeight,
          }}
        >
          Cipher
        </Text>
        <View style={{ flexDirection: "row", alignItems: "center", gap: spacing.md }}>
          <Pressable testID="settings-link" onPress={() => router.push("/settings")}>
            <Text style={{ color: colors.textSecondary, fontWeight: "600" }}>Settings</Text>
          </Pressable>
          <Pressable
            testID="connect-fab"
            onPress={() => router.push("/connect")}
            style={{
              backgroundColor: colors.accent,
              borderRadius: radii.button,
              paddingVertical: spacing.sm,
              paddingHorizontal: spacing.lg,
            }}
          >
            <Text style={{ color: colors.accentInk, fontWeight: "700" }}>+ Connect</Text>
          </Pressable>
        </View>
      </View>

      {!loading && chats.length === 0 ? (
        <View style={{ flex: 1, alignItems: "center", justifyContent: "center", padding: spacing.lg }}>
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
            testID="connect-fab-empty"
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
      ) : (
        <FlatList
          testID="chat-list"
          data={chats}
          keyExtractor={(item) => item.id}
          renderItem={({ item }) => (
            <Pressable
              testID={`chat-row-${item.id}`}
              onPress={() => router.push(`/chat/${item.id}`)}
              style={{
                flexDirection: "row",
                alignItems: "center",
                padding: spacing.lg,
                borderBottomWidth: 1,
                borderBottomColor: colors.border,
              }}
            >
              <Avatar seed={item.otherAvatarSeed} size={48} />
              <View style={{ flex: 1, marginLeft: spacing.md }}>
                <Text
                  style={{
                    color: colors.text,
                    fontSize: typeScale.chatName.fontSize,
                    fontWeight: typeScale.chatName.fontWeight,
                  }}
                >
                  {item.otherDisplayId}
                </Text>
                <Text numberOfLines={1} style={{ color: colors.textSecondary, marginTop: 2 }}>
                  {item.lastMessage || "Say hi"}
                </Text>
              </View>
              <View style={{ alignItems: "flex-end" }}>
                <Text style={{ color: colors.textTertiary, fontSize: typeScale.meta.fontSize }}>
                  {formatTime(item.lastMessageAt)}
                </Text>
                {item.unreadCount > 0 ? (
                  <View
                    testID={`unread-badge-${item.id}`}
                    style={{
                      backgroundColor: colors.accent,
                      borderRadius: radii.button,
                      minWidth: 20,
                      height: 20,
                      alignItems: "center",
                      justifyContent: "center",
                      marginTop: spacing.xs,
                      paddingHorizontal: 6,
                    }}
                  >
                    <Text style={{ color: colors.accentInk, fontSize: 11, fontWeight: "700" }}>
                      {item.unreadCount}
                    </Text>
                  </View>
                ) : null}
              </View>
            </Pressable>
          )}
        />
      )}
    </View>
  );
}
