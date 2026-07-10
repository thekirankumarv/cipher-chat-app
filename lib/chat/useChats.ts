import { create } from "zustand";
import { collection, query, where, onSnapshot, doc, getDoc, updateDoc } from "firebase/firestore";
import { db } from "../firebase/config";

export type DisappearingDuration = "off" | "24h" | "7d";

export type ChatSummary = {
  id: string;
  otherUid: string;
  otherDisplayId: string;
  otherAvatarSeed: string;
  lastMessage: string;
  lastMessageAt: number | null;
  unreadCount: number;
  otherTyping: boolean;
  otherLastRead: number | null;
  disappearingDuration: DisappearingDuration;
};

type RawChat = {
  participants: string[];
  lastMessage: string;
  lastMessageAt: { toMillis: () => number } | null;
  unreadCount: Record<string, number>;
  typing?: Record<string, boolean>;
  lastRead?: Record<string, { toMillis: () => number }>;
  disappearingDuration?: DisappearingDuration;
};

type ChatsState = {
  chats: ChatSummary[];
  loading: boolean;
  subscribe: (uid: string) => () => void;
  setTyping: (chatId: string, uid: string, isTyping: boolean) => Promise<void>;
  setDisappearing: (chatId: string, duration: DisappearingDuration) => Promise<void>;
};

const userCache = new Map<string, { displayId: string; avatarSeed: string }>();

async function resolveUser(uid: string): Promise<{ displayId: string; avatarSeed: string }> {
  const cached = userCache.get(uid);
  if (cached) return cached;
  const snap = await getDoc(doc(db, "users", uid));
  const data = snap.data() as { displayId: string; avatarSeed: string } | undefined;
  const resolved = data ? { displayId: data.displayId, avatarSeed: data.avatarSeed } : { displayId: "Unknown", avatarSeed: uid };
  userCache.set(uid, resolved);
  return resolved;
}

export const useChats = create<ChatsState>(() => ({
  chats: [],
  loading: true,

  // No orderBy in the query: array-contains + orderBy on a different field
  // needs a composite index in Firestore. Sorting client-side avoids that
  // deploy step entirely, which is fine at 10-user chat-list scale.
  subscribe: (uid: string) => {
    const q = query(collection(db, "chats"), where("participants", "array-contains", uid));
    const unsubscribe = onSnapshot(q, async (snap) => {
      const raw = snap.docs.map((d) => ({ id: d.id, ...(d.data() as RawChat) }));
      const resolved = await Promise.all(
        raw.map(async (chat) => {
          const otherUid = chat.participants.find((p) => p !== uid) ?? "";
          const user = await resolveUser(otherUid);
          return {
            id: chat.id,
            otherUid,
            otherDisplayId: user.displayId,
            otherAvatarSeed: user.avatarSeed,
            lastMessage: chat.lastMessage,
            lastMessageAt: chat.lastMessageAt ? chat.lastMessageAt.toMillis() : null,
            unreadCount: chat.unreadCount?.[uid] ?? 0,
            otherTyping: chat.typing?.[otherUid] ?? false,
            otherLastRead: chat.lastRead?.[otherUid] ? chat.lastRead[otherUid].toMillis() : null,
            disappearingDuration: chat.disappearingDuration ?? "off",
          };
        }),
      );
      resolved.sort((a, b) => (b.lastMessageAt ?? 0) - (a.lastMessageAt ?? 0));
      useChats.setState({ chats: resolved, loading: false });
    });
    return unsubscribe;
  },

  setTyping: async (chatId, uid, isTyping) => {
    await updateDoc(doc(db, "chats", chatId), { [`typing.${uid}`]: isTyping }).catch(() => {});
  },

  setDisappearing: async (chatId, duration) => {
    await updateDoc(doc(db, "chats", chatId), { disappearingDuration: duration });
  },
}));
