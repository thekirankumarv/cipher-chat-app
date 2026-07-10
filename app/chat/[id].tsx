import { useEffect, useRef, useState } from "react";
import {
  View,
  Text,
  TextInput,
  Pressable,
  FlatList,
  Image,
  Linking,
  KeyboardAvoidingView,
  Platform,
} from "react-native";
import { useLocalSearchParams, useRouter } from "expo-router";
import { useTheme } from "../../lib/theme/ThemeProvider";
import { spacing, radii, typeScale } from "../../lib/theme/tokens";
import { useIdentity } from "../../lib/identity/useIdentity";
import { useChats } from "../../lib/chat/useChats";
import { useMessages, type Message } from "../../lib/chat/useMessages";
import { Avatar } from "../../components/Avatar";
import { pickImageOrVideo, pickFile } from "../../lib/media/pickMedia";
import { uploadMedia } from "../../lib/media/uploadMedia";

function formatSize(bytes?: number) {
  if (!bytes) return "";
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(0)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

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
  const sendMediaMessage = useMessages((s) => s.sendMediaMessage);
  const markRead = useMessages((s) => s.markRead);

  const [draft, setDraft] = useState("");
  const [uploadProgress, setUploadProgress] = useState<number | null>(null);
  const [uploadError, setUploadError] = useState<string | null>(null);
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

  const handleAttach = async (kind: "media" | "file") => {
    if (!uid || !id || !chatMeta) return;
    setUploadError(null);
    const picked = kind === "media" ? await pickImageOrVideo() : await pickFile();
    if (!picked) return;

    setUploadProgress(0);
    try {
      const response = await fetch(picked.uri);
      const blob = await response.blob();
      const url = await uploadMedia(id, picked.name, blob, setUploadProgress);
      await sendMediaMessage(id, uid, chatMeta.otherUid, {
        kind: picked.kind,
        url,
        name: picked.name,
        size: picked.size,
        mime: picked.mime,
      });
    } catch {
      setUploadError("Upload failed. Try again.");
    } finally {
      setUploadProgress(null);
    }
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
          const bubbleStyle = {
            alignSelf: mine ? ("flex-end" as const) : ("flex-start" as const),
            backgroundColor: mine ? colors.accent : colors.surface,
            borderRadius: radii.bubble,
            marginBottom: spacing.sm,
            maxWidth: "80%" as const,
          };
          const textColor = mine ? colors.accentInk : colors.text;

          if (item.type === "image") {
            return (
              <Pressable
                testID={`message-${item.id}`}
                onPress={() => item.mediaUrl && Linking.openURL(item.mediaUrl)}
                style={[bubbleStyle, { padding: spacing.xs, overflow: "hidden" }]}
              >
                <Image
                  testID={`message-image-${item.id}`}
                  source={{ uri: item.mediaUrl }}
                  style={{ width: 220, height: 220, borderRadius: radii.card }}
                  resizeMode="cover"
                />
              </Pressable>
            );
          }

          if (item.type === "video" || item.type === "file") {
            return (
              <Pressable
                testID={`message-${item.id}`}
                onPress={() => item.mediaUrl && Linking.openURL(item.mediaUrl)}
                style={[bubbleStyle, { paddingVertical: spacing.sm, paddingHorizontal: spacing.md }]}
              >
                <Text style={{ color: textColor, fontWeight: "700" }}>
                  {item.type === "video" ? "Video" : item.mediaName}
                </Text>
                <Text style={{ color: textColor, opacity: 0.8, fontSize: typeScale.meta.fontSize, marginTop: 2 }}>
                  {formatSize(item.mediaSize)} · tap to open
                </Text>
              </Pressable>
            );
          }

          return (
            <View
              testID={`message-${item.id}`}
              style={[bubbleStyle, { paddingVertical: spacing.sm, paddingHorizontal: spacing.md }]}
            >
              <Text style={{ color: textColor, fontSize: typeScale.message.fontSize }}>{item.text}</Text>
            </View>
          );
        }}
      />

      {uploadProgress !== null ? (
        <Text
          testID="upload-progress"
          style={{ color: colors.textSecondary, textAlign: "center", paddingBottom: spacing.xs }}
        >
          Uploading… {Math.round(uploadProgress * 100)}%
        </Text>
      ) : null}
      {uploadError ? (
        <Text testID="upload-error" style={{ color: colors.danger, textAlign: "center", paddingBottom: spacing.xs }}>
          {uploadError}
        </Text>
      ) : null}

      <View
        style={{
          flexDirection: "row",
          alignItems: "center",
          padding: spacing.md,
          borderTopWidth: 1,
          borderTopColor: colors.border,
        }}
      >
        <Pressable testID="attach-media" onPress={() => handleAttach("media")} style={{ marginRight: spacing.sm }}>
          <Text style={{ color: colors.accent, fontWeight: "700" }}>Photo</Text>
        </Pressable>
        <Pressable testID="attach-file" onPress={() => handleAttach("file")} style={{ marginRight: spacing.sm }}>
          <Text style={{ color: colors.accent, fontWeight: "700" }}>File</Text>
        </Pressable>
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
