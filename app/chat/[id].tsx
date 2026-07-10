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
import * as Clipboard from "expo-clipboard";
import { useTheme } from "../../lib/theme/ThemeProvider";
import { spacing, radii, typeScale } from "../../lib/theme/tokens";
import { useIdentity } from "../../lib/identity/useIdentity";
import { useChats } from "../../lib/chat/useChats";
import { useMessages, type Message, type ReplyPreview } from "../../lib/chat/useMessages";
import { useUserPresence, formatLastSeen } from "../../lib/presence/useUserPresence";
import { Avatar } from "../../components/Avatar";
import { pickImageOrVideo, pickFile } from "../../lib/media/pickMedia";
import { uploadMedia } from "../../lib/media/uploadMedia";

function formatSize(bytes?: number) {
  if (!bytes) return "";
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(0)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

function previewFor(message: Message): string {
  if (message.type === "image") return "Photo";
  if (message.type === "video") return "Video";
  if (message.type === "file") return message.mediaName ?? "File";
  return message.text;
}

export default function ChatScreen() {
  const { id: rawId } = useLocalSearchParams<{ id: string }>();
  const id = Array.isArray(rawId) ? rawId[0] : rawId;
  const { colors } = useTheme();
  const router = useRouter();
  const uid = useIdentity((s) => s.uid);
  const chatMeta = useChats((s) => s.chats.find((c) => c.id === id));
  const chatsSubscribe = useChats((s) => s.subscribe);
  const setTyping = useChats((s) => s.setTyping);
  const presenceByUid = useUserPresence((s) => s.byUid);
  const presenceSubscribe = useUserPresence((s) => s.subscribe);
  const messages = useMessages((s) => s.messages);
  const subscribe = useMessages((s) => s.subscribe);
  const sendMessage = useMessages((s) => s.sendMessage);
  const sendMediaMessage = useMessages((s) => s.sendMediaMessage);
  const editMessage = useMessages((s) => s.editMessage);
  const deleteMessage = useMessages((s) => s.deleteMessage);
  const markRead = useMessages((s) => s.markRead);

  const [draft, setDraft] = useState("");
  const [uploadProgress, setUploadProgress] = useState<number | null>(null);
  const [uploadError, setUploadError] = useState<string | null>(null);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [replyTarget, setReplyTarget] = useState<ReplyPreview | null>(null);
  const [editingId, setEditingId] = useState<string | null>(null);
  const listRef = useRef<FlatList<Message>>(null);
  const typingTimeout = useRef<ReturnType<typeof setTimeout> | null>(null);

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

  useEffect(() => {
    if (!chatMeta?.otherUid) return;
    const unsubscribe = presenceSubscribe(chatMeta.otherUid);
    return unsubscribe;
  }, [chatMeta?.otherUid, presenceSubscribe]);

  // Clear the typing flag on unmount (leaving the chat) so it doesn't stick
  // on for the other participant if the tab closes mid-timeout.
  useEffect(() => {
    return () => {
      if (typingTimeout.current) clearTimeout(typingTimeout.current);
      if (uid && id) setTyping(id, uid, false);
    };
  }, [uid, id, setTyping]);

  const handleDraftChange = (text: string) => {
    setDraft(text);
    if (!uid || !id || editingId) return;
    setTyping(id, uid, true);
    if (typingTimeout.current) clearTimeout(typingTimeout.current);
    typingTimeout.current = setTimeout(() => setTyping(id, uid, false), 2000);
  };

  const handleSend = () => {
    if (!uid || !id || !chatMeta || !draft.trim()) return;

    if (typingTimeout.current) clearTimeout(typingTimeout.current);
    setTyping(id, uid, false);

    if (editingId) {
      const text = draft;
      setDraft("");
      setEditingId(null);
      editMessage(id, editingId, text);
      return;
    }

    const text = draft;
    const reply = replyTarget ?? undefined;
    setDraft("");
    setReplyTarget(null);
    if (reply) {
      sendMessage(id, uid, chatMeta.otherUid, text, reply);
    } else {
      sendMessage(id, uid, chatMeta.otherUid, text);
    }
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
      const reply = replyTarget ?? undefined;
      setReplyTarget(null);
      const media = { kind: picked.kind, url, name: picked.name, size: picked.size, mime: picked.mime };
      if (reply) {
        await sendMediaMessage(id, uid, chatMeta.otherUid, media, reply);
      } else {
        await sendMediaMessage(id, uid, chatMeta.otherUid, media);
      }
    } catch {
      setUploadError("Upload failed. Try again.");
    } finally {
      setUploadProgress(null);
    }
  };

  const startReply = (item: Message) => {
    if (!uid) return;
    setSelectedId(null);
    setEditingId(null);
    setReplyTarget({ messageId: item.id, senderId: item.senderId, preview: previewFor(item) });
  };

  const startEdit = (item: Message) => {
    setSelectedId(null);
    setReplyTarget(null);
    setEditingId(item.id);
    setDraft(item.text);
  };

  const handleCopy = async (item: Message) => {
    setSelectedId(null);
    await Clipboard.setStringAsync(previewFor(item));
  };

  const handleDelete = async (item: Message) => {
    setSelectedId(null);
    if (!id) return;
    await deleteMessage(id, item.id);
  };

  const lastMineMessage = [...messages].reverse().find((m) => m.senderId === uid && !m.deleted);

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
        <View style={{ marginLeft: spacing.sm }}>
          <Text
            style={{
              color: colors.text,
              fontSize: typeScale.chatName.fontSize,
              fontWeight: typeScale.chatName.fontWeight,
            }}
          >
            {chatMeta?.otherDisplayId ?? "Chat"}
          </Text>
          <Text testID="presence-status" style={{ color: colors.textSecondary, fontSize: typeScale.meta.fontSize }}>
            {chatMeta?.otherTyping
              ? "typing…"
              : chatMeta?.otherUid && presenceByUid[chatMeta.otherUid]?.online
                ? "Online"
                : chatMeta?.otherUid
                  ? formatLastSeen(presenceByUid[chatMeta.otherUid]?.lastSeen ?? null)
                  : ""}
          </Text>
        </View>
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
          const isLastOfMine = mine && item.id === lastMineMessage?.id;
          const readStatus =
            isLastOfMine && item.createdAt
              ? chatMeta?.otherLastRead && chatMeta.otherLastRead >= item.createdAt
                ? "Read"
                : "Delivered"
              : null;
          const statusLine = readStatus ? (
            <Text
              testID={`read-status-${item.id}`}
              style={{
                color: colors.textTertiary,
                fontSize: 11,
                alignSelf: "flex-end",
                marginBottom: spacing.sm,
              }}
            >
              {readStatus}
            </Text>
          ) : null;
          const bubbleStyle = {
            alignSelf: mine ? ("flex-end" as const) : ("flex-start" as const),
            backgroundColor: mine ? colors.accent : colors.surface,
            borderRadius: radii.bubble,
            marginBottom: spacing.xs,
            maxWidth: "80%" as const,
          };
          const textColor = mine ? colors.accentInk : colors.text;
          const isSelected = selectedId === item.id;

          if (item.deleted) {
            return (
              <View
                testID={`message-${item.id}`}
                style={[bubbleStyle, { paddingVertical: spacing.sm, paddingHorizontal: spacing.md, marginBottom: spacing.sm }]}
              >
                <Text style={{ color: textColor, fontStyle: "italic", opacity: 0.7 }}>
                  This message was deleted
                </Text>
              </View>
            );
          }

          const replyBanner = item.replyTo ? (
            <View
              style={{
                borderLeftWidth: 3,
                borderLeftColor: mine ? colors.accentInk : colors.accent,
                paddingLeft: spacing.sm,
                marginBottom: spacing.xs,
                opacity: 0.8,
              }}
            >
              <Text numberOfLines={1} style={{ color: textColor, fontSize: typeScale.meta.fontSize }}>
                {item.replyTo.preview}
              </Text>
            </View>
          ) : null;

          const actionRow = isSelected ? (
            <View
              testID={`message-actions-${item.id}`}
              style={{
                flexDirection: "row",
                alignSelf: mine ? "flex-end" : "flex-start",
                gap: spacing.sm,
                marginBottom: spacing.sm,
              }}
            >
              <Pressable testID={`action-reply-${item.id}`} onPress={() => startReply(item)}>
                <Text style={{ color: colors.accent, fontSize: typeScale.meta.fontSize }}>Reply</Text>
              </Pressable>
              {item.type === "text" ? (
                <Pressable testID={`action-copy-${item.id}`} onPress={() => handleCopy(item)}>
                  <Text style={{ color: colors.accent, fontSize: typeScale.meta.fontSize }}>Copy</Text>
                </Pressable>
              ) : null}
              {mine && item.type === "text" ? (
                <Pressable testID={`action-edit-${item.id}`} onPress={() => startEdit(item)}>
                  <Text style={{ color: colors.accent, fontSize: typeScale.meta.fontSize }}>Edit</Text>
                </Pressable>
              ) : null}
              {mine ? (
                <Pressable testID={`action-delete-${item.id}`} onPress={() => handleDelete(item)}>
                  <Text style={{ color: colors.danger, fontSize: typeScale.meta.fontSize }}>Delete</Text>
                </Pressable>
              ) : null}
            </View>
          ) : null;

          if (item.type === "image") {
            return (
              <View>
                <Pressable
                  testID={`message-${item.id}`}
                  onPress={() => setSelectedId(isSelected ? null : item.id)}
                  onLongPress={() => setSelectedId(item.id)}
                  style={[bubbleStyle, { padding: spacing.xs, overflow: "hidden" }]}
                >
                  {replyBanner}
                  <Image
                    testID={`message-image-${item.id}`}
                    source={{ uri: item.mediaUrl }}
                    style={{ width: 220, height: 220, borderRadius: radii.card }}
                    resizeMode="cover"
                  />
                </Pressable>
                {isSelected ? (
                  <View style={{ alignSelf: mine ? "flex-end" : "flex-start", marginBottom: spacing.xs }}>
                    <Pressable
                      testID={`action-open-${item.id}`}
                      onPress={() => item.mediaUrl && Linking.openURL(item.mediaUrl)}
                    >
                      <Text style={{ color: colors.accent, fontSize: typeScale.meta.fontSize }}>Open</Text>
                    </Pressable>
                  </View>
                ) : null}
                {statusLine}
                {actionRow}
              </View>
            );
          }

          if (item.type === "video" || item.type === "file") {
            return (
              <View>
                <Pressable
                  testID={`message-${item.id}`}
                  onPress={() => setSelectedId(isSelected ? null : item.id)}
                  onLongPress={() => setSelectedId(item.id)}
                  style={[bubbleStyle, { paddingVertical: spacing.sm, paddingHorizontal: spacing.md }]}
                >
                  {replyBanner}
                  <Text style={{ color: textColor, fontWeight: "700" }}>
                    {item.type === "video" ? "Video" : item.mediaName}
                  </Text>
                  <Text style={{ color: textColor, opacity: 0.8, fontSize: typeScale.meta.fontSize, marginTop: 2 }}>
                    {formatSize(item.mediaSize)} · tap to select, then Open
                  </Text>
                </Pressable>
                {isSelected ? (
                  <View style={{ alignSelf: mine ? "flex-end" : "flex-start", marginBottom: spacing.xs }}>
                    <Pressable
                      testID={`action-open-${item.id}`}
                      onPress={() => item.mediaUrl && Linking.openURL(item.mediaUrl)}
                    >
                      <Text style={{ color: colors.accent, fontSize: typeScale.meta.fontSize }}>Open</Text>
                    </Pressable>
                  </View>
                ) : null}
                {statusLine}
                {actionRow}
              </View>
            );
          }

          return (
            <View>
              <Pressable
                testID={`message-${item.id}`}
                onPress={() => setSelectedId(isSelected ? null : item.id)}
                onLongPress={() => setSelectedId(item.id)}
                style={[bubbleStyle, { paddingVertical: spacing.sm, paddingHorizontal: spacing.md }]}
              >
                {replyBanner}
                <Text style={{ color: textColor, fontSize: typeScale.message.fontSize }}>{item.text}</Text>
                {item.edited ? (
                  <Text style={{ color: textColor, opacity: 0.7, fontSize: 11, fontStyle: "italic", marginTop: 2 }}>
                    Edited
                  </Text>
                ) : null}
              </Pressable>
              {statusLine}
              {actionRow}
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

      {replyTarget ? (
        <View
          testID="reply-banner"
          style={{
            flexDirection: "row",
            alignItems: "center",
            justifyContent: "space-between",
            paddingHorizontal: spacing.md,
            paddingVertical: spacing.xs,
            backgroundColor: colors.surface,
          }}
        >
          <Text numberOfLines={1} style={{ color: colors.textSecondary, flex: 1 }}>
            Replying to: {replyTarget.preview}
          </Text>
          <Pressable testID="reply-cancel" onPress={() => setReplyTarget(null)}>
            <Text style={{ color: colors.accent, marginLeft: spacing.sm }}>Cancel</Text>
          </Pressable>
        </View>
      ) : null}

      {editingId ? (
        <View
          testID="edit-banner"
          style={{
            flexDirection: "row",
            alignItems: "center",
            justifyContent: "space-between",
            paddingHorizontal: spacing.md,
            paddingVertical: spacing.xs,
            backgroundColor: colors.surface,
          }}
        >
          <Text style={{ color: colors.textSecondary }}>Editing message</Text>
          <Pressable
            testID="edit-cancel"
            onPress={() => {
              setEditingId(null);
              setDraft("");
            }}
          >
            <Text style={{ color: colors.accent, marginLeft: spacing.sm }}>Cancel</Text>
          </Pressable>
        </View>
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
          onChangeText={handleDraftChange}
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
          <Text style={{ color: colors.accentInk, fontWeight: "700" }}>{editingId ? "Save" : "Send"}</Text>
        </Pressable>
      </View>
    </KeyboardAvoidingView>
  );
}
