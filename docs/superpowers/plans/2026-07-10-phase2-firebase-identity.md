# Phase 2 — Firebase Auth + Identity Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Wire up Firebase (Anonymous Auth + Firestore), generate a persistent anonymous identity (human-readable display ID + procedural avatar) on first launch, and let the user confirm/shuffle that identity before landing on Home — no email/phone/name/password ever collected.

**Architecture:** A single `lib/firebase/config.ts` module owns Firebase bootstrapping (app/auth/db instances) driven by `EXPO_PUBLIC_FIREBASE_*` env vars. Pure generator functions (`lib/identity/generators.ts`, `lib/avatar/generateBlob.ts`) produce the display ID, avatar seed, and avatar SVG geometry with no framework dependency, so they're trivially unit-tested. A Zustand store (`lib/identity/useIdentity.ts`) owns the identity lifecycle (`bootstrapping` → `needs-identity` → `ready`) and the Firestore read/write. `app/index.tsx` (Welcome) and `app/create-identity.tsx` consume that store and replace their Phase-1 stub bodies with real UI.

**Tech Stack:** `firebase` (modular JS SDK v9+, Auth + Firestore, no native config needed beyond the already-installed `@react-native-async-storage/async-storage`), `zustand`, `react-native-svg`, Jest + `@testing-library/react-native` (already set up).

## Global Constraints

- Package manager: npm. Repo root `/Users/kiran/personal/cipher-chat-app`, app code at root-level `app/`, `components/`, `lib/` (not `src/`).
- `react` and `react-test-renderer` must remain pinned to the exact same version (currently `19.2.3`) — do not let any install drift them apart.
- `npx tsc --noEmit` must exit 0 after every task.
- `@testing-library/react-native@14`'s `render()` is async — every test must `await render(...)` inside an `async` test callback.
- No email, phone number, name, or password collected anywhere — ever. Identity is a generated User ID + procedural avatar only.
- Firestore `users/{uid}` schema (from the design spec): `displayId: string`, `avatarSeed: string`, `createdAt: timestamp`, `lastSeen: timestamp`, `online: boolean`.
- Accent color `#5fb87a`, radii `button: 999`, spacing scale `xs4/sm8/md12/lg16/xl20/xxl24/xxxl32/xxxxl40` — reuse `lib/theme/tokens.ts` and `useTheme()` from `lib/theme/ThemeProvider.tsx`, do not hardcode new colors.
- Test files must not live inside `app/` (Expo Router reserves that directory for routes) — put new screen tests under `__tests__/`.

---

### Task 1: Firebase config module (env vars + app/auth/db bootstrap)

**Files:**
- Create: `.env.example`
- Modify: `.gitignore`
- Create: `lib/firebase/config.ts`
- Create: `lib/firebase/config.test.ts`
- Modify: `package.json` (deps)

**Interfaces:**
- Consumes: nothing new.
- Produces (for later tasks):
```ts
export const firebaseApp: import("firebase/app").FirebaseApp;
export const auth: import("firebase/auth").Auth;
export const db: import("firebase/firestore").Firestore;
```

- [ ] **Step 1: Install the Firebase JS SDK**

Run:
```bash
cd /Users/kiran/personal/cipher-chat-app
npm install firebase
```
Expected: exits 0, `package.json` dependencies include `firebase`. Then verify no version drift:
```bash
node -e "console.log(require('./node_modules/react/package.json').version, require('./node_modules/react-test-renderer/package.json').version)"
```
Expected: both print `19.2.3`.

- [ ] **Step 2: Ignore real env files, commit a placeholder example**

Modify `.gitignore` — add a line under the existing `# local env files` section (which currently only ignores `.env*.local`):
```
.env
```

Write `.env.example`:
```
EXPO_PUBLIC_FIREBASE_API_KEY=
EXPO_PUBLIC_FIREBASE_AUTH_DOMAIN=
EXPO_PUBLIC_FIREBASE_PROJECT_ID=
EXPO_PUBLIC_FIREBASE_STORAGE_BUCKET=
EXPO_PUBLIC_FIREBASE_MESSAGING_SENDER_ID=
EXPO_PUBLIC_FIREBASE_APP_ID=
```

- [ ] **Step 3: Write the failing test**

The real `firebase` package ships ESM builds that Jest's default `transformIgnorePatterns` won't parse, so this test mocks `firebase/app`, `firebase/auth`, and `firebase/firestore` entirely rather than letting Jest resolve the real SDK — this keeps the test scoped to verifying *our* config logic (env-var validation, correct wiring of app→auth/db) without fighting Firebase's module format.

