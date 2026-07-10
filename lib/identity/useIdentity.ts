import { create } from "zustand";
import { signInAnonymously, signOut, type User } from "firebase/auth";
import { doc, getDoc, setDoc, updateDoc, serverTimestamp } from "firebase/firestore";
import { auth, db } from "../firebase/config";
import { generateDisplayId, generateAvatarSeed } from "./generators";

export type IdentityStatus = "bootstrapping" | "needs-identity" | "ready";

type IdentityState = {
  status: IdentityStatus;
  uid: string | null;
  displayId: string | null;
  avatarSeed: string | null;
  draftDisplayId: string;
  draftAvatarSeed: string;
  error: string | null;
  shuffleDraft: () => void;
  bootstrap: () => Promise<void>;
  confirmIdentity: () => Promise<void>;
  resetIdentity: () => Promise<void>;
};

export const useIdentity = create<IdentityState>((set, get) => ({
  status: "bootstrapping",
  uid: null,
  displayId: null,
  avatarSeed: null,
  draftDisplayId: generateDisplayId(),
  draftAvatarSeed: generateAvatarSeed(),
  error: null,

  shuffleDraft: () => {
    set({
      draftDisplayId: generateDisplayId(),
      draftAvatarSeed: generateAvatarSeed(),
    });
  },

  bootstrap: async () => {
    set({ error: null });
    try {
      let user: User | null = auth.currentUser;
      if (!user) {
        const credential = await signInAnonymously(auth);
        user = credential.user;
      }

      const userDocRef = doc(db, "users", user.uid);
      const userDocSnap = await getDoc(userDocRef);

      if (userDocSnap.exists()) {
        const data = userDocSnap.data() as { displayId: string; avatarSeed: string };
        set({
          status: "ready",
          uid: user.uid,
          displayId: data.displayId,
          avatarSeed: data.avatarSeed,
        });
      } else {
        set({ status: "needs-identity", uid: user.uid });
      }
    } catch (err) {
      set({
        error: err instanceof Error ? err.message : "Couldn't connect. Check your connection and try again.",
      });
    }
  },

  confirmIdentity: async () => {
    const { uid, draftDisplayId, draftAvatarSeed } = get();
    if (!uid) {
      throw new Error("confirmIdentity called before bootstrap resolved a uid");
    }
    set({ error: null });
    try {
      const userDocRef = doc(db, "users", uid);
      await setDoc(userDocRef, {
        displayId: draftDisplayId,
        avatarSeed: draftAvatarSeed,
        createdAt: serverTimestamp(),
        lastSeen: serverTimestamp(),
        online: true,
      });
      set({
        status: "ready",
        displayId: draftDisplayId,
        avatarSeed: draftAvatarSeed,
      });
    } catch (err) {
      set({
        error: err instanceof Error ? err.message : "Couldn't save your identity. Try again.",
      });
      throw err;
    }
  },

  // "Delete local identity": there's no account to delete server-side for
  // an anonymous user, so this signs out (dropping the persisted session)
  // and immediately bootstraps a brand-new one. The old uid's Firestore
  // data (chats, messages) is simply orphaned — acceptable at 10-user
  // friend-group scale, matches the "no accounts" design.
  resetIdentity: async () => {
    // Mark presence offline while still authenticated as the outgoing
    // identity — usePresence's own unmount cleanup races with the new
    // signInAnonymously() below and, once that resolves, is no longer
    // permitted to write the old uid's doc (rules require request.auth.uid
    // to match), leaving the abandoned identity stuck showing "Online".
    const outgoingUid = get().uid;
    if (outgoingUid) {
      await updateDoc(doc(db, "users", outgoingUid), { online: false, lastSeen: serverTimestamp() }).catch(() => {});
    }
    await signOut(auth);
    set({
      status: "bootstrapping",
      uid: null,
      displayId: null,
      avatarSeed: null,
      draftDisplayId: generateDisplayId(),
      draftAvatarSeed: generateAvatarSeed(),
      error: null,
    });
    await get().bootstrap();
  },
}));
