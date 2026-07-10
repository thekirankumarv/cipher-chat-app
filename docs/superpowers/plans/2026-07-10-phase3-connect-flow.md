# Phase 3 — Connect Flow Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development or superpowers:executing-plans. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Let two users connect: generate/share an invite code + QR, scan or type a code to redeem it, creating a `chats` doc with both participants.

**Architecture:** `lib/invite/inviteCode.ts` (pure code generator) + `lib/invite/useInvite.ts` (Firestore-backed `createInvite`/`redeemInvite`, mirrors Phase 2's `useIdentity` pattern). `app/connect.tsx` gets 3 tabs (My Code / Scan QR / Enter Code). Home gets a button to open Connect.

**Tech Stack:** `react-native-qrcode-svg` (render), `expo-camera` (`CameraView` + `onBarcodeScanned`, scan), Zustand-free plain store module (same shape as `useIdentity`).

## Global Constraints

- Same as Phase 1/2: npm; root-level `app/`/`components/`/`lib/`; `react`/`react-test-renderer` pinned `19.2.3`; `npx tsc --noEmit` must exit 0; `render()` is async; test files outside `app/`.
- Data model (design spec): `invites/{inviteCode}` = `{createdBy, createdAt, expiresAt, used}`; `chats/{chatId}` = `{participants, lastMessage, lastMessageAt, unreadCount}`.
- Reuse `useTheme()`/`spacing`/`typeScale`/`radii`, `useIdentity` for the current `uid`.
- **Verification for this phase = launch the app in the browser and click through it**, in addition to jest/tsc. Camera scanning itself needs a real device — note that instead of trying to fake it in the web preview.

---

### Task 1: Invite code generator + Firestore invite/chat store

**Files:**
- Create: `lib/invite/inviteCode.ts`, `lib/invite/inviteCode.test.ts`
- Create: `lib/invite/useInvite.ts`, `lib/invite/useInvite.test.ts`

**Interfaces:**
- Consumes: `auth`, `db` from `lib/firebase/config.ts`.
- Produces:
```ts
export function generateInviteCode(): string; // "ABC-2H9K-7Q" shape: 3 groups of [A-HJ-NP-Z2-9] (no 0/O/1/I), lengths 3-4-2, joined by "-"
```
```ts
export type InviteError = "not-found" | "used" | "expired" | "self";
export const useInvite: {
  (selector: (s: InviteState) => any): any;
  getState(): InviteState;
};
type InviteState = {
  createInvite: () => Promise<string>; // returns the code, writes invites/{code}
  redeemInvite: (code: string) => Promise<string>; // returns chatId, throws InviteError message
};
```

- [ ] **Step 1: Write failing tests for the code generator**

`lib/invite/inviteCode.test.ts`:
```ts
import { generateInviteCode } from "./inviteCode";

describe("generateInviteCode", () => {
  it("matches the XXX-XXXX-XX shape using only unambiguous characters", () => {
    const code = generateInviteCode();
    expect(code).toMatch(/^[A-HJ-NP-Z2-9]{3}-[A-HJ-NP-Z2-9]{4}-[A-HJ-NP-Z2-9]{2}$/);
  });

  it("can produce different values across calls", () => {
    const codes = new Set(Array.from({ length: 20 }, () => generateInviteCode()));
    expect(codes.size).toBeGreaterThan(1);
  });
});
```

Run: `npx jest lib/invite/inviteCode.test.ts` — expect FAIL (`Cannot find module './inviteCode'`).

- [ ] **Step 2: Implement the generator**

`lib/invite/inviteCode.ts`:
```ts
const CHARS = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789"; // no 0/O/1/I

function randomGroup(length: number): string {
  let out = "";
  for (let i = 0; i < length; i++) {
    out += CHARS[Math.floor(Math.random() * CHARS.length)];
  }
  return out;
}

export function generateInviteCode(): string {
  return `${randomGroup(3)}-${randomGroup(4)}-${randomGroup(2)}`;
}
```

Run: `npx jest lib/invite/inviteCode.test.ts` — expect PASS, 2 tests.

- [ ] **Step 3: Write failing tests for the invite/chat store**

`lib/invite/useInvite.test.ts`:
```ts
import { act } from "@testing-library/react-native";

jest.mock("../firebase/config", () => ({ auth: { currentUser: { uid: "my-uid" } }, db: {} }));

jest.mock("firebase/firestore", () => ({
  doc: jest.fn((_db, col, id) => ({ id, col })),
  getDoc: jest.fn(),
  setDoc: jest.fn(),
  updateDoc: jest.fn(),
  collection: jest.fn(() => ({})),
  addDoc: jest.fn(),
  serverTimestamp: jest.fn(() => "mock-timestamp"),
  Timestamp: { now: jest.fn(() => ({ toMillis: () => 1000 })) },
}));

import { doc, getDoc, setDoc, updateDoc, addDoc } from "firebase/firestore";
import { useInvite } from "./useInvite";

describe("useInvite", () => {
  beforeEach(() => jest.clearAllMocks());

  it("createInvite writes an invites doc and returns the code", async () => {
    (setDoc as jest.Mock).mockResolvedValue(undefined);
    let code = "";
    await act(async () => {
      code = await useInvite.getState().createInvite();
    });
    expect(code).toMatch(/^[A-HJ-NP-Z2-9]{3}-[A-HJ-NP-Z2-9]{4}-[A-HJ-NP-Z2-9]{2}$/);
    expect(setDoc).toHaveBeenCalledTimes(1);
    const [ref, payload] = (setDoc as jest.Mock).mock.calls[0];
    expect(ref.col).toBe("invites");
    expect(ref.id).toBe(code);
    expect(payload.createdBy).toBe("my-uid");
    expect(payload.used).toBe(false);
  });

  it("redeemInvite throws not-found when the invite doc doesn't exist", async () => {
    (getDoc as jest.Mock).mockResolvedValue({ exists: () => false });
    await expect(useInvite.getState().redeemInvite("AAA-BBBB-CC")).rejects.toThrow("not-found");
  });

  it("redeemInvite throws used when the invite is already used", async () => {
    (getDoc as jest.Mock).mockResolvedValue({
      exists: () => true,
      data: () => ({ createdBy: "other-uid", used: true, expiresAt: { toMillis: () => Date.now() + 100000 } }),
    });
    await expect(useInvite.getState().redeemInvite("AAA-BBBB-CC")).rejects.toThrow("used");
  });

  it("redeemInvite throws expired when past expiresAt", async () => {
    (getDoc as jest.Mock).mockResolvedValue({
      exists: () => true,
      data: () => ({ createdBy: "other-uid", used: false, expiresAt: { toMillis: () => Date.now() - 1000 } }),
    });
    await expect(useInvite.getState().redeemInvite("AAA-BBBB-CC")).rejects.toThrow("expired");
  });

  it("redeemInvite throws self when the code was created by the same uid", async () => {
    (getDoc as jest.Mock).mockResolvedValue({
      exists: () => true,
      data: () => ({ createdBy: "my-uid", used: false, expiresAt: { toMillis: () => Date.now() + 100000 } }),
    });
    await expect(useInvite.getState().redeemInvite("AAA-BBBB-CC")).rejects.toThrow("self");
  });

  it("redeemInvite creates a chat, marks the invite used, and returns the chatId", async () => {
    (getDoc as jest.Mock).mockResolvedValue({
      exists: () => true,
      data: () => ({ createdBy: "other-uid", used: false, expiresAt: { toMillis: () => Date.now() + 100000 } }),
    });
    (addDoc as jest.Mock).mockResolvedValue({ id: "chat-123" });
    (updateDoc as jest.Mock).mockResolvedValue(undefined);

    let chatId = "";
    await act(async () => {
      chatId = await useInvite.getState().redeemInvite("AAA-BBBB-CC");
    });

    expect(chatId).toBe("chat-123");
    expect(addDoc).toHaveBeenCalledTimes(1);
    const [, payload] = (addDoc as jest.Mock).mock.calls[0];
    expect(payload.participants.sort()).toEqual(["my-uid", "other-uid"].sort());
    expect(updateDoc).toHaveBeenCalledTimes(1);
    const [, updatePayload] = (updateDoc as jest.Mock).mock.calls[0];
    expect(updatePayload.used).toBe(true);
  });
});
```

Run: `npx jest lib/invite/useInvite.test.ts` — expect FAIL (`Cannot find module './useInvite'`).

- [ ] **Step 4: Implement the invite/chat store**

`lib/invite/useInvite.ts`:
```ts
import { create } from "zustand";
import {
  doc,
  getDoc,
  setDoc,
  updateDoc,
  collection,
  addDoc,
  serverTimestamp,
  Timestamp,
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
      expiresAt: Timestamp.fromMillis(Date.now() + EXPIRY_MS),
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
```

- [ ] **Step 5: Add Timestamp import needed above and run tests**

Run: `npx jest lib/invite/inviteCode.test.ts lib/invite/useInvite.test.ts` — expect PASS, 8 tests total.
Run: `npx tsc --noEmit` — expect exit 0. (If `Timestamp.fromMillis` isn't typed on the mocked object shape, that's fine — this call only runs against the real `firebase/firestore` module at runtime, and the mock in the test replaces the whole module so its type shape doesn't need to match exactly; the mock only needs `Timestamp.now`, which is what the test file itself uses — the real `Timestamp.fromMillis` is a genuine `firebase/firestore` export.)

- [ ] **Step 6: Commit**

```bash
cd /Users/kiran/personal/cipher-chat-app
git add -A
git commit -m "Add invite code generator and Firestore invite/chat store"
```

---

### Task 2: Connect screen — My Code + Enter Code tabs, Home button

**Files:**
- Create: `components/QRCode.tsx`
- Modify: `app/connect.tsx` (replace `ScreenStub`)
- Modify: `app/home.tsx` (add a button to open `/connect`)
- Create: `__tests__/connect-screen.test.tsx`

**Interfaces:**
- Consumes: `useInvite` (Task 1), `useTheme`/`spacing`/`typeScale`/`radii`.
- Produces: nothing new for later tasks (Scan QR tab is added in Task 3; this task's tab UI must leave room for a third tab).

- [ ] **Step 1: Install the QR renderer**

```bash
cd /Users/kiran/personal/cipher-chat-app
npx expo install react-native-qrcode-svg
node -e "console.log(require('./node_modules/react/package.json').version, require('./node_modules/react-test-renderer/package.json').version)"
```
Expect both versions to print `19.2.3` (react-native-svg is already installed from Phase 2, `react-native-qrcode-svg` depends on it).

- [ ] **Step 2: `components/QRCode.tsx`**

```tsx
import QRCodeSVG from "react-native-qrcode-svg";

export function QRCode({ value, size = 200 }: { value: string; size?: number }) {
  return <QRCodeSVG value={value} size={size} testID="qr-code" />;
}
```

- [ ] **Step 3: Write the failing screen test**

`__tests__/connect-screen.test.tsx`:
```tsx
import React from "react";
import { render, fireEvent, waitFor } from "@testing-library/react-native";
import { ThemeProvider } from "../lib/theme/ThemeProvider";
import { useInvite } from "../lib/invite/useInvite";

const mockReplace = jest.fn();
jest.mock("expo-router", () => ({ useRouter: () => ({ replace: mockReplace }) }));
jest.mock("../lib/invite/useInvite", () => ({ useInvite: jest.fn() }));

import ConnectScreen from "../app/connect";

describe("ConnectScreen", () => {
  const mockCreateInvite = jest.fn().mockResolvedValue("ABC-2H9K-7Q");
  const mockRedeemInvite = jest.fn().mockResolvedValue("chat-123");

  beforeEach(() => {
    jest.clearAllMocks();
    mockCreateInvite.mockResolvedValue("ABC-2H9K-7Q");
    (useInvite as unknown as jest.Mock).mockImplementation((selector: any) =>
      selector({ createInvite: mockCreateInvite, redeemInvite: mockRedeemInvite })
    );
  });

  it("shows My Code tab by default and generates a code on mount", async () => {
    const { findByText } = await render(
      <ThemeProvider>
        <ConnectScreen />
      </ThemeProvider>
    );
    expect(await findByText("ABC-2H9K-7Q")).toBeTruthy();
    expect(mockCreateInvite).toHaveBeenCalledTimes(1);
  });

  it("switches to Enter Code tab and redeems a typed code", async () => {
    const { findByTestId, findByText } = await render(
      <ThemeProvider>
        <ConnectScreen />
      </ThemeProvider>
    );
    fireEvent.press(await findByTestId("tab-enter-code"));
    const input = await findByTestId("enter-code-input");
    fireEvent.changeText(input, "XYZ-1234-AB");
    fireEvent.press(await findByTestId("enter-code-submit"));
    await waitFor(() => expect(mockRedeemInvite).toHaveBeenCalledWith("XYZ-1234-AB"));
    expect(mockReplace).toHaveBeenCalledWith("/chat/chat-123");
  });

  it("shows a friendly error when the code is not found", async () => {
    mockRedeemInvite.mockRejectedValue(new Error("not-found"));
    const { findByTestId, findByText } = await render(
      <ThemeProvider>
        <ConnectScreen />
      </ThemeProvider>
    );
    fireEvent.press(await findByTestId("tab-enter-code"));
    fireEvent.changeText(await findByTestId("enter-code-input"), "XYZ-1234-AB");
    fireEvent.press(await findByTestId("enter-code-submit"));
    expect(await findByText("That code doesn't exist. Check it and try again.")).toBeTruthy();
  });
});
```

Run: `npx jest __tests__/connect-screen.test.tsx` — expect FAIL (`app/connect.tsx` still renders `ScreenStub`).

- [ ] **Step 4: Implement `app/connect.tsx`**

```tsx
import { useEffect, useState } from "react";
import { View, Text, Pressable, TextInput } from "react-native";
import { useRouter } from "expo-router";
import { useTheme } from "../lib/theme/ThemeProvider";
import { spacing, typeScale, radii } from "../lib/theme/tokens";
import { useInvite } from "../lib/invite/useInvite";
import { QRCode } from "../components/QRCode";

const REDEEM_ERROR_MESSAGES: Record<string, string> = {
  "not-found": "That code doesn't exist. Check it and try again.",
  used: "That code has already been used.",
  expired: "That code has expired. Ask for a new one.",
  self: "That's your own code — ask your friend for theirs.",
};

type Tab = "my-code" | "scan" | "enter-code";

export default function ConnectScreen() {
  const { colors } = useTheme();
  const router = useRouter();
  const createInvite = useInvite((state) => state.createInvite);
  const redeemInvite = useInvite((state) => state.redeemInvite);

  const [tab, setTab] = useState<Tab>("my-code");
  const [myCode, setMyCode] = useState<string | null>(null);
  const [enteredCode, setEnteredCode] = useState("");
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    createInvite().then(setMyCode);
  }, [createInvite]);

  const handleRedeem = async (code: string) => {
    setError(null);
    try {
      const chatId = await redeemInvite(code.trim());
      router.replace(`/chat/${chatId}`);
    } catch (err) {
      const key = err instanceof Error ? err.message : "";
      setError(REDEEM_ERROR_MESSAGES[key] ?? "Couldn't connect. Try again.");
    }
  };

  return (
    <View style={{ flex: 1, backgroundColor: colors.background, padding: spacing.lg }}>
      <View style={{ flexDirection: "row", marginBottom: spacing.xl, gap: spacing.sm }}>
        {(
          [
            ["my-code", "My Code"],
            ["scan", "Scan QR"],
            ["enter-code", "Enter Code"],
          ] as const
        ).map(([key, label]) => (
          <Pressable
            key={key}
            testID={`tab-${key}`}
            onPress={() => setTab(key)}
            style={{
              paddingVertical: spacing.sm,
              paddingHorizontal: spacing.md,
              borderRadius: radii.button,
              backgroundColor: tab === key ? colors.accent : colors.surface,
            }}
          >
            <Text style={{ color: tab === key ? colors.accentInk : colors.text }}>{label}</Text>
          </Pressable>
        ))}
      </View>

      {tab === "my-code" ? (
        <View style={{ alignItems: "center" }}>
          {myCode ? (
            <>
              <QRCode value={`cipher://connect/${myCode}`} />
              <Text
                style={{
                  color: colors.text,
                  fontSize: typeScale.header.fontSize,
                  fontWeight: typeScale.header.fontWeight,
                  marginTop: spacing.lg,
                }}
              >
                {myCode}
              </Text>
              <Text style={{ color: colors.textSecondary, marginTop: spacing.sm, textAlign: "center" }}>
                Share this code so a friend can connect with you
              </Text>
            </>
          ) : (
            <Text style={{ color: colors.textSecondary }}>Generating your code…</Text>
          )}
        </View>
      ) : null}

      {tab === "enter-code" ? (
        <View>
          <TextInput
            testID="enter-code-input"
            value={enteredCode}
            onChangeText={setEnteredCode}
            placeholder="ALC-7F2K-9Q"
            placeholderTextColor={colors.textTertiary}
            autoCapitalize="characters"
            style={{
              borderWidth: 1,
              borderColor: colors.border,
              borderRadius: radii.card,
              padding: spacing.md,
              color: colors.text,
              marginBottom: spacing.md,
            }}
          />
          <Pressable
            testID="enter-code-submit"
            onPress={() => handleRedeem(enteredCode)}
            style={{
              backgroundColor: colors.accent,
              borderRadius: radii.button,
              paddingVertical: spacing.md,
              alignItems: "center",
            }}
          >
            <Text style={{ color: colors.accentInk, fontWeight: "700" }}>Connect</Text>
          </Pressable>
          {error ? (
            <Text style={{ color: colors.danger, marginTop: spacing.md, textAlign: "center" }}>
              {error}
            </Text>
          ) : null}
        </View>
      ) : null}

      {tab === "scan" ? (
        <View style={{ alignItems: "center" }}>
          <Text style={{ color: colors.textSecondary }}>Scan QR is set up in the next task.</Text>
        </View>
      ) : null}
    </View>
  );
}
```

- [ ] **Step 5: Run the test, tsc**

Run: `npx jest __tests__/connect-screen.test.tsx` — expect PASS, 3 tests.
Run: `npx tsc --noEmit` — expect exit 0.

- [ ] **Step 6: Add a Connect button to Home**

Modify `app/home.tsx` — replace the `ScreenStub`-only body:
```tsx
import { View, Text, Pressable } from "react-native";
import { useRouter } from "expo-router";
import { useTheme } from "../lib/theme/ThemeProvider";
import { spacing, radii, typeScale } from "../lib/theme/tokens";