Write `lib/firebase/config.test.ts`:
```ts
const REQUIRED_KEYS = [
  "EXPO_PUBLIC_FIREBASE_API_KEY",
  "EXPO_PUBLIC_FIREBASE_AUTH_DOMAIN",
  "EXPO_PUBLIC_FIREBASE_PROJECT_ID",
  "EXPO_PUBLIC_FIREBASE_STORAGE_BUCKET",
  "EXPO_PUBLIC_FIREBASE_MESSAGING_SENDER_ID",
  "EXPO_PUBLIC_FIREBASE_APP_ID",
];

const mockApp = { name: "mock-app" };
const mockAuth = { name: "mock-auth" };
const mockPersistence = { name: "mock-persistence" };
const mockDb = { name: "mock-db" };

jest.mock("firebase/app", () => ({
  initializeApp: jest.fn(() => mockApp),
  getApps: jest.fn(() => []),
  getApp: jest.fn(() => mockApp),
}));

jest.mock("firebase/auth", () => ({
  initializeAuth: jest.fn(() => mockAuth),
  getAuth: jest.fn(() => mockAuth),
  getReactNativePersistence: jest.fn(() => mockPersistence),
}));

jest.mock("firebase/firestore", () => ({
  getFirestore: jest.fn(() => mockDb),
}));

describe("firebase config", () => {
  beforeEach(() => {
    jest.resetModules();
    jest.clearAllMocks();
    REQUIRED_KEYS.forEach((key) => delete process.env[key]);
  });

  it("throws a clear error when env vars are missing", () => {
    expect(() => require("./config")).toThrow(/Missing Firebase config env vars/);
  });

  it("initializes app, auth, and db when env vars are present", () => {
    REQUIRED_KEYS.forEach((key) => {
      process.env[key] = `test-${key}`;
    });

    const { firebaseApp, auth, db } = require("./config");
    const { initializeApp } = require("firebase/app");
    const { initializeAuth } = require("firebase/auth");
    const { getFirestore } = require("firebase/firestore");

    expect(initializeApp).toHaveBeenCalledWith({
      apiKey: "test-EXPO_PUBLIC_FIREBASE_API_KEY",
      authDomain: "test-EXPO_PUBLIC_FIREBASE_AUTH_DOMAIN",
      projectId: "test-EXPO_PUBLIC_FIREBASE_PROJECT_ID",
      storageBucket: "test-EXPO_PUBLIC_FIREBASE_STORAGE_BUCKET",
      messagingSenderId: "test-EXPO_PUBLIC_FIREBASE_MESSAGING_SENDER_ID",
      appId: "test-EXPO_PUBLIC_FIREBASE_APP_ID",
    });
    expect(initializeAuth).toHaveBeenCalledWith(mockApp, { persistence: mockPersistence });
    expect(getFirestore).toHaveBeenCalledWith(mockApp);
    expect(firebaseApp).toBe(mockApp);
    expect(auth).toBe(mockAuth);
    expect(db).toBe(mockDb);
  });
});
```

- [ ] **Step 4: Run the test to verify it fails**

Run:
```bash
cd /Users/kiran/personal/cipher-chat-app && npx jest lib/firebase/config.test.ts
```
Expected: FAIL — `Cannot find module './config'`.

- [ ] **Step 5: Implement the Firebase config module**

Write `lib/firebase/config.ts`:
```ts
import {
  initializeApp,
  getApps,
  getApp,
  type FirebaseApp,
} from "firebase/app";
import {
  initializeAuth,
  getAuth,
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
```

- [ ] **Step 6: Run the test to verify it passes**

Run:
```bash
cd /Users/kiran/personal/cipher-chat-app && npx jest lib/firebase/config.test.ts
```
Expected: PASS, 2 tests passed.

- [ ] **Step 7: Verify the whole project still type-checks**

Run:
```bash
cd /Users/kiran/personal/cipher-chat-app && npx tsc --noEmit
```
Expected: exits 0, no output.

- [ ] **Step 8: Commit**

```bash
cd /Users/kiran/personal/cipher-chat-app
git add -A
git commit -m "Add Firebase config module with env-var-driven app/auth/db bootstrap"
```

---

### Task 2: Identity generators (display ID + avatar seed)

**Files:**
- Create: `lib/identity/generators.ts`
- Create: `lib/identity/generators.test.ts`

**Interfaces:**
- Consumes: nothing.
- Produces (for later tasks):
```ts
export function generateDisplayId(): string;
export function generateAvatarSeed(): string;
```

- [ ] **Step 1: Write the failing tests**

Write `lib/identity/generators.test.ts`:
```ts
import { generateDisplayId, generateAvatarSeed } from "./generators";

describe("generateDisplayId", () => {
  it("returns an adjective-noun-number string", () => {
    const id = generateDisplayId();
    expect(id).toMatch(/^[a-z]+-[a-z]+-\d{1,2}$/);
  });

  it("can produce different values across calls", () => {
    const ids = new Set(Array.from({ length: 20 }, () => generateDisplayId()));
    expect(ids.size).toBeGreaterThan(1);
  });
});

describe("generateAvatarSeed", () => {
  it("returns a 16-character lowercase alphanumeric string", () => {
    const seed = generateAvatarSeed();
    expect(seed).toMatch(/^[a-z0-9]{16}$/);
  });

  it("can produce different values across calls", () => {
    const seeds = new Set(Array.from({ length: 20 }, () => generateAvatarSeed()));
    expect(seeds.size).toBeGreaterThan(1);
  });
});
```

- [ ] **Step 2: Run the tests to verify they fail**

Run:
```bash
cd /Users/kiran/personal/cipher-chat-app && npx jest lib/identity/generators.test.ts
```
Expected: FAIL — `Cannot find module './generators'`.

- [ ] **Step 3: Implement the generators**

