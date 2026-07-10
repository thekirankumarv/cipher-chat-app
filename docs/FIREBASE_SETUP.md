# Firebase setup (manual, one-time)

Phase 2 wires the app up to Firebase, but you need to create the actual
Firebase project yourself — this can't be done from the CLI without your
Google account.

## 1. Create the project

1. Go to https://console.firebase.google.com and create a new project
   (any name, e.g. "cipher-chat").
2. You do not need Google Analytics for this project — you can disable it.

## 2. Register a Web app

Even though this is an Expo/React Native app, the Firebase JS SDK used here
authenticates as a **Web app** in the Firebase console:

1. In your Firebase project, click the Web icon (`</>`) to add a Web app.
2. Give it any nickname (e.g. "cipher-app").
3. Firebase will show you a `firebaseConfig` object — copy each value into
   `.env` (create it by copying `.env.example`):

```
EXPO_PUBLIC_FIREBASE_API_KEY=<apiKey>
EXPO_PUBLIC_FIREBASE_AUTH_DOMAIN=<authDomain>
EXPO_PUBLIC_FIREBASE_PROJECT_ID=<projectId>
EXPO_PUBLIC_FIREBASE_STORAGE_BUCKET=<storageBucket>
EXPO_PUBLIC_FIREBASE_MESSAGING_SENDER_ID=<messagingSenderId>
EXPO_PUBLIC_FIREBASE_APP_ID=<appId>
```

`.env` is gitignored — never commit it.

## 3. Enable Anonymous Authentication

1. In the Firebase console, go to **Build → Authentication → Sign-in method**.
2. Enable **Anonymous**.

## 4. Create a Firestore database

1. Go to **Build → Firestore Database → Create database**.
2. Choose **Production mode** (the rules below lock it down; you don't need
   test mode).
3. Pick any region close to you.

## 5. Deploy the security rules

The rules that scope reads/writes to your own data are already written in
`firestore.rules` at the repo root. Deploy them either:

- **Via the console:** open **Firestore Database → Rules**, paste the
  contents of `firestore.rules`, and click Publish.
- **Via the CLI** (if you have `firebase-tools` installed and are logged
  in): `firebase deploy --only firestore:rules` (requires running
  `firebase init` once to link this repo to your project first).

## 6. Enable Storage (needed for Phase 5 media sharing)

1. Go to **Build → Storage → Get started**.
2. Pick the same region you used for Firestore, production mode.
3. Deploy `storage.rules` (repo root) the same way as step 5 — paste into
   **Storage → Rules** and Publish, or `firebase deploy --only storage`.

Without this, image/video/file sharing in chat will fail on send — text
messaging and everything from Phases 1-4 work regardless.

## 7. Run the app

```bash
npm start
```

On first launch the app signs in anonymously, generates a display ID +
avatar, and lets you confirm or shuffle it before creating your
`users/{uid}` document in Firestore.
