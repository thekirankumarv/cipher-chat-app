import { useEffect, useRef, useState } from "react";
import { View, Text, TextInput, Pressable, FlatList, KeyboardAvoidingView, Platform } from "react-native";
import { useLocalSearchParams, useRouter } from "expo-router";
import { useTheme } from "../../lib/theme/ThemeProvider";
import { spacing, radii, typeScale } from "../../lib/theme/tokens";
import { useIdentity } from "../../lib/identity/useIdentity";
import { useChats } from "../../lib/chat/useChats";
import { useMessages, type Message } from "../../lib/chat/useMessages";
import { Avatar } from "../../components/Avatar";

export default function ChatScreen() {
  const { id: rawId } = useLocalSearchParams<{ id: string }>();
  const id = Array.isArray(rawId) ? rawId[0] : rawId;
  const { colors } = useTheme();
  const router = useRouter();
  const uid = useIdentity((s) => s.uid);
  const chatMeta = useChats((s) => s.chats.find((c) => c.id === id));
  const chatsSubscribe = useChats((s) => s.subscribe);
  const messages = useMessages((s) => s.messages);
  const subscribe = useMessages((s) => s.subscribe);
  const sendMessage = useMessages((s) => s.sendMessage);
  const markRead = useMessages((s) => s.markRead);

  const [draft, setDraft] = useState("");
  const listRef = useRef<FlatList<Message>>(null);

  useEffect(() => {
    if (!id) return;
    const unsubscribe = subscribe(id);
    return unsubscribe;
  }, [id, subscribe]);

  // Chat metadata (friend's name/avatar) normally comes from Home's chat-list
  // subscription. Landing here directly — a deep link or a page reload while
  // already in a chat — means that subscription never ran, so subscribe here
  // too; it's cheap and idempotent at 10-user scale.
  useEffect(() => {
    if (!uid) return;
    const unsubscribe = chatsSubscribe(uid);
    return unsubscribe;
  }, [uid, chatsSubscribe]);

  useEffect(() => {
    if (uid && id) markRead(id, uid);
  }, [uid, id, messages.length, markRead]);

  const handleSend = () => {
    if (!uid || !id || !chatMeta || !draft.trim()) return;
    const text = draft;
    setDraft("");
    sendMessage(id, uid, chatMeta.otherUid, text);
  };

  return (
    <KeyboardAvoidingView
      style={{ flex: 1, backgroundColor: colors.background }}
      behavior={Platform.OS === "ios" ? "padding" : undefined}
    >
      <View
        style={{
          flexDirection: "row",
          alignItems: "center",
          padding: spacing.lg,
          borderBottomWidth: 1,
          borderBottomColor: colors.border,
        }}
      >
        <Pressable testID="chat-back" onPress={() => router.back()} style={{ marginRight: spacing.md }}>
          <Text style={{ color: colors.accent, fontSize: typeScale.header.fontSize }}>‹</Text>
        </Pressable>
        {chatMeta ? <Avatar seed={chatMeta.otherAvatarSeed} size={36} /> : null}
        <Text
          style={{
            color: colors.text,
            fontSize: typeScale.chatName.fontSize,
            fontWeight: typeScale.chatName.fontWeight,
            marginLeft: spacing.sm,
          }}
        >
          {chatMeta?.otherDisplayId ?? "Chat"}
        </Text>
      </View>

      <FlatList
        testID="message-list"
        ref={listRef}
        data={messages}
        keyExtractor={(item) => item.id}
        contentContainerStyle={{ padding: spacing.lg }}
        onContentSizeChange={() => listRef.current?.scrollToEnd({ animated: true })}
        renderItem={({ item }) => {
          const mine = item.senderId === uid;
          return (
            <View
              testID={`message-${item.id}`}
              style={{
                alignSelf: mine ? "flex-end" : "flex-start",
                backgroundColor: mine ? colors.accent : colors.surface,
                borderRadius: radii.bubble,
                paddingVertical: spacing.sm,
                paddingHorizontal: spacing.md,
                marginBottom: spacing.sm,
                maxWidth: "80%",
              }}
            >
              <Text style={{ color: mine ? colors.accentInk : colors.text, fontSize: typeScale.message.fontSize }}>
                {item.text}
              </Text>
            </View>
          );
        }}
      />

      <View
        style={{
          flexDirection: "row",
          alignItems: "center",
          padding: spacing.md,
          borderTopWidth: 1,
          borderTopColor: colors.border,
        }}
      >
        <TextInput
          testID="message-input"
          value={draft}
          onChangeText={setDraft}
          placeholder="Message"
          placeholderTextColor={colors.textTertiary}
          style={{
            flex: 1,
            borderWidth: 1,
            borderColor: colors.border,
            borderRadius: radii.card,
            paddingHorizontal: spacing.md,
            paddingVertical: spacing.sm,
            color: colors.text,
            marginRight: spacing.sm,
          }}
          onSubmitEditing={handleSend}
        />
        <Pressable
          testID="send-button"
          onPress={handleSend}
          style={{
            backgroundColor: colors.accent,
            borderRadius: radii.button,
            paddingVertical: spacing.sm,
            paddingHorizontal: spacing.lg,
          }}
        >
          <Text style={{ color: colors.accentInk, fontWeight: "700" }}>Send</Text>
        </Pressable>
      </View>
    </KeyboardAvoidingView>
  );
}