Write `lib/identity/generators.ts`:
```ts
const ADJECTIVES = [
  "quiet",
  "amber",
  "pale",
  "dusk",
  "soft",
  "bright",
  "still",
  "faint",
  "warm",
  "cool",
  "gentle",
  "hazy",
] as const;

const NOUNS = [
  "falcon",
  "otter",
  "lynx",
  "heron",
  "comet",
  "willow",
  "cedar",
  "sparrow",
  "badger",
  "harbor",
  "meadow",
  "canyon",
] as const;

function randomFrom<T>(list: readonly T[]): T {
  return list[Math.floor(Math.random() * list.length)];
}

export function generateDisplayId(): string {
  const adjective = randomFrom(ADJECTIVES);
  const noun = randomFrom(NOUNS);
  const number = Math.floor(Math.random() * 99) + 1;
  return `${adjective}-${noun}-${number}`;
}

const SEED_CHARS = "abcdefghijklmnopqrstuvwxyz0123456789";

export function generateAvatarSeed(): string {
  let seed = "";
  for (let i = 0; i < 16; i++) {
    seed += SEED_CHARS[Math.floor(Math.random() * SEED_CHARS.length)];
  }
  return seed;
}
```

- [ ] **Step 4: Run the tests to verify they pass**

Run:
```bash
cd /Users/kiran/personal/cipher-chat-app && npx jest lib/identity/generators.test.ts
```
Expected: PASS, 4 tests passed.

- [ ] **Step 5: Commit**

```bash
cd /Users/kiran/personal/cipher-chat-app
git add -A
git commit -m "Add display-ID and avatar-seed generators"
```

---

### Task 3: Procedural avatar blob geometry (pure function)

**Files:**
- Create: `lib/avatar/generateBlob.ts`
- Create: `lib/avatar/generateBlob.test.ts`

**Interfaces:**
- Consumes: nothing.
- Produces (for later tasks):
```ts
export type BlobShape = { pathD: string; fillColor: string };
export function generateBlob(seed: string): BlobShape;
```

- [ ] **Step 1: Write the failing tests**

Write `lib/avatar/generateBlob.test.ts`:
```ts
import { generateBlob } from "./generateBlob";

describe("generateBlob", () => {
  it("is deterministic for the same seed", () => {
    expect(generateBlob("quiet-falcon-42")).toEqual(generateBlob("quiet-falcon-42"));
  });

  it("produces a different path for a different seed", () => {
    const a = generateBlob("quiet-falcon-42");
    const b = generateBlob("amber-otter-7");
    expect(a.pathD).not.toEqual(b.pathD);
  });

  it("returns a valid hsl() fill color", () => {
    const { fillColor } = generateBlob("quiet-falcon-42");
    expect(fillColor).toMatch(/^hsl\(\d{1,3}, 62%, 58%\)$/);
  });

  it("returns a closed SVG path", () => {
    const { pathD } = generateBlob("quiet-falcon-42");
    expect(pathD.startsWith("M ")).toBe(true);
    expect(pathD.endsWith("Z")).toBe(true);
  });
});
```

- [ ] **Step 2: Run the tests to verify they fail**

Run:
```bash
cd /Users/kiran/personal/cipher-chat-app && npx jest lib/avatar/generateBlob.test.ts
```
Expected: FAIL — `Cannot find module './generateBlob'`.

- [ ] **Step 3: Implement the blob generator**

Write `lib/avatar/generateBlob.ts`:
```ts
export type BlobShape = {
  pathD: string;
  fillColor: string;
};

function hashSeed(seed: string): number {
  let hash = 0;
  for (let i = 0; i < seed.length; i++) {
    hash = (hash * 31 + seed.charCodeAt(i)) >>> 0;
  }
  return hash;
}

function mulberry32(seed: number) {
  let a = seed;
  return function random() {
    a |= 0;
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

const POINTS = 8;
const SIZE = 100;
const CENTER = SIZE / 2;
const BASE_RADIUS = SIZE * 0.36;

export function generateBlob(seed: string): BlobShape {
  const hash = hashSeed(seed);
  const random = mulberry32(hash);

  const points: { x: number; y: number }[] = [];
  for (let i = 0; i < POINTS; i++) {
    const angle = (i / POINTS) * Math.PI * 2;
    const radius = BASE_RADIUS * (0.75 + random() * 0.5);
    points.push({
      x: CENTER + radius * Math.cos(angle),
      y: CENTER + radius * Math.sin(angle),
    });
  }

  let pathD = `M ${points[0].x.toFixed(2)} ${points[0].y.toFixed(2)} `;
  for (let i = 0; i < POINTS; i++) {
    const current = points[i];
    const next = points[(i + 1) % POINTS];
    const midX = ((current.x + next.x) / 2).toFixed(2);
    const midY = ((current.y + next.y) / 2).toFixed(2);
    pathD += `Q ${current.x.toFixed(2)} ${current.y.toFixed(2)} ${midX} ${midY} `;
  }
  pathD += "Z";

  const hue = hash % 360;
  const fillColor = `hsl(${hue}, 62%, 58%)`;

  return { pathD, fillColor };
}
```

