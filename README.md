# Cipher

Private, anonymous 1-to-1 chat for a closed friend group (max ~10 people).
No email, phone, name, or password ever collected — identity is a
generated User ID + procedural avatar, tied to an anonymous Firebase auth
session. Built with Expo (React Native + TypeScript) and Firebase
(Anonymous Auth + Firestore).

Features: connect via QR/shareable code, real-time messaging, typing
indicators, read receipts, presence (online/last seen), reply/edit/delete,
disappearing messages, in-chat search, light/dark theme, and full identity
reset.

## Setup

### 1. Create a Firebase project

1. Go to https://console.firebase.google.com and create a project (any
   name). You don't need Google Analytics.
2. Click the Web icon (`</>`) to register a **Web app** — the Firebase JS
   SDK authenticates as a Web app even though this is a mobile app.
3. Copy the `firebaseConfig` values Firebase shows you.

### 2. Configure env vars

```bash
cp .env.example .env
```

Fill in `.env` with the values from step 1:

```
EXPO_PUBLIC_FIREBASE_API_KEY=<apiKey>
EXPO_PUBLIC_FIREBASE_AUTH_DOMAIN=<authDomain>
EXPO_PUBLIC_FIREBASE_PROJECT_ID=<projectId>
EXPO_PUBLIC_FIREBASE_MESSAGING_SENDER_ID=<messagingSenderId>
EXPO_PUBLIC_FIREBASE_APP_ID=<appId>
```

`.env` is gitignored — never commit it.

### 3. Enable Anonymous Authentication

Firebase console → **Build → Authentication → Sign-in method** → enable
**Anonymous**.

### 4. Create a Firestore database

Firebase console → **Build → Firestore Database → Create database** →
**Production mode** → pick any region.

### 5. Deploy the security rules

Rules live in `firestore.rules` at the repo root. Deploy via the console
(**Firestore Database → Rules**, paste, Publish) or the CLI
(`firebase deploy --only firestore:rules`, requires `firebase init` once
to link this repo to your project).

**Re-deploy whenever `firestore.rules` changes** — the console-paste route
isn't automatic.

### 6. Install and run

```bash
npm install
npm start
```

On first launch the app signs in anonymously and generates a display ID +
avatar you can confirm or shuffle before it creates your `users/{uid}`
document.

## Testing

```bash
npx tsc --noEmit   # typecheck
npm test           # jest
```

## Using the app

- **Connect with someone:** tap **+ Connect** on Home, share your code/QR
  with a friend (out of band — text, in person, etc.), they enter it or
  scan it. Once both sides connect, a chat opens.
- **Chat:** tap a connection to open it. Long-press a message for
  reply/copy/edit/delete. Toggle disappearing messages (24h/7d) from the
  chat header.
- **Settings:** theme switch, reset identity (wipes your local session and
  generates a brand-new anonymous identity — irreversible, old chats
  become unreachable).

## Building an APK (Android)

This project uses [EAS Build](https://docs.expo.dev/build/introduction/),
Expo's cloud build service — no local Android SDK needed.

### 1. Install and log in

```bash
npm install -g eas-cli
eas login
```

(Free Expo account — sign up at https://expo.dev/signup if you don't have
one.)

### 2. Configure the build

```bash
eas build:configure
```

This creates `eas.json`. Add an APK-producing profile (AAB is the default,
but AAB can't be sideloaded — you want an APK for direct install):

```json
{
  "build": {
    "preview": {
      "android": {
        "buildType": "apk"
      }
    }
  }
}
```

### 3. Build

```bash
eas build -p android --profile preview
```

This uploads your project to Expo's build servers and returns a download
link (also viewable at https://expo.dev under your project) once done —
typically a few minutes.

### 4. Install on your phone

Download the `.apk` from the link EAS gives you, transfer it to an
Android device (or open the link directly on the phone), and install it.
You'll need to allow "install from unknown sources" for your browser/file
manager the first time.

Each friend in the group installs the same APK — since there's no app
store distribution, share the `.apk` file or the EAS download link
directly with them.

## Notes

- Text-only: no media/file sharing (Firebase Storage requires the Blaze
  billing plan; this project intentionally stays on Firebase's free Spark
  tier).
- Built for a closed group of ~10 people. No user discovery — you can only
  chat with someone you've explicitly connected with via a shared code.
