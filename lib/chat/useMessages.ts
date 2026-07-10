import { create } from "zustand";
import {
  collection,
  query,
  orderBy,
  onSnapshot,
  addDoc,
  doc,
  deleteDoc,
  updateDoc,
  serverTimestamp,
  increment,
} from "firebase/firestore";
import { db } from "../firebase/config";

export type MessageType = "text" | "image" | "video" | "file";

export type ReplyPreview = {
  messageId: string;
  senderId: string;
  preview: string;
};

export type Message = {
  id: string;
  senderId: string;
  type: MessageType;
  text: string;
  createdAt: number | null;
  mediaUrl?: string;
  mediaName?: string;
  mediaSize?: number;
  mediaMime?: string;
  edited?: boolean;
  deleted?: boolean;
  replyTo?: ReplyPreview;
  expiresAt?: number | null;
};

export type MediaPayload = {
  kind: "image" | "video" | "file";
  url: string;
  name: string;
  size: number;
  mime: string;
};

type RawMessage = {
  senderId: string;
  type?: MessageType;
  text?: string;
  createdAt: { toMillis: () => number } | null;
  mediaUrl?: string;
  mediaName?: string;
  mediaSize?: number;
  mediaMime?: string;
  edited?: boolean;
  deleted?: boolean;
  replyTo?: ReplyPreview;
  expiresAt?: number | null;
};

type MessagesState = {
  messages: Message[];
  loading: boolean;
  error: string | null;
  subscribe: (chatId: string) => () => void;
  sendMessage: (
    chatId: string,
    senderId: string,
    otherUid: string,
    text: string,
    replyTo?: ReplyPreview,
    expiresAt?: number,
  ) => Promise<void>;
  sendMediaMessage: (
    chatId: string,
    senderId: string,
    otherUid: string,
    media: MediaPayload,
    replyTo?: ReplyPreview,
    expiresAt?: number,
  ) => Promise<void>;
  editMessage: (chatId: string, messageId: string, text: string) => Promise<void>;
  deleteMessage: (chatId: string, messageId: string) => Promise<void>;
  markRead: (chatId: string, uid: string) => Promise<void>;
  pruneExpired: (chatId: string) => Promise<void>;
};

async function bumpChatSummary(chatId: string, otherUid: string, preview: string) {
  await updateDoc(doc(db, "chats", chatId), {
    lastMessage: preview,
    lastMessageAt: serverTimestamp(),
    [`unreadCount.${otherUid}`]: increment(1),
  });
}

export const useMessages = create<MessagesState>((_set, get) => ({
  messages: [],
  loading: true,
  error: null,

  subscribe: (chatId: string) => {
    useMessages.setState({ messages: [], loading: true, error: null });
    const q = query(collection(db, "chats", chatId, "messages"), orderBy("createdAt", "asc"));
    const unsubscribe = onSnapshot(q, (snap) => {
      const messages = snap.docs.map((d) => {
        const data = d.data() as RawMessage;
        return {
          id: d.id,
          senderId: data.senderId,
          type: data.type ?? "text",
          text: data.text ?? "",
          createdAt: data.createdAt ? data.createdAt.toMillis() : null,
          mediaUrl: data.mediaUrl,
          mediaName: data.mediaName,
          mediaSize: data.mediaSize,
          mediaMime: data.mediaMime,
          edited: data.edited,
          deleted: data.deleted,
          replyTo: data.replyTo,
          expiresAt: data.expiresAt ?? null,
        };
      });
      useMessages.setState({ messages, loading: false });
    }, () => {
      useMessages.setState({ loading: false, error: "not-found" });
    });
    return unsubscribe;
  },

  sendMessage: async (chatId, senderId, otherUid, text, replyTo, expiresAt) => {
    const trimmed = text.trim();
    if (!trimmed) return;
    await addDoc(collection(db, "chats", chatId, "messages"), {
      senderId,
      type: "text",
      text: trimmed,
      createdAt: serverTimestamp(),
      ...(replyTo ? { replyTo } : {}),
      ...(expiresAt ? { expiresAt } : {}),
    });
    await bumpChatSummary(chatId, otherUid, trimmed);
  },

  sendMediaMessage: async (chatId, senderId, otherUid, media, replyTo, expiresAt) => {
    await addDoc(collection(db, "chats", chatId, "messages"), {
      senderId,
      type: media.kind,
      text: "",
      mediaUrl: media.url,
      mediaName: media.name,
      mediaSize: media.size,
      mediaMime: media.mime,
      createdAt: serverTimestamp(),
      ...(replyTo ? { replyTo } : {}),
      ...(expiresAt ? { expiresAt } : {}),
    });
    const preview = media.kind === "image" ? "Photo" : media.kind === "video" ? "Video" : media.name;
    await bumpChatSummary(chatId, otherUid, preview);
  },

  editMessage: async (chatId, messageId, text) => {
    const trimmed = text.trim();
    if (!trimmed) return;
    await updateDoc(doc(db, "chats", chatId, "messages", messageId), {
      text: trimmed,
      edited: true,
    });
  },

  deleteMessage: async (chatId, messageId) => {
    await updateDoc(doc(db, "chats", chatId, "messages", messageId), {
      deleted: true,
      text: "",
      mediaUrl: null,
      mediaName: null,
    });
  },

  markRead: async (chatId, uid) => {
    await updateDoc(doc(db, "chats", chatId), {
      [`unreadCount.${uid}`]: 0,
      [`lastRead.${uid}`]: serverTimestamp(),
    });
  },

  // Client-side expiry filtering is what actually hides disappearing
  // messages (see ChatScreen); this just keeps Firestore from accumulating
  // expired docs forever. Best-effort — failures are silently ignored since
  // any participant's next visit will retry.
  pruneExpired: async (chatId) => {
    const now = Date.now();
    const expired = get().messages.filter((m) => m.expiresAt && m.expiresAt < now);
    await Promise.all(
      expired.map((m) => deleteDoc(doc(db, "chats", chatId, "messages", m.id)).catch(() => {})),
    );
  },
}));