- [ ] **Step 4: Run the tests to verify they pass**

Run:
```bash
cd /Users/kiran/personal/cipher-chat-app && npx jest lib/avatar/generateBlob.test.ts
```
Expected: PASS, 4 tests passed.

- [ ] **Step 5: Commit**

```bash
cd /Users/kiran/personal/cipher-chat-app
git add -A
git commit -m "Add seeded procedural blob geometry generator for avatars"
```

---

### Task 4: Avatar component

**Files:**
- Create: `components/Avatar.tsx`
- Create: `components/Avatar.test.tsx`
- Modify: `package.json` (deps)

**Interfaces:**
- Consumes: `generateBlob(seed: string): BlobShape` from `lib/avatar/generateBlob.ts` (Task 3).
- Produces (for later tasks):
```ts
export function Avatar(props: { seed: string; size?: number }): JSX.Element;
```

- [ ] **Step 1: Install react-native-svg**

Run:
```bash
cd /Users/kiran/personal/cipher-chat-app
npx expo install react-native-svg
```
Expected: exits 0, `package.json` dependencies include `react-native-svg`. Then verify no version drift:
```bash
node -e "console.log(require('./node_modules/react/package.json').version, require('./node_modules/react-test-renderer/package.json').version)"
```
Expected: both print `19.2.3`.

- [ ] **Step 2: Write the failing test**

Write `components/Avatar.test.tsx`:
`react-native-svg`'s `Path` component runs `fill` through React Native's own `processColor` before exposing it as a rendered prop (its `extractBrush` internals wrap it as `{ type: 0, payload: <packed ARGB int> }`), so the test compares against that processed form via the same `processColor` function rather than the raw CSS string — this still ties the assertion back to `expected.fillColor`, it just accounts for the real library's real behavior instead of mocking it away.

```tsx
import React from "react";
import { render } from "@testing-library/react-native";
import { processColor } from "react-native";
import { generateBlob } from "../lib/avatar/generateBlob";
import { Avatar } from "./Avatar";

describe("Avatar", () => {
  it("renders an SVG path matching the seed's generated blob", async () => {
    const seed = "quiet-falcon-42";
    const expected = generateBlob(seed);
    const { findByTestId } = await render(<Avatar seed={seed} />);
    const path = await findByTestId("avatar-path");
    expect(path.props.d).toBe(expected.pathD);
    expect(path.props.fill).toEqual({
      type: 0,
      payload: processColor(expected.fillColor),
    });
  });
});
```

- [ ] **Step 3: Run the test to verify it fails**

Run:
```bash
cd /Users/kiran/personal/cipher-chat-app && npx jest components/Avatar.test.tsx
```
Expected: FAIL — `Cannot find module './Avatar'`.

- [ ] **Step 4: Implement the Avatar component**

Write `components/Avatar.tsx`:
```tsx
import Svg, { Path } from "react-native-svg";
import { generateBlob } from "../lib/avatar/generateBlob";

export function Avatar({ seed, size = 48 }: { seed: string; size?: number }) {
  const { pathD, fillColor } = generateBlob(seed);
  return (
    <Svg width={size} height={size} viewBox="0 0 100 100">
      <Path testID="avatar-path" d={pathD} fill={fillColor} />
    </Svg>
  );
}
```

- [ ] **Step 5: Run the test to verify it passes**

Run:
```bash
cd /Users/kiran/personal/cipher-chat-app && npx jest components/Avatar.test.tsx
```
Expected: PASS, 1 test passed.

- [ ] **Step 6: Verify the whole project still type-checks**

Run:
```bash
cd /Users/kiran/personal/cipher-chat-app && npx tsc --noEmit
```
Expected: exits 0, no output.

- [ ] **Step 7: Commit**

```bash
cd /Users/kiran/personal/cipher-chat-app
git add -A
git commit -m "Add Avatar component rendering the seeded blob as SVG"
```

---

### Task 5: Identity Zustand store (bootstrap, shuffle, confirm)

**Files:**
- Create: `lib/identity/useIdentity.ts`
- Create: `lib/identity/useIdentity.test.ts`
- Modify: `package.json` (deps)

**Interfaces:**
- Consumes: `auth`, `db` from `lib/firebase/config.ts` (Task 1); `generateDisplayId`, `generateAvatarSeed` from `lib/identity/generators.ts` (Task 2).
- Produces (for later tasks):
```ts
export type IdentityStatus = "bootstrapping" | "needs-identity" | "ready";

export const useIdentity: {
  (selector: (state: IdentityState) => any): any;
  getState(): IdentityState;
  setState(partial: Partial<IdentityState>): void;
};

type IdentityState = {
  status: IdentityStatus;
  uid: string | null;
  displayId: string | null;
  avatarSeed: string | null;
  draftDisplayId: string;
  draftAvatarSeed: string;
  shuffleDraft: () => void;
  bootstrap: () => Promise<void>;
  confirmIdentity: () => Promise<void>;
};
```

- [ ] **Step 1: Install Zustand**

Run:
```bash
cd /Users/kiran/personal/cipher-chat-app
npm install zustand
```
Expected: exits 0, `package.json` dependencies include `zustand`. Then verify no version drift:
```bash
node -e "console.log(require('./node_modules/react/package.json').version, require('./node_modules/react-test-renderer/package.json').version)"
```
Expected: both print `19.2.3`.

