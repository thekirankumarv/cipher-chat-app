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

export type Message = {
  id: string;
  senderId: string;
  text: string;
  createdAt: number | null;
};

type RawMessage = {
  senderId: string;
  text: string;
  createdAt: { toMillis: () => number } | null;
};

type MessagesState = {
  messages: Message[];
  loading: boolean;
  subscribe: (chatId: string) => () => void;
  sendMessage: (chatId: string, senderId: string, otherUid: string, text: string) => Promise<void>;
  markRead: (chatId: string, uid: string) => Promise<void>;
};

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
          text: data.text,
          createdAt: data.createdAt ? data.createdAt.toMillis() : null,
        };
      });
      useMessages.setState({ messages, loading: false });
    });
    return unsubscribe;
  },

  sendMessage: async (chatId, senderId, otherUid, text) => {
    const trimmed = text.trim();
    if (!trimmed) return;
    await addDoc(collection(db, "chats", chatId, "messages"), {
      senderId,
      text: trimmed,
      createdAt: serverTimestamp(),
    });
    await updateDoc(doc(db, "chats", chatId), {
      lastMessage: trimmed,
      lastMessageAt: serverTimestamp(),
      [`unreadCount.${otherUid}`]: increment(1),
    });
  },

  markRead: async (chatId, uid) => {
    await updateDoc(doc(db, "chats", chatId), {
      [`unreadCount.${uid}`]: 0,
    });
  },
}));
