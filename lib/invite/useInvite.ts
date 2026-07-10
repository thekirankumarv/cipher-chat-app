import { create } from "zustand";
import { onAuthStateChanged } from "firebase/auth";
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

// auth.currentUser can be momentarily null right after a page load/reload —
// Firebase Auth restores the persisted session asynchronously. Waiting for
// onAuthStateChanged's first callback (which fires immediately with the
// current value once resolved) avoids a race where a signed-in user's first
// action after reload throws "before sign-in resolved a uid".
function resolveUid(): Promise<string> {
  return new Promise((resolve, reject) => {
    if (auth.currentUser) {
      resolve(auth.currentUser.uid);
      return;
    }
    let unsubscribe: (() => void) | undefined;
    unsubscribe = onAuthStateChanged(auth, (user) => {
      unsubscribe?.();
      if (user) {
        resolve(user.uid);
      } else {
        reject(new Error("not-signed-in"));
      }
    });
  });
}

export const useInvite = create<InviteState>(() => ({
  createInvite: async () => {
    const uid = await resolveUid();
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
    const uid = await resolveUid();
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
