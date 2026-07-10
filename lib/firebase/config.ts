import {
  initializeApp,
  getApps,
  getApp,
  type FirebaseApp,
} from "firebase/app";
import {
  initializeAuth,
  getAuth,
  // @ts-expect-error -- upstream @firebase/auth package.json exports puts a bare
  // "types" condition before the "react-native" condition, so TS's
  // customConditions never reaches the .d.ts that declares this export
  // (getReactNativePersistence lives in @firebase/auth/dist/rn/index.rn.d.ts).
  // Runtime is unaffected: Metro resolves the "react-native" condition on
  // @firebase/auth directly and does export this function there.
  getReactNativePersistence,
  type Auth,
} from "firebase/auth";
import { getFirestore, type Firestore } from "firebase/firestore";
import ReactNativeAsyncStorage from "@react-native-async-storage/async-storage";

const REQUIRED_ENV_VARS = [
  "EXPO_PUBLIC_FIREBASE_API_KEY",
  "EXPO_PUBLIC_FIREBASE_AUTH_DOMAIN",
  "EXPO_PUBLIC_FIREBASE_PROJECT_ID",
  "EXPO_PUBLIC_FIREBASE_STORAGE_BUCKET",
  "EXPO_PUBLIC_FIREBASE_MESSAGING_SENDER_ID",
  "EXPO_PUBLIC_FIREBASE_APP_ID",
] as const;

function readFirebaseConfig() {
  const missing = REQUIRED_ENV_VARS.filter((key) => !process.env[key]);
  if (missing.length > 0) {
    throw new Error(
      `Missing Firebase config env vars: ${missing.join(
        ", "
      )}. Copy .env.example to .env and fill in your Firebase project's values.`
    );
  }
  return {
    apiKey: process.env.EXPO_PUBLIC_FIREBASE_API_KEY!,
    authDomain: process.env.EXPO_PUBLIC_FIREBASE_AUTH_DOMAIN!,
    projectId: process.env.EXPO_PUBLIC_FIREBASE_PROJECT_ID!,
    storageBucket: process.env.EXPO_PUBLIC_FIREBASE_STORAGE_BUCKET!,
    messagingSenderId: process.env.EXPO_PUBLIC_FIREBASE_MESSAGING_SENDER_ID!,
    appId: process.env.EXPO_PUBLIC_FIREBASE_APP_ID!,
  };
}

export const firebaseApp: FirebaseApp = getApps().length
  ? getApp()
  : initializeApp(readFirebaseConfig());

let authInstance: Auth;
try {
  authInstance = initializeAuth(firebaseApp, {
    persistence: getReactNativePersistence(ReactNativeAsyncStorage),
  });
} catch {
  authInstance = getAuth(firebaseApp);
}
export const auth: Auth = authInstance;

export const db: Firestore = getFirestore(firebaseApp);
