import { create } from "zustand";
import {
  collection,
  query,
  orderBy,
  onSnapshot,
  addDoc,
  doc,
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
};

type MessagesState = {
  messages: Message[];
  loading: boolean;
  subscribe: (chatId: string) => () => void;
  sendMessage: (
    chatId: string,
    senderId: string,
    otherUid: string,
    text: string,
    replyTo?: ReplyPreview,
  ) => Promise<void>;
  sendMediaMessage: (
    chatId: string,
    senderId: string,
    otherUid: string,
    media: MediaPayload,
    replyTo?: ReplyPreview,
  ) => Promise<void>;
  editMessage: (chatId: string, messageId: string, text: string) => Promise<void>;
  deleteMessage: (chatId: string, messageId: string) => Promise<void>;
  markRead: (chatId: string, uid: string) => Promise<void>;
};

async function bumpChatSummary(chatId: string, otherUid: string, preview: string) {
  await updateDoc(doc(db, "chats", chatId), {
    lastMessage: preview,
    lastMessageAt: serverTimestamp(),
    [`unreadCount.${otherUid}`]: increment(1),
  });
}

export const useMessages = create<MessagesState>(() => ({
  messages: [],
  loading: true,

  subscribe: (chatId: string) => {
    useMessages.setState({ messages: [], loading: true });
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
        };
      });
      useMessages.setState({ messages, loading: false });
    });
    return unsubscribe;
  },

  sendMessage: async (chatId, senderId, otherUid, text, replyTo) => {
    const trimmed = text.trim();
    if (!trimmed) return;
    await addDoc(collection(db, "chats", chatId, "messages"), {
      senderId,
      type: "text",
      text: trimmed,
      createdAt: serverTimestamp(),
      ...(replyTo ? { replyTo } : {}),
    });
    await bumpChatSummary(chatId, otherUid, trimmed);
  },

  sendMediaMessage: async (chatId, senderId, otherUid, media, replyTo) => {
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
    });
  },
}));