- [ ] **Step 2: Write the failing tests**

Write `lib/identity/useIdentity.test.ts`:
```ts
import { act } from "@testing-library/react-native";

jest.mock("../firebase/config", () => ({
  auth: { currentUser: null },
  db: {},
}));

jest.mock("firebase/auth", () => ({
  signInAnonymously: jest.fn(),
}));

jest.mock("firebase/firestore", () => ({
  doc: jest.fn(() => ({ id: "mock-doc-ref" })),
  getDoc: jest.fn(),
  setDoc: jest.fn(),
  serverTimestamp: jest.fn(() => "mock-timestamp"),
}));

import { signInAnonymously } from "firebase/auth";
import { getDoc, setDoc } from "firebase/firestore";
import { useIdentity } from "./useIdentity";

describe("useIdentity", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    useIdentity.setState({
      status: "bootstrapping",
      uid: null,
      displayId: null,
      avatarSeed: null,
      draftDisplayId: "quiet-falcon-42",
      draftAvatarSeed: "seedseedseed1234",
    });
  });

  it("shuffleDraft replaces both draft values", () => {
    const before = useIdentity.getState();
    act(() => {
      useIdentity.getState().shuffleDraft();
    });
    const after = useIdentity.getState();
    expect(after.draftDisplayId).not.toEqual(before.draftDisplayId);
    expect(after.draftAvatarSeed).not.toEqual(before.draftAvatarSeed);
  });

  it("bootstrap signs in anonymously and sets needs-identity when no user doc exists", async () => {
    (signInAnonymously as jest.Mock).mockResolvedValue({ user: { uid: "uid-1" } });
    (getDoc as jest.Mock).mockResolvedValue({ exists: () => false });

    await act(async () => {
      await useIdentity.getState().bootstrap();
    });

    expect(signInAnonymously).toHaveBeenCalledTimes(1);
    expect(useIdentity.getState().status).toBe("needs-identity");
    expect(useIdentity.getState().uid).toBe("uid-1");
  });

  it("bootstrap loads an existing identity and sets ready when a user doc exists", async () => {
    (signInAnonymously as jest.Mock).mockResolvedValue({ user: { uid: "uid-2" } });
    (getDoc as jest.Mock).mockResolvedValue({
      exists: () => true,
      data: () => ({ displayId: "amber-otter-7", avatarSeed: "existingseed0001" }),
    });

    await act(async () => {
      await useIdentity.getState().bootstrap();
    });

    const state = useIdentity.getState();
    expect(state.status).toBe("ready");
    expect(state.displayId).toBe("amber-otter-7");
    expect(state.avatarSeed).toBe("existingseed0001");
  });

  it("confirmIdentity writes the draft identity to Firestore and sets ready", async () => {
    useIdentity.setState({ uid: "uid-3" });

    await act(async () => {
      await useIdentity.getState().confirmIdentity();
    });

    expect(setDoc).toHaveBeenCalledTimes(1);
    const [, payload] = (setDoc as jest.Mock).mock.calls[0];
    expect(payload.displayId).toBe("quiet-falcon-42");
    expect(payload.avatarSeed).toBe("seedseedseed1234");
    const state = useIdentity.getState();
    expect(state.status).toBe("ready");
    expect(state.displayId).toBe("quiet-falcon-42");
  });

  it("confirmIdentity throws if called before a uid exists", async () => {
    useIdentity.setState({ uid: null });
    await expect(useIdentity.getState().confirmIdentity()).rejects.toThrow(
      "confirmIdentity called before bootstrap resolved a uid"
    );
  });
});
```

- [ ] **Step 3: Run the tests to verify they fail**

Run:
```bash
cd /Users/kiran/personal/cipher-chat-app && npx jest lib/identity/useIdentity.test.ts
```
Expected: FAIL — `Cannot find module './useIdentity'`.

- [ ] **Step 4: Implement the identity store**

Write `lib/identity/useIdentity.ts`:
```ts
import { create } from "zustand";
import { signInAnonymously, type User } from "firebase/auth";
import { doc, getDoc, setDoc, serverTimestamp } from "firebase/firestore";
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
  shuffleDraft: () => void;
  bootstrap: () => Promise<void>;
  confirmIdentity: () => Promise<void>;
};

export const useIdentity = create<IdentityState>((set, get) => ({
  status: "bootstrapping",
  uid: null,
  displayId: null,
  avatarSeed: null,
  draftDisplayId: generateDisplayId(),
  draftAvatarSeed: generateAvatarSeed(),

  shuffleDraft: () => {
    set({
      draftDisplayId: generateDisplayId(),
      draftAvatarSeed: generateAvatarSeed(),
    });
  },

  bootstrap: async () => {
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
  },

  confirmIdentity: async () => {
    const { uid, draftDisplayId, draftAvatarSeed } = get();
    if (!uid) {
      throw new Error("confirmIdentity called before bootstrap resolved a uid");
    }
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
  },
}));
```

- [ ] **Step 5: Run the tests to verify they pass**

