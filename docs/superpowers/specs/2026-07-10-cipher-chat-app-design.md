# Cipher — Private Anonymous Chat App — Design

## Overview
Anonymous 1:1 chat app for a closed friend group (max 10 users, not public-facing). Expo (React Native) + TypeScript. No email/phone/name/password ever collected. Identity = generated persistent User ID + procedural avatar.

Source specs: `claude-code-prompt.md` (product spec, feature checklist, phased build plan) and `Cipher Chat App.pdf` / `Cipher Chat App - Standalone.html` (visual mockup, 9 screens + design system).

## Stack decision
- **Expo SDK (latest), TypeScript, Expo Router** (file-based nav).
- **Firebase**: Anonymous Auth, Firestore, Storage.
  - Chosen over Supabase: Supabase's free tier pauses a project after 7 days of inactivity, which is a bad fit for a low-traffic 10-person friend app. Firebase's free (Spark) tier never pauses and its limits (50k reads/20k writes/20k deletes per day, 1GiB Firestore, 5GB Storage) comfortably cover 10 users.
- **State:** Zustand.
- **Styling:** NativeWind + a theme-tokens file for light/dark values.
- **Animation:** react-native-reanimated + Moti.
- **Avatars:** custom procedural blob/gem SVG (see below), rendered via `react-native-svg`.
- **QR:** `expo-camera` (scan), `react-native-qrcode-svg` (generate).
- **Deep linking:** Expo Linking, custom scheme `cipher://connect/{code}`.
- **Media:** `expo-image-picker`, `expo-document-picker`, `expo-av`, `expo-file-system`.
- **Notifications (later phase):** `expo-notifications` + Expo Push Service via a small Cloud Function.

## Data model (Firestore)
```
users/{uid}
  displayId: string        // human-readable generated User ID
  avatarSeed: string
  createdAt: timestamp
  lastSeen: timestamp
  online: boolean

invites/{inviteCode}
  createdBy: uid
  createdAt: timestamp
  expiresAt: timestamp
  used: boolean

chats/{chatId}
  participants: [uid1, uid2]
  lastMessage: string
  lastMessageAt: timestamp
  unreadCount: { [uid]: number }

chats/{chatId}/messages/{messageId}
  senderId: uid
  type: "text" | "image" | "video" | "pdf" | "file"
  content: string          // text body or storage URL
  replyTo: messageId | null
  edited: boolean
  deletedFor: [uid]        // soft delete
  status: "sent" | "delivered" | "read"
  createdAt: timestamp
  expiresAt: timestamp | null   // disappearing messages
```
Security rules: a user may read/write a `chats/{chatId}` doc only if their `uid` is in `participants`; may write a message only if `senderId == request.auth.uid`.

Note: original prompt doc's `users` schema also listed `avatarStyle` — dropped since avatars are now a single procedural blob style (no style variants), seed alone is sufficient.

## Visual design system (from mockup)
- Font: Plus Jakarta Sans. Scale — screen title 28/800, header 20/700, chat name 17/600, message 16/500, timestamp/meta 13/500.
- Radii: button 999 (pill), card 16, bubble 20.
- Spacing scale: 4, 8, 12, 16, 20, 24, 32, 40.
- Icons: 1.6px stroke line icons.
- Status ticks: single tick (sent) → double gray tick (delivered) → double accent-colored tick (read).
- Color tokens (dark/light, approximate from mockup — refine against source screenshots during Phase 1 build):
  - Accent: `#5fb87a` (green), accent-ink for text-on-accent.
  - Dark theme: background/surface/surface2 in the `#292c33` family, border subtle gray.
  - Light theme: background `#fff`, surface `#eceef2`.
  - Text: primary near-black/white, secondary `#666`/`#999` range, tertiary lighter.
  - Danger/destructive: `#ff8a80` (light-mode danger), `#5c2b2e`/`#2a1215` (dark-mode danger surface/text), used for "Delete local identity" / danger zone.
- Both themes ship at launch, instant switch, system-default option, no flash on load.

## Avatar approach
Procedural blob/gem SVG generated from `avatarSeed` (random string set at account creation, re-shufflable pre-connect):
- Seed deterministically drives: an organic rounded-polygon path (blob/gem silhouette) and a fill color (hue derived from seed hash).
- Store only `avatarSeed` in Firestore — the SVG is regenerated client-side from the seed, never stored as an image.
- Gender-neutral, abstract, no photo uploads — satisfies the non-negotiable constraint.

## Screens (9, both themes)
1. Welcome/Splash — logo, one-liner, "Get started".
2. Create Identity — generated ID + avatar, shuffle both, "Continue".
3. Home/Chat List — connections list, avatar/name/last-message/time/unread badge, FAB to connect.
4. Connect Sheet — tabs: My Code (QR + short code) / Scan QR / Enter Code.
5. Chat Screen — bubbles, reply strip, input bar, typing indicator, status ticks.
6. Media Viewer — full-screen image/video viewer.
7. Chat Info — connection since date, search-in-chat, disappearing-messages toggle, shared media grid, remove connection.
8. Settings — theme switcher (Light/Dark/System), disappearing-messages default, notifications, about, logout, danger zone (delete local identity).
9. In-chat Search — query, match count, jump-to-result list.

Bubble anatomy (from mockup): tail-corner on last bubble in a group, inline right-aligned timestamp, status tick, reply-preview strip, media caption (filename + size), italic "Edited" label before timestamp.

## Build plan (phased, confirm each before next — per original prompt doc)
1. **Scaffold** (this cycle's plan): Expo + TS + Expo Router + NativeWind + theme-tokens (light/dark) + nav skeleton with stub screens for all 9 screens above.
2. Firebase setup: Anonymous Auth, persistent AsyncStorage session, generated User ID + avatar creation flow.
3. Connect flow: QR generate/scan, invite links, invite codes, Firestore chat creation, expiry/used-code handling.
4. Chat list + real-time 1:1 text messaging.
5. Media sharing: image/video/PDF/file upload+download via Storage, progress, thumbnails.
6. Message actions: edit, delete (soft, per-user + "for everyone" if time allows), reply, copy, forward (phase 2 stretch).
7. Delivery/read receipts, unread badges, typing indicator, online/offline presence.
8. Disappearing messages: per-chat toggle (24h/7d/off), `expiresAt` + cleanup query.
9. Search (in-chat + global), pin messages (optional), chat info screen, settings screen, theme switcher, logout/reset identity.
10. Polish: animations, haptics, skeleton loaders, empty states, error handling.

Each phase gets its own implementation plan (via writing-plans) and is confirmed working before starting the next. This spec covers the whole app; only Phase 1 is planned in detail right now.

## Manual setup flagged per phase
Phase 2 onward will require: creating a Firebase project, enabling Anonymous Auth, adding Firestore/Storage, and adding config keys to the Expo app (`app.config.ts` / `.env`, gitignored). Flagged again when that phase's plan is written.

## Simplifications for small scale (10 users)
- No pagination/infinite-scroll complexity tuned for large datasets — simple query limits are enough.
- No horizontal scaling, no CDN, no queueing system for media — direct Storage upload/download.
- Presence/typing indicators via simple Firestore fields, not a dedicated realtime presence service.
- Push notifications deferred to a later phase and kept to a single small Cloud Function.