export default function HomeScreen() {
  const { colors } = useTheme();
  const router = useRouter();
  return (
    <View
      style={{
        flex: 1,
        backgroundColor: colors.background,
        alignItems: "center",
        justifyContent: "center",
        padding: spacing.lg,
      }}
    >
      <Text
        style={{
          color: colors.text,
          fontSize: typeScale.header.fontSize,
          fontWeight: typeScale.header.fontWeight,
          marginBottom: spacing.xl,
        }}
      >
        No connections yet
      </Text>
      <Pressable
        testID="connect-fab"
        onPress={() => router.push("/connect")}
        style={{
          backgroundColor: colors.accent,
          borderRadius: radii.button,
          paddingVertical: spacing.md,
          paddingHorizontal: spacing.xxl,
        }}
      >
        <Text style={{ color: colors.accentInk, fontWeight: "700" }}>Connect with someone</Text>
      </Pressable>
    </View>
  );
}
```
(The real chat list replaces "No connections yet" in Phase 4 — this task only needs a working link to `/connect`.)

- [ ] **Step 7: Verify and commit**

Run: `npx jest` (full suite) and `npx tsc --noEmit` — both must pass clean.
```bash
cd /Users/kiran/personal/cipher-chat-app
git add -A
git commit -m "Wire Connect screen My Code + Enter Code tabs, add Home connect button"
```

---

### Task 3: Scan QR tab (camera)

**Files:**
- Modify: `app/connect.tsx` (replace the `scan` tab placeholder)
- Modify: `app.json` (add `expo-camera` config plugin)

**Interfaces:**
- Consumes: `redeemInvite` (already wired in Task 2's `handleRedeem`).
- Produces: nothing further (leaf UI).

- [ ] **Step 1: Install expo-camera**

```bash
cd /Users/kiran/personal/cipher-chat-app
npx expo install expo-camera
```

- [ ] **Step 2: Add the config plugin**

In `app.json`, add to the `"plugins"` array (alongside `"expo-router"`, `"expo-splash-screen"`, `"expo-font"`):
```json
[
  "expo-camera",
  {
    "cameraPermission": "Allow Cipher to access your camera to scan a connect code."
  }
]
```

- [ ] **Step 3: Replace the scan tab**

In `app/connect.tsx`, add the import:
```tsx
import { CameraView, useCameraPermissions } from "expo-camera";
```
Add inside the component, alongside the other `useState`s:
```tsx
const [permission, requestPermission] = useCameraPermissions();
const [scanned, setScanned] = useState(false);
```
Replace the `{tab === "scan" ? (...) : null}` block with:
```tsx
{tab === "scan" ? (
  <View style={{ flex: 1, alignItems: "center", justifyContent: "center" }}>
    {!permission ? (
      <Text style={{ color: colors.textSecondary }}>Loading camera…</Text>
    ) : !permission.granted ? (
      <Pressable
        testID="camera-permission-button"
        onPress={requestPermission}
        style={{
          backgroundColor: colors.accent,
          borderRadius: radii.button,
          paddingVertical: spacing.md,
          paddingHorizontal: spacing.xxl,
        }}
      >
        <Text style={{ color: colors.accentInk, fontWeight: "700" }}>Allow camera access</Text>
      </Pressable>
    ) : (
      <CameraView
        testID="camera-view"
        style={{ width: "100%", height: 300, borderRadius: radii.card }}
        barcodeScannerSettings={{ barcodeTypes: ["qr"] }}
        onBarcodeScanned={
          scanned
            ? undefined
            : ({ data }) => {
                setScanned(true);
                const code = data.replace("cipher://connect/", "");
                handleRedeem(code).finally(() => setScanned(false));
              }
        }
      />
    )}
  </View>
) : null}
```

- [ ] **Step 4: Verify**

Run: `npx jest` (full suite — the existing connect-screen tests don't exercise the scan tab, so they should be unaffected) and `npx tsc --noEmit`. Both must pass clean.

- [ ] **Step 5: Commit**

```bash
cd /Users/kiran/personal/cipher-chat-app
git add -A
git commit -m "Add Scan QR tab using expo-camera barcode scanning"
```

---

### Task 4: Launch and click through (real verification)

No new files. This task is the completion gate — camera scanning can't be exercised from a browser preview, but everything else in this phase can and must be:

- [ ] Start the app (web) and, signed in as one identity: open Connect, confirm the My Code tab shows a real generated code + QR image.
- [ ] Switch to Enter Code, submit an obviously-invalid code (e.g. `ZZZ-0000-00`), confirm the "doesn't exist" error renders.
- [ ] Confirm tapping the Home screen's "Connect with someone" button opens `/connect`.
- [ ] Note in the final report: Scan QR requires a physical device with a camera to verify end-to-end; the code is implemented per `expo-camera`'s documented API but not device-tested in this pass.
- [ ] Run `npx jest` and `npx tsc --noEmit` one last time to confirm nothing regressed.