Run:
```bash
cd /Users/kiran/personal/cipher-chat-app && npx jest lib/identity/useIdentity.test.ts
```
Expected: PASS, 5 tests passed.

- [ ] **Step 6: Verify the whole project still type-checks**

Run:
```bash
cd /Users/kiran/personal/cipher-chat-app && npx tsc --noEmit
```
Expected: exits 0, no output.

- [ ] **Step 7: Commit**

```bash
cd /Users/kiran/personal/cipher-chat-app
git add -A
git commit -m "Add identity Zustand store: bootstrap, shuffle draft, confirm"
```

---

### Task 6: Welcome screen (bootstrap gate + Get Started)

**Files:**
- Modify: `app/index.tsx`
- Create: `__tests__/welcome-screen.test.tsx`

**Interfaces:**
- Consumes: `useTheme()` (`lib/theme/ThemeProvider.tsx`), `spacing`/`typeScale`/`radii` (`lib/theme/tokens.ts`), `useIdentity` (`lib/identity/useIdentity.ts`, Task 5) — reads `state.status` and `state.bootstrap`.
- Produces: nothing new for later tasks (this is a leaf route).

- [ ] **Step 1: Write the failing tests**

Write `__tests__/welcome-screen.test.tsx`:
```tsx
import React from "react";
import { render, fireEvent } from "@testing-library/react-native";
import { ThemeProvider } from "../lib/theme/ThemeProvider";
import { useIdentity } from "../lib/identity/useIdentity";

const pushMock = jest.fn();

jest.mock("expo-router", () => ({
  Redirect: ({ href }: { href: string }) => {
    const { Text } = require("react-native");
    return <Text testID="redirect">{href}</Text>;
  },
  useRouter: () => ({ push: pushMock, replace: jest.fn() }),
}));

jest.mock("../lib/identity/useIdentity", () => ({
  useIdentity: jest.fn(),
}));

import WelcomeScreen from "../app/index";

describe("WelcomeScreen", () => {
  const bootstrapMock = jest.fn();

  beforeEach(() => {
    jest.clearAllMocks();
  });

  it("shows a loading state while bootstrapping", async () => {
    (useIdentity as unknown as jest.Mock).mockImplementation((selector: any) =>
      selector({ status: "bootstrapping", bootstrap: bootstrapMock })
    );
    const { findByText } = await render(
      <ThemeProvider>
        <WelcomeScreen />
      </ThemeProvider>
    );
    expect(await findByText("Loading…")).toBeTruthy();
    expect(bootstrapMock).toHaveBeenCalledTimes(1);
  });

  it("shows Get Started and navigates to create-identity when pressed", async () => {
    (useIdentity as unknown as jest.Mock).mockImplementation((selector: any) =>
      selector({ status: "needs-identity", bootstrap: bootstrapMock })
    );
    const { findByTestId } = await render(
      <ThemeProvider>
        <WelcomeScreen />
      </ThemeProvider>
    );
    const button = await findByTestId("get-started-button");
    fireEvent.press(button);
    expect(pushMock).toHaveBeenCalledWith("/create-identity");
  });

  it("redirects to /home when the identity is ready", async () => {
    (useIdentity as unknown as jest.Mock).mockImplementation((selector: any) =>
      selector({ status: "ready", bootstrap: bootstrapMock })
    );
    const { findByTestId } = await render(
      <ThemeProvider>
        <WelcomeScreen />
      </ThemeProvider>
    );
    expect(await findByTestId("redirect")).toBeTruthy();
  });
});
```

- [ ] **Step 2: Run the tests to verify they fail**

Run:
```bash
cd /Users/kiran/personal/cipher-chat-app && npx jest __tests__/welcome-screen.test.tsx
```
Expected: FAIL — `app/index.tsx` still renders the Phase-1 `ScreenStub` ("Welcome / Splash"), so `findByText("Loading…")` / `findByTestId("get-started-button")` / `findByTestId("redirect")` all time out and fail.

- [ ] **Step 3: Implement the Welcome screen**

Write `app/index.tsx`:
```tsx
import { useEffect } from "react";
import { View, Text, Pressable } from "react-native";
import { Redirect, useRouter } from "expo-router";
import { useTheme } from "../lib/theme/ThemeProvider";
import { spacing, typeScale, radii } from "../lib/theme/tokens";
import { useIdentity } from "../lib/identity/useIdentity";

export default function WelcomeScreen() {
  const { colors } = useTheme();
  const router = useRouter();
  const status = useIdentity((state) => state.status);
  const bootstrap = useIdentity((state) => state.bootstrap);

  useEffect(() => {
    bootstrap();
  }, [bootstrap]);

  if (status === "ready") {
    return <Redirect href="/home" />;
  }

  if (status === "needs-identity") {
    return (
      <View
        style={{
          flex: 1,
          alignItems: "center",
          justifyContent: "center",
          backgroundColor: colors.background,
          padding: spacing.lg,
        }}
      >
        <Text
          style={{
            color: colors.text,
            fontSize: typeScale.screenTitle.fontSize,
            fontWeight: typeScale.screenTitle.fontWeight,
            marginBottom: spacing.md,
          }}
        >
          Cipher
        </Text>
        <Text
          style={{
            color: colors.textSecondary,
            fontSize: typeScale.message.fontSize,
            textAlign: "center",
            marginBottom: spacing.xl,
          }}
        >
          Anonymous, private chat for up to 10 people. No number, no email — just you.
        </Text>
        <Pressable
          testID="get-started-button"
          onPress={() => router.push("/create-identity")}
          style={{
            backgroundColor: colors.accent,
            borderRadius: radii.button,
            paddingVertical: spacing.md,
            paddingHorizontal: spacing.xxl,
          }}
        >
          <Text style={{ color: colors.accentInk, fontWeight: "700" }}>Get started</Text>
        </Pressable>
      </View>
    );
  }

  return (
    <View
      style={{
        flex: 1,
        alignItems: "center",
        justifyContent: "center",
        backgroundColor: colors.background,
      }}
    >
      <Text style={{ color: colors.textSecondary }}>Loading…</Text>
    </View>
  );
}
```

