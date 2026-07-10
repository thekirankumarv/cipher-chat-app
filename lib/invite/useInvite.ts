import { create } from "zustand";
import {
  doc,
  getDoc,
  setDoc,
  updateDoc,
  collection,
  addDoc,
  serverTimestamp,
} from "firebase/firestore";
import { auth, db } from "../firebase/config";
import { generateInviteCode } from "./inviteCode";

type InviteState = {
  createInvite: () => Promise<string>;
  redeemInvite: (code: string) => Promise<string>;
};

const EXPIRY_MS = 24 * 60 * 60 * 1000;

export const useInvite = create<InviteState>(() => ({
  createInvite: async () => {
    const uid = auth.currentUser?.uid;
    if (!uid) {
      throw new Error("createInvite called before sign-in resolved a uid");
    }
    const code = generateInviteCode();
    await setDoc(doc(db, "invites", code), {
      createdBy: uid,
      createdAt: serverTimestamp(),
      // A plain JS Date is auto-converted to a Firestore Timestamp on write,
      // which is what redeemInvite reads back (via `.toMillis()`). This avoids
      // depending on `Timestamp.fromMillis`, which the test suite's
      // `firebase/firestore` mock intentionally omits (it only mocks
      // `Timestamp.now`, matching what the test file itself uses).
      expiresAt: new Date(Date.now() + EXPIRY_MS),
      used: false,
    });
    return code;
  },

  redeemInvite: async (code: string) => {
    const uid = auth.currentUser?.uid;
    if (!uid) {
      throw new Error("redeemInvite called before sign-in resolved a uid");
    }
    const inviteRef = doc(db, "invites", code);
    const snap = await getDoc(inviteRef);
    if (!snap.exists()) {
      throw new Error("not-found");
    }
    const invite = snap.data() as {
      createdBy: string;
      used: boolean;
      expiresAt: { toMillis: () => number };
    };
    if (invite.used) {
      throw new Error("used");
    }
    if (invite.expiresAt.toMillis() < Date.now()) {
      throw new Error("expired");
    }
    if (invite.createdBy === uid) {
      throw new Error("self");
    }

    const chatDoc = await addDoc(collection(db, "chats"), {
      participants: [invite.createdBy, uid],
      lastMessage: "",
      lastMessageAt: serverTimestamp(),
      unreadCount: { [invite.createdBy]: 0, [uid]: 0 },
    });
    await updateDoc(inviteRef, { used: true });
    return chatDoc.id;
  },
}));
