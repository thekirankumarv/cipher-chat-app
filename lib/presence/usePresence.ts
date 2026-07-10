import { useEffect } from "react";
import { doc, updateDoc, serverTimestamp } from "firebase/firestore";
import { db } from "../firebase/config";

const HEARTBEAT_MS = 25000;

function setOnline(uid: string, online: boolean) {
  updateDoc(doc(db, "users", uid), { online, lastSeen: serverTimestamp() }).catch(() => {});
}

// Firestore has no server-side disconnect hook (unlike Realtime Database),
// so presence here is a best-effort heartbeat: mark online on
// mount/foreground, refresh lastSeen periodically while visible, mark
// offline on tab hide/close. A crashed tab that never fires those events
// will show stale "Online" until the next heartbeat window — acceptable at
// 10-user scale.
export function usePresence(uid: string | null) {
  useEffect(() => {
    if (!uid) return;

    setOnline(uid, true);
    const heartbeat = setInterval(() => setOnline(uid, true), HEARTBEAT_MS);

    const handleVisibility = () => {
      if (typeof document === "undefined") return;
      setOnline(uid, document.visibilityState === "visible");
    };
    const handleUnload = () => setOnline(uid, false);

    const hasDocumentEvents = typeof document !== "undefined" && typeof document.addEventListener === "function";
    const hasWindowEvents = typeof window !== "undefined" && typeof window.addEventListener === "function";

    if (hasDocumentEvents) {
      document.addEventListener("visibilitychange", handleVisibility);
    }
    if (hasWindowEvents) {
      window.addEventListener("pagehide", handleUnload);
    }

    return () => {
      clearInterval(heartbeat);
      if (hasDocumentEvents) {
        document.removeEventListener("visibilitychange", handleVisibility);
      }
      if (hasWindowEvents) {
        window.removeEventListener("pagehide", handleUnload);
      }
      setOnline(uid, false);
    };
  }, [uid]);
}