- [ ] **Step 4: Run the tests to verify they pass**

Run:
```bash
cd /Users/kiran/personal/cipher-chat-app && npx jest __tests__/welcome-screen.test.tsx
```
Expected: PASS, 3 tests passed.

- [ ] **Step 5: Verify the whole project still type-checks**

Run:
```bash
cd /Users/kiran/personal/cipher-chat-app && npx tsc --noEmit
```
Expected: exits 0, no output.

- [ ] **Step 6: Commit**

```bash
cd /Users/kiran/personal/cipher-chat-app
git add -A
git commit -m "Wire Welcome screen to identity bootstrap gate"
```

---

### Task 7: Create Identity screen (shuffle + continue)

**Files:**
- Modify: `app/create-identity.tsx`
- Create: `__tests__/create-identity-screen.test.tsx`

**Interfaces:**
- Consumes: `useTheme()`, `spacing`/`typeScale`/`radii`, `useIdentity` (reads `draftDisplayId`, `draftAvatarSeed`, `shuffleDraft`, `confirmIdentity`), `Avatar` from `components/Avatar.tsx` (Task 4).
- Produces: nothing new for later tasks (leaf route).

- [ ] **Step 1: Write the failing tests**

Write `__tests__/create-identity-screen.test.tsx`:
```tsx
import React from "react";
import { render, fireEvent, waitFor } from "@testing-library/react-native";
import { ThemeProvider } from "../lib/theme/ThemeProvider";
import { useIdentity } from "../lib/identity/useIdentity";

const replaceMock = jest.fn();

jest.mock("expo-router", () => ({
  useRouter: () => ({ push: jest.fn(), replace: replaceMock }),
}));

jest.mock("../lib/identity/useIdentity", () => ({
  useIdentity: jest.fn(),
}));

import CreateIdentityScreen from "../app/create-identity";

describe("CreateIdentityScreen", () => {
  const shuffleDraftMock = jest.fn();
  const confirmIdentityMock = jest.fn().mockResolvedValue(undefined);

  const baseState = {
    draftDisplayId: "quiet-falcon-42",
    draftAvatarSeed: "seedseedseed1234",
    shuffleDraft: shuffleDraftMock,
    confirmIdentity: confirmIdentityMock,
  };

  beforeEach(() => {
    jest.clearAllMocks();
    confirmIdentityMock.mockResolvedValue(undefined);
    (useIdentity as unknown as jest.Mock).mockImplementation((selector: any) =>
      selector(baseState)
    );
  });

  it("shows the draft display ID", async () => {
    const { findByText } = await render(
      <ThemeProvider>
        <CreateIdentityScreen />
      </ThemeProvider>
    );
    expect(await findByText("quiet-falcon-42")).toBeTruthy();
  });

  it("calls shuffleDraft when the shuffle button is pressed", async () => {
    const { findByTestId } = await render(
      <ThemeProvider>
        <CreateIdentityScreen />
      </ThemeProvider>
    );
    fireEvent.press(await findByTestId("shuffle-button"));
    expect(shuffleDraftMock).toHaveBeenCalledTimes(1);
  });

  it("confirms the identity and navigates to /home when Continue is pressed", async () => {
    const { findByTestId } = await render(
      <ThemeProvider>
        <CreateIdentityScreen />
      </ThemeProvider>
    );
    fireEvent.press(await findByTestId("continue-button"));
    await waitFor(() => expect(confirmIdentityMock).toHaveBeenCalledTimes(1));
    expect(replaceMock).toHaveBeenCalledWith("/home");
  });
});
```

- [ ] **Step 2: Run the tests to verify they fail**

Run:
```bash
cd /Users/kiran/personal/cipher-chat-app && npx jest __tests__/create-identity-screen.test.tsx
```
Expected: FAIL — `app/create-identity.tsx` still renders the Phase-1 `ScreenStub` ("Create Identity"), so none of the queried testIDs/text exist.

- [ ] **Step 3: Implement the Create Identity screen**

