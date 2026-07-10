import { ref, uploadBytesResumable, getDownloadURL } from "firebase/storage";
import { storage } from "../firebase/config";

export function uploadMedia(
  chatId: string,
  fileName: string,
  blob: Blob,
  onProgress?: (fraction: number) => void,
): Promise<string> {
  return new Promise((resolve, reject) => {
    const path = `chats/${chatId}/${Date.now()}-${fileName}`;
    const storageRef = ref(storage, path);
    const task = uploadBytesResumable(storageRef, blob);
    task.on(
      "state_changed",
      (snapshot) => {
        onProgress?.(snapshot.totalBytes ? snapshot.bytesTransferred / snapshot.totalBytes : 0);
      },
      reject,
      async () => {
        try {
          const url = await getDownloadURL(task.snapshot.ref);
          resolve(url);
        } catch (err) {
          reject(err);
        }
      },
    );
  });
}
