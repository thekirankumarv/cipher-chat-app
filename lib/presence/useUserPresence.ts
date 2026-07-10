import { create } from "zustand";
import { doc, onSnapshot } from "firebase/firestore";
import { db } from "../firebase/config";

export type PresenceInfo = {
  online: boolean;
  lastSeen: number | null;
};

type RawUser = {
  online?: boolean;
  lastSeen?: { toMillis: () => number } | null;
};

type PresenceState = {
  byUid: Record<string, PresenceInfo>;
  subscribe: (uid: string) => () => void;
};

export const useUserPresence = create<PresenceState>((set, get) => ({
  byUid: {},
  subscribe: (uid: string) => {
    const unsubscribe = onSnapshot(doc(db, "users", uid), (snap) => {
      const data = snap.data() as RawUser | undefined;
      set({
        byUid: {
          ...get().byUid,
          [uid]: {
            online: data?.online ?? false,
            lastSeen: data?.lastSeen ? data.lastSeen.toMillis() : null,
          },
        },
      });
    }, () => {});
    return unsubscribe;
  },
}));

export function formatLastSeen(lastSeen: number | null): string {
  if (!lastSeen) return "Offline";
  const diffMs = Date.now() - lastSeen;
  const minutes = Math.floor(diffMs / 60000);
  if (minutes < 1) return "Last seen just now";
  if (minutes < 60) return `Last seen ${minutes}m ago`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `Last seen ${hours}h ago`;
  const days = Math.floor(hours / 24);
  return `Last seen ${days}d ago`;
}