Write `app/create-identity.tsx`:
```tsx
import { View, Text, Pressable } from "react-native";
import { useRouter } from "expo-router";
import { useTheme } from "../lib/theme/ThemeProvider";
import { spacing, typeScale, radii } from "../lib/theme/tokens";
import { useIdentity } from "../lib/identity/useIdentity";
import { Avatar } from "../components/Avatar";

export default function CreateIdentityScreen() {
  const { colors } = useTheme();
  const router = useRouter();
  const draftDisplayId = useIdentity((state) => state.draftDisplayId);
  const draftAvatarSeed = useIdentity((state) => state.draftAvatarSeed);
  const shuffleDraft = useIdentity((state) => state.shuffleDraft);
  const confirmIdentity = useIdentity((state) => state.confirmIdentity);

  const handleContinue = async () => {
    await confirmIdentity();
    router.replace("/home");
  };

  return (
    <View
      style={{
        flex: 1,
        alignItems: "center",
        justifyContent: "center",
        backgroundColor: colors.background,
        padding: spacing.lg,
      }}
    >
      <Text
        style={{
          color: colors.text,
          fontSize: typeScale.screenTitle.fontSize,
          fontWeight: typeScale.screenTitle.fontWeight,
          marginBottom: spacing.xl,
        }}
      >
        Create your identity
      </Text>
      <Avatar seed={draftAvatarSeed} size={96} />
      <Text
        style={{
          color: colors.text,
          fontSize: typeScale.chatName.fontSize,
          fontWeight: typeScale.chatName.fontWeight,
          marginTop: spacing.md,
        }}
      >
        {draftDisplayId}
      </Text>
      <Pressable testID="shuffle-button" onPress={shuffleDraft} style={{ marginTop: spacing.md }}>
        <Text style={{ color: colors.accent }}>Shuffle</Text>
      </Pressable>
      <Pressable
        testID="continue-button"
        onPress={handleContinue}
        style={{
          backgroundColor: colors.accent,
          borderRadius: radii.button,
          paddingVertical: spacing.md,
          paddingHorizontal: spacing.xxl,
          marginTop: spacing.xl,
        }}
      >
        <Text style={{ color: colors.accentInk, fontWeight: "700" }}>Continue</Text>
      </Pressable>
    </View>
  );
}
```

- [ ] **Step 4: Run the tests to verify they pass**

Run:
```bash
cd /Users/kiran/personal/cipher-chat-app && npx jest __tests__/create-identity-screen.test.tsx
```
Expected: PASS, 3 tests passed.

- [ ] **Step 5: Verify the whole project still type-checks**

Run:
```bash
cd /Users/kiran/personal/cipher-chat-app && npx tsc --noEmit
```
Expected: exits 0, no output.

- [ ] **Step 6: Commit**

```bash
cd /Users/kiran/personal/cipher-chat-app
git add -A
git commit -m "Wire Create Identity screen to shuffle/confirm identity store"
```

---

### Task 8: Firestore security rules, manual setup docs, full verification

**Files:**
- Create: `firestore.rules`
- Create: `docs/FIREBASE_SETUP.md`

**Interfaces:**
- Consumes: nothing (documentation + rules artifact only).
- Produces: nothing (final task of the phase).

- [ ] **Step 1: Write the Firestore security rules**

Write `firestore.rules`:
```
rules_version = '2';

service cloud.firestore {
  match /databases/{database}/documents {
    match /users/{uid} {
      allow read: if request.auth != null;
      allow write: if request.auth != null && request.auth.uid == uid;
    }

    match /invites/{inviteCode} {
      allow read: if request.auth != null;
      allow create: if request.auth != null && request.resource.data.createdBy == request.auth.uid;
      allow update: if request.auth != null;
    }

    match /chats/{chatId} {
      allow read, write: if request.auth != null && request.auth.uid in resource.data.participants;
      allow create: if request.auth != null && request.auth.uid in request.resource.data.participants;

      match /messages/{messageId} {
        allow read: if request.auth != null && request.auth.uid in get(/databases/$(database)/documents/chats/$(chatId)).data.participants;
        allow create: if request.auth != null && request.resource.data.senderId == request.auth.uid;
        allow update: if request.auth != null && resource.data.senderId == request.auth.uid;
      }
    }
  }
}
```

- [ ] **Step 2: Write the manual setup doc**

Write `docs/FIREBASE_SETUP.md`:
```markdown
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

## 6. Run the app

```bash
npm start
```

On first launch the app signs in anonymously, generates a display ID +
avatar, and lets you confirm or shuffle it before creating your
`users/{uid}` document in Firestore.
```

- [ ] **Step 3: Run the full test suite**

Run:
```bash
cd /Users/kiran/personal/cipher-chat-app && npx jest
```
Expected: PASS, all suites green (previous Phase 1 suites plus this phase's: config, generators, generateBlob, Avatar, useIdentity, welcome-screen, create-identity-screen).

- [ ] **Step 4: Type-check and bundle-check the whole app**

Run:
```bash
cd /Users/kiran/personal/cipher-chat-app
npx tsc --noEmit
```
Expected: exits 0, no output. (Skip `expo export --platform web` for this task — Task 1's env-var guard means the web export would fail without a real `.env`; that's expected until the user completes the manual Firebase setup above, not a regression to fix here.)

- [ ] **Step 5: Commit**

```bash
cd /Users/kiran/personal/cipher-chat-app
git add -A
git commit -m "Add Firestore security rules and Firebase manual setup guide"
```
