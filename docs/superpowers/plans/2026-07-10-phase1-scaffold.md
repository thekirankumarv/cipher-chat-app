# Phase 1 — Scaffold Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Stand up the Expo + TypeScript + Expo Router project skeleton with NativeWind, a light/dark theme-token system, and stub screens for all 9 mockup screens — no Firebase, no real data, just a working themed app shell.

**Architecture:** Expo Router file-based routing over a flat stack (no tabs). A `lib/theme` module owns color/spacing/radii/type-scale tokens and a `ThemeProvider`/`useTheme()` hook (light/dark/system, persisted via AsyncStorage, instant switch). Every screen is a thin route file rendering a shared `ScreenStub` component so the whole tree is themed from one place.

**Tech Stack:** Expo SDK (latest, via `create-expo-app@latest`), TypeScript, Expo Router, NativeWind v4 + Tailwind CSS, `@react-native-async-storage/async-storage`, `@expo-google-fonts/plus-jakarta-sans`, Jest (`jest-expo` preset) + `@testing-library/react-native`.

## Global Constraints

- Max 10 users, no email/phone/name/password ever — not relevant to this phase's files but do not add any auth/profile input fields to stub screens.
- Font: Plus Jakarta Sans. Type scale: screen title 28/800, header 20/700, chat name 17/600, message 16/500, meta 13/500.
- Radii: button 999, card 16, bubble 20.
- Spacing scale: 4, 8, 12, 16, 20, 24, 32, 40.
- Accent color `#5fb87a` in both themes.
- Both light and dark themes ship now, with a system-default option and instant switch (no flash).
- Package manager: npm (matches `create-expo-app` default lockfile).
- Repo root is `/Users/kiran/personal/cipher-chat-app` (git already initialized, `docs/superpowers/specs/2026-07-10-cipher-chat-app-design.md` already committed).

---

### Task 1: Scaffold Expo project and strip template boilerplate

**Files:**
- Create (via scaffold, then merge): `package.json`, `app.json`, `tsconfig.json`, `.gitignore`, `expo-env.d.ts`, `app/_layout.tsx`, `app/index.tsx`
- Delete: `app/(tabs)/`, `app/modal.tsx`, `app/+not-found.tsx`, `components/`, `constants/`, `hooks/`
- Modify: `app.json` (name/slug/scheme)

**Interfaces:**
- Consumes: nothing (first task).
- Produces: a booting Expo Router project with exactly two routes — `app/_layout.tsx` (bare `Stack`) and `app/index.tsx` (placeholder text `"Cipher"`) — for later tasks to build on.

- [ ] **Step 1: Scaffold into a temporary sibling directory**

Run:
```bash
cd /Users/kiran/personal && npx create-expo-app@latest cipher-scaffold-tmp
```
Expected: command exits 0, prints something like `✅ Your app is ready!`, and `cipher-scaffold-tmp/` contains `package.json`, `app/`, `app.json`, `tsconfig.json`, `node_modules/`.

- [ ] **Step 2: Merge scaffold into the project root, keep our existing git history**

Run:
```bash
cd /Users/kiran/personal
rsync -a --exclude='.git' cipher-scaffold-tmp/ cipher-chat-app/
rm -rf cipher-scaffold-tmp
```
Expected: `ls /Users/kiran/personal/cipher-chat-app` shows `package.json`, `app/`, `app.json`, `node_modules/`, plus the pre-existing `docs/` and `.git/`.

- [ ] **Step 3: Remove template example code that competes with our own theme system**

Run:
```bash
cd /Users/kiran/personal/cipher-chat-app
rm -rf "app/(tabs)" app/modal.tsx "app/+not-found.tsx" components constants hooks
```
Expected: those paths no longer exist; `app/_layout.tsx` and `app/index.tsx` still exist (will be overwritten next step).

- [ ] **Step 4: Replace root layout and index route with minimal placeholders**

Write `app/_layout.tsx`:
```tsx
import { Stack } from "expo-router";

export default function RootLayout() {
  return <Stack />;
}
```

Write `app/index.tsx`:
```tsx
import { Text } from "react-native";

export default function Index() {
  return <Text>Cipher</Text>;
}
```

- [ ] **Step 5: Set app identity**

In `app.json`, under `"expo"`, set:
```json
"name": "Cipher",
"slug": "cipher-chat-app",
"scheme": "cipher"
```
(Keep every other existing key as scaffolded.)

- [ ] **Step 6: Verify the project type-checks**

Run:
```bash
cd /Users/kiran/personal/cipher-chat-app && npx tsc --noEmit
```
Expected: exits 0, no output (no type errors).

- [ ] **Step 7: Commit**

```bash
cd /Users/kiran/personal/cipher-chat-app
git add -A
git commit -m "Scaffold Expo Router project, strip template boilerplate"
```

---

### Task 2: Wire up NativeWind + Tailwind CSS

**Files:**
- Modify: `package.json` (deps)
- Create: `tailwind.config.js`
- Create: `global.css`
- Create: `babel.config.js`
- Create: `metro.config.js`
- Create: `nativewind-env.d.ts`
- Modify: `app/_layout.tsx` (import `../global.css`)

**Interfaces:**
- Consumes: `app/_layout.tsx` from Task 1.
- Produces: `className` prop usable on any React Native component from Task 3 onward.

- [ ] **Step 1: Install NativeWind and Tailwind**

Run:
```bash
cd /Users/kiran/personal/cipher-chat-app
npx expo install nativewind tailwindcss
```
Expected: exits 0, `package.json` dependencies now include `nativewind` and `tailwindcss`. (`react-native-reanimated` and `Moti` are deferred to the phase that first uses animation — no need to install unused deps now.)

- [ ] **Step 2: Create Tailwind config**

Write `tailwind.config.js`:
```js
/** @type {import('tailwindcss').Config} */
module.exports = {
  content: ["./app/**/*.{js,jsx,ts,tsx}", "./components/**/*.{js,jsx,ts,tsx}"],
  presets: [require("nativewind/preset")],
  theme: {
    extend: {},
  },
  plugins: [],
};
```

- [ ] **Step 3: Create global CSS with Tailwind directives**

Write `global.css`:
```css
@tailwind base;
@tailwind components;
@tailwind utilities;
```

- [ ] **Step 4: Configure Babel for NativeWind**

Write `babel.config.js`:
```js
module.exports = function (api) {
  api.cache(true);
  return {
    presets: [
      ["babel-preset-expo", { jsxImportSource: "nativewind" }],
      "nativewind/babel",
    ],
  };
};
```

- [ ] **Step 5: Configure Metro for NativeWind**

Write `metro.config.js`:
```js
const { getDefaultConfig } = require("expo/metro-config");
const { withNativeWind } = require("nativewind/metro");

const config = getDefaultConfig(__dirname);

module.exports = withNativeWind(config, { input: "./global.css" });
```

- [ ] **Step 6: Add NativeWind TypeScript types**

Write `nativewind-env.d.ts`:
```ts
/// <reference types="nativewind/types" />
```

- [ ] **Step 7: Import global CSS in the root layout**

Modify `app/_layout.tsx`:
```tsx
import "../global.css";
import { Stack } from "expo-router";

export default function RootLayout() {
  return <Stack />;
}
```

- [ ] **Step 8: Verify the app bundles with NativeWind wired in**

Run:
```bash
cd /Users/kiran/personal/cipher-chat-app
npx expo export --platform web --output-dir /tmp/cipher-export-check
```
Expected: exits 0, prints a bundling success message, `/tmp/cipher-export-check` contains built output. Clean up after: `rm -rf /tmp/cipher-export-check`.

- [ ] **Step 9: Commit**

```bash
cd /Users/kiran/personal/cipher-chat-app
git add -A
git commit -m "Add NativeWind + Tailwind CSS wiring"
```

---

### Task 3: Jest setup + theme tokens module

**Files:**
- Modify: `package.json` (test script, `jest` config, devDependencies)
- Create: `lib/theme/tokens.ts`
- Create: `lib/theme/tokens.test.ts`

**Interfaces:**
- Consumes: nothing new.
- Produces (for later tasks):
```ts
export type ColorTokens = {
  background: string;
  surface: string;
  surface2: string;
  border: string;
  text: string;
  textSecondary: string;
  textTertiary: string;
  accent: string;
  accentInk: string;
  danger: string;
  dangerSurface: string;
};
export const colors: { light: ColorTokens; dark: ColorTokens };
export const spacing: { xs: 4; sm: 8; md: 12; lg: 16; xl: 20; xxl: 24; xxxl: 32; xxxxl: 40 };
export const radii: { button: 999; card: 16; bubble: 20 };
export const typeScale: {
  screenTitle: { fontSize: 28; fontWeight: "800" };
  header: { fontSize: 20; fontWeight: "700" };
  chatName: { fontSize: 17; fontWeight: "600" };
  message: { fontSize: 16; fontWeight: "500" };
  meta: { fontSize: 13; fontWeight: "500" };
};
```

- [ ] **Step 1: Install Jest dependencies**

Run:
```bash
cd /Users/kiran/personal/cipher-chat-app
npx expo install jest-expo jest @types/jest @testing-library/react-native react-test-renderer --dev
```
Expected: exits 0, `package.json` devDependencies include all five packages.

- [ ] **Step 2: Configure Jest in package.json**

Modify `package.json` — add a `test` script and a `jest` block (merge into existing file, don't remove other keys):
```json
"scripts": {
  "test": "jest --watchAll=false"
},
"jest": {
  "preset": "jest-expo",
  "transformIgnorePatterns": [
    "node_modules/(?!((jest-)?react-native|@react-native(-community)?)|expo(nent)?|@expo(nent)?/.*|@expo-google-fonts/.*|react-navigation|@react-navigation/.*|@sentry/react-native|native-base|react-native-svg)"
  ]
}
```

- [ ] **Step 3: Write the failing test for theme tokens**

Write `lib/theme/tokens.test.ts`:
```ts
import { colors, spacing, radii, typeScale } from "./tokens";

describe("theme tokens", () => {
  it("defines matching accent color in both themes", () => {
    expect(colors.light.accent).toBe("#5fb87a");
    expect(colors.dark.accent).toBe("#5fb87a");
  });

  it("defines the full light and dark color sets", () => {
    const keys = [
      "background",
      "surface",
      "surface2",
      "border",
      "text",
      "textSecondary",
      "textTertiary",
      "accent",
      "accentInk",
      "danger",
      "dangerSurface",
    ] as const;
    keys.forEach((key) => {
      expect(typeof colors.light[key]).toBe("string");
      expect(typeof colors.dark[key]).toBe("string");
    });
  });

  it("defines the spacing scale from the design system", () => {
    expect(spacing).toEqual({
      xs: 4,
      sm: 8,
      md: 12,
      lg: 16,
      xl: 20,
      xxl: 24,
      xxxl: 32,
      xxxxl: 40,
    });
  });

  it("defines the radii scale from the design system", () => {
    expect(radii).toEqual({ button: 999, card: 16, bubble: 20 });
  });

  it("defines the type scale from the design system", () => {
    expect(typeScale.screenTitle).toEqual({ fontSize: 28, fontWeight: "800" });
    expect(typeScale.header).toEqual({ fontSize: 20, fontWeight: "700" });
    expect(typeScale.chatName).toEqual({ fontSize: 17, fontWeight: "600" });
    expect(typeScale.message).toEqual({ fontSize: 16, fontWeight: "500" });
    expect(typeScale.meta).toEqual({ fontSize: 13, fontWeight: "500" });
  });
});
```

- [ ] **Step 4: Run the test to verify it fails**

Run:
```bash
cd /Users/kiran/personal/cipher-chat-app && npx jest lib/theme/tokens.test.ts
```
Expected: FAIL — `Cannot find module './tokens'`.

- [ ] **Step 5: Implement the theme tokens**

Write `lib/theme/tokens.ts`:
```ts
export type ColorTokens = {
  background: string;
  surface: string;
  surface2: string;
  border: string;
  text: string;
  textSecondary: string;
  textTertiary: string;
  accent: string;
  accentInk: string;
  danger: string;
  dangerSurface: string;
};

export const colors: { light: ColorTokens; dark: ColorTokens } = {
  light: {
    background: "#ffffff",
    surface: "#eceef2",
    surface2: "#f5f6f8",
    border: "#dde1e7",
    text: "#15171c",
    textSecondary: "#666666",
    textTertiary: "#999999",
    accent: "#5fb87a",
    accentInk: "#ffffff",
    danger: "#ff8a80",
    dangerSurface: "#fdecea",
  },
  dark: {
    background: "#1c1e24",
    surface: "#292c33",
    surface2: "#33363e",
    border: "#3d4048",
    text: "#f5f6f8",
    textSecondary: "#a7abb4",
    textTertiary: "#777b85",
    accent: "#5fb87a",
    accentInk: "#0d1f14",
    danger: "#5c2b2e",
    dangerSurface: "#2a1215",
  },
};

export const spacing = {
  xs: 4,
  sm: 8,
  md: 12,
  lg: 16,
  xl: 20,
  xxl: 24,
  xxxl: 32,
  xxxxl: 40,
} as const;

export const radii = {
  button: 999,
  card: 16,
  bubble: 20,
} as const;

export const typeScale = {
  screenTitle: { fontSize: 28, fontWeight: "800" },
  header: { fontSize: 20, fontWeight: "700" },
  chatName: { fontSize: 17, fontWeight: "600" },
  message: { fontSize: 16, fontWeight: "500" },
  meta: { fontSize: 13, fontWeight: "500" },
} as const;
```

- [ ] **Step 6: Run the test to verify it passes**

Run:
```bash
cd /Users/kiran/personal/cipher-chat-app && npx jest lib/theme/tokens.test.ts
```
Expected: PASS, 5 tests passed.

- [ ] **Step 7: Commit**

```bash
cd /Users/kiran/personal/cipher-chat-app
git add -A
git commit -m "Add Jest setup and theme tokens module"
```

---

### Task 4: Theme mode provider (light/dark/system + persistence)

**Files:**
- Create: `lib/theme/ThemeProvider.tsx`
- Create: `lib/theme/ThemeProvider.test.tsx`
- Modify: `package.json` (deps)

**Interfaces:**
- Consumes: `colors`, `ColorTokens` from `lib/theme/tokens.ts` (Task 3).
- Produces (for later tasks):
```ts
export type ThemeModePreference = "light" | "dark" | "system";
export function ThemeProvider(props: { children: React.ReactNode }): JSX.Element;
export function useTheme(): {
  mode: ThemeModePreference;
  resolvedScheme: "light" | "dark";
  colors: ColorTokens;
  setMode: (mode: ThemeModePreference) => void;
};
```
Persistence key: `"cipher.themeMode"` in AsyncStorage.

- [ ] **Step 1: Install AsyncStorage**

Run:
```bash
cd /Users/kiran/personal/cipher-chat-app
npx expo install @react-native-async-storage/async-storage
```
Expected: exits 0, `package.json` dependencies include `@react-native-async-storage/async-storage`.

- [ ] **Step 2: Write the failing tests**

Write `lib/theme/ThemeProvider.test.tsx`:
```tsx
import React from "react";
import { Text } from "react-native";
import { render, act, fireEvent } from "@testing-library/react-native";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { ThemeProvider, useTheme } from "./ThemeProvider";

jest.mock("react-native/Libraries/Utilities/useColorScheme", () => ({
  default: jest.fn(() => "light"),
}));

function Probe() {
  const { mode, resolvedScheme, colors, setMode } = useTheme();
  return (
    <>
      <Text testID="mode">{mode}</Text>
      <Text testID="scheme">{resolvedScheme}</Text>
      <Text testID="bg">{colors.background}</Text>
      <Text testID="toggle" onPress={() => setMode("dark")}>
        toggle
      </Text>
    </>
  );
}

describe("ThemeProvider", () => {
  beforeEach(async () => {
    await AsyncStorage.clear();
  });

  it("defaults to system mode resolved against the device scheme", async () => {
    const { findByTestId } = render(
      <ThemeProvider>
        <Probe />
      </ThemeProvider>
    );
    expect((await findByTestId("mode")).props.children).toBe("system");
    expect((await findByTestId("scheme")).props.children).toBe("light");
  });

  it("lets setMode override the resolved scheme and persists it", async () => {
    const { findByTestId } = render(
      <ThemeProvider>
        <Probe />
      </ThemeProvider>
    );
    const toggle = await findByTestId("toggle");
    await act(async () => {
      fireEvent.press(toggle);
    });
    expect((await findByTestId("scheme")).props.children).toBe("dark");
    expect(await AsyncStorage.getItem("cipher.themeMode")).toBe("dark");
  });
});
```

- [ ] **Step 3: Run the tests to verify they fail**

Run:
```bash
cd /Users/kiran/personal/cipher-chat-app && npx jest lib/theme/ThemeProvider.test.tsx
```
Expected: FAIL — `Cannot find module './ThemeProvider'`.

- [ ] **Step 4: Implement the theme provider**

Write `lib/theme/ThemeProvider.tsx`:
```tsx
import React, {
  createContext,
  useContext,
  useEffect,
  useMemo,
  useState,
} from "react";
import { useColorScheme } from "react-native";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { colors, ColorTokens } from "./tokens";

export type ThemeModePreference = "light" | "dark" | "system";

type ThemeContextValue = {
  mode: ThemeModePreference;
  resolvedScheme: "light" | "dark";
  colors: ColorTokens;
  setMode: (mode: ThemeModePreference) => void;
};

const STORAGE_KEY = "cipher.themeMode";

const ThemeContext = createContext<ThemeContextValue | null>(null);

export function ThemeProvider({ children }: { children: React.ReactNode }) {
  const systemScheme = useColorScheme();
  const [mode, setModeState] = useState<ThemeModePreference>("system");

  useEffect(() => {
    AsyncStorage.getItem(STORAGE_KEY).then((stored) => {
      if (stored === "light" || stored === "dark" || stored === "system") {
        setModeState(stored);
      }
    });
  }, []);

  const setMode = (next: ThemeModePreference) => {
    setModeState(next);
    AsyncStorage.setItem(STORAGE_KEY, next);
  };

  const resolvedScheme: "light" | "dark" =
    mode === "system" ? (systemScheme === "dark" ? "dark" : "light") : mode;

  const value = useMemo<ThemeContextValue>(
    () => ({
      mode,
      resolvedScheme,
      colors: colors[resolvedScheme],
      setMode,
    }),
    [mode, resolvedScheme]
  );

  return <ThemeContext.Provider value={value}>{children}</ThemeContext.Provider>;
}

export function useTheme(): ThemeContextValue {
  const ctx = useContext(ThemeContext);
  if (!ctx) {
    throw new Error("useTheme must be used within a ThemeProvider");
  }
  return ctx;
}
```

- [ ] **Step 5: Run the tests to verify they pass**

Run:
```bash
cd /Users/kiran/personal/cipher-chat-app && npx jest lib/theme/ThemeProvider.test.tsx
```
Expected: PASS, 2 tests passed.

- [ ] **Step 6: Commit**

```bash
cd /Users/kiran/personal/cipher-chat-app
git add -A
git commit -m "Add ThemeProvider with light/dark/system mode and persistence"
```

---

### Task 5: Load Plus Jakarta Sans and wire ThemeProvider into the root layout

**Files:**
- Modify: `app/_layout.tsx`
- Modify: `package.json` (deps)

**Interfaces:**
- Consumes: `ThemeProvider` from `lib/theme/ThemeProvider.tsx` (Task 4).
- Produces: every route rendered under `app/_layout.tsx` can call `useTheme()` and will have `PlusJakartaSans_500Medium` / `_600SemiBold` / `_700Bold` / `_800ExtraBold` font families available.

- [ ] **Step 1: Install font and splash-screen packages**

Run:
```bash
cd /Users/kiran/personal/cipher-chat-app
npx expo install @expo-google-fonts/plus-jakarta-sans expo-font expo-splash-screen
```
Expected: exits 0, `package.json` dependencies include all three packages.

- [ ] **Step 2: Rewrite the root layout**

Write `app/_layout.tsx`:
```tsx
import "../global.css";
import { useEffect } from "react";
import { Stack } from "expo-router";
import * as SplashScreen from "expo-splash-screen";
import {
  useFonts,
  PlusJakartaSans_500Medium,
  PlusJakartaSans_600SemiBold,
  PlusJakartaSans_700Bold,
  PlusJakartaSans_800ExtraBold,
} from "@expo-google-fonts/plus-jakarta-sans";
import { ThemeProvider } from "../lib/theme/ThemeProvider";

SplashScreen.preventAutoHideAsync();

export default function RootLayout() {
  const [fontsLoaded] = useFonts({
    PlusJakartaSans_500Medium,
    PlusJakartaSans_600SemiBold,
    PlusJakartaSans_700Bold,
    PlusJakartaSans_800ExtraBold,
  });

  useEffect(() => {
    if (fontsLoaded) {
      SplashScreen.hideAsync();
    }
  }, [fontsLoaded]);

  if (!fontsLoaded) {
    return null;
  }

  return (
    <ThemeProvider>
      <Stack screenOptions={{ headerShown: false }} />
    </ThemeProvider>
  );
}
```

- [ ] **Step 3: Verify the project still type-checks and bundles**

Run:
```bash
cd /Users/kiran/personal/cipher-chat-app
npx tsc --noEmit
npx expo export --platform web --output-dir /tmp/cipher-export-check
rm -rf /tmp/cipher-export-check
```
Expected: both commands exit 0.

- [ ] **Step 4: Commit**

```bash
cd /Users/kiran/personal/cipher-chat-app
git add -A
git commit -m "Load Plus Jakarta Sans and wire ThemeProvider into root layout"
```

---

### Task 6: Stub screens for all 9 mockup screens

**Files:**
- Create: `components/ScreenStub.tsx`
- Create: `components/ScreenStub.test.tsx`
- Create: `app/index.tsx` (Welcome/Splash)
- Create: `app/create-identity.tsx`
- Create: `app/home.tsx`
- Create: `app/connect.tsx`
- Create: `app/chat/[id].tsx`
- Create: `app/media-viewer.tsx`
- Create: `app/chat-info.tsx`
- Create: `app/settings.tsx`
- Create: `app/search.tsx`
- Create: `__tests__/screens.test.tsx`

**Interfaces:**
- Consumes: `useTheme()` from `lib/theme/ThemeProvider.tsx` (Task 4), `spacing`/`typeScale` from `lib/theme/tokens.ts` (Task 3).
- Produces: `ScreenStub({ title: string })` — reused by every route below; later phases replace each route's body with real UI but keep the file/route name.

- [ ] **Step 1: Write the failing test for ScreenStub**

Write `components/ScreenStub.test.tsx`:
```tsx
import React from "react";
import { render } from "@testing-library/react-native";
import { ThemeProvider } from "../lib/theme/ThemeProvider";
import { ScreenStub } from "./ScreenStub";

describe("ScreenStub", () => {
  it("renders the given title", async () => {
    const { findByText } = render(
      <ThemeProvider>
        <ScreenStub title="Welcome / Splash" />
      </ThemeProvider>
    );
    expect(await findByText("Welcome / Splash")).toBeTruthy();
  });
});
```

- [ ] **Step 2: Run the test to verify it fails**

Run:
```bash
cd /Users/kiran/personal/cipher-chat-app && npx jest components/ScreenStub.test.tsx
```
Expected: FAIL — `Cannot find module './ScreenStub'`.

- [ ] **Step 3: Implement ScreenStub**

Write `components/ScreenStub.tsx`:
```tsx
import { View, Text } from "react-native";
import { useTheme } from "../lib/theme/ThemeProvider";
import { spacing, typeScale } from "../lib/theme/tokens";

export function ScreenStub({ title }: { title: string }) {
  const { colors } = useTheme();
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
        }}
      >
        {title}
      </Text>
    </View>
  );
}
```

- [ ] **Step 4: Run the test to verify it passes**

Run:
```bash
cd /Users/kiran/personal/cipher-chat-app && npx jest components/ScreenStub.test.tsx
```
Expected: PASS, 1 test passed.

- [ ] **Step 5: Create the 9 stub routes**

Write `app/index.tsx`:
```tsx
import { ScreenStub } from "../components/ScreenStub";

export default function WelcomeScreen() {
  return <ScreenStub title="Welcome / Splash" />;
}
```

Write `app/create-identity.tsx`:
```tsx
import { ScreenStub } from "../components/ScreenStub";

export default function CreateIdentityScreen() {
  return <ScreenStub title="Create Identity" />;
}
```

Write `app/home.tsx`:
```tsx
import { ScreenStub } from "../components/ScreenStub";

export default function HomeScreen() {
  return <ScreenStub title="Home / Chat List" />;
}
```

Write `app/connect.tsx`:
```tsx
import { ScreenStub } from "../components/ScreenStub";

export default function ConnectScreen() {
  return <ScreenStub title="Connect Sheet" />;
}
```

Write `app/chat/[id].tsx`:
```tsx
import { ScreenStub } from "../../components/ScreenStub";

export default function ChatScreen() {
  return <ScreenStub title="Chat Screen" />;
}
```

Write `app/media-viewer.tsx`:
```tsx
import { ScreenStub } from "../components/ScreenStub";

export default function MediaViewerScreen() {
  return <ScreenStub title="Media Viewer" />;
}
```

Write `app/chat-info.tsx`:
```tsx
import { ScreenStub } from "../components/ScreenStub";

export default function ChatInfoScreen() {
  return <ScreenStub title="Chat Info" />;
}
```

Write `app/settings.tsx`:
```tsx
import { ScreenStub } from "../components/ScreenStub";

export default function SettingsScreen() {
  return <ScreenStub title="Settings" />;
}
```

Write `app/search.tsx`:
```tsx
import { ScreenStub } from "../components/ScreenStub";

export default function SearchScreen() {
  return <ScreenStub title="In-chat Search" />;
}
```

- [ ] **Step 6: Write a smoke test rendering every screen**

Write `__tests__/screens.test.tsx`:
```tsx
import React from "react";
import { render } from "@testing-library/react-native";
import { ThemeProvider } from "../lib/theme/ThemeProvider";
import WelcomeScreen from "../app/index";
import CreateIdentityScreen from "../app/create-identity";
import HomeScreen from "../app/home";
import ConnectScreen from "../app/connect";
import ChatScreen from "../app/chat/[id]";
import MediaViewerScreen from "../app/media-viewer";
import ChatInfoScreen from "../app/chat-info";
import SettingsScreen from "../app/settings";
import SearchScreen from "../app/search";

const screens: Array<[string, React.ComponentType, string]> = [
  ["Welcome", WelcomeScreen, "Welcome / Splash"],
  ["CreateIdentity", CreateIdentityScreen, "Create Identity"],
  ["Home", HomeScreen, "Home / Chat List"],
  ["Connect", ConnectScreen, "Connect Sheet"],
  ["Chat", ChatScreen, "Chat Screen"],
  ["MediaViewer", MediaViewerScreen, "Media Viewer"],
  ["ChatInfo", ChatInfoScreen, "Chat Info"],
  ["Settings", SettingsScreen, "Settings"],
  ["Search", SearchScreen, "In-chat Search"],
];

describe("stub screens", () => {
  test.each(screens)("%s renders its title", async (_name, Component, title) => {
    const { findByText } = render(
      <ThemeProvider>
        <Component />
      </ThemeProvider>
    );
    expect(await findByText(title)).toBeTruthy();
  });
});
```

- [ ] **Step 7: Run the full test suite**

Run:
```bash
cd /Users/kiran/personal/cipher-chat-app && npx jest
```
Expected: PASS, all suites green (tokens, ThemeProvider, ScreenStub, screens).

- [ ] **Step 8: Type-check and bundle-check the whole app**

Run:
```bash
cd /Users/kiran/personal/cipher-chat-app
npx tsc --noEmit
npx expo export --platform web --output-dir /tmp/cipher-export-check
rm -rf /tmp/cipher-export-check
```
Expected: both exit 0.

- [ ] **Step 9: Start the web dev server and confirm routes serve**

Run:
```bash
cd /Users/kiran/personal/cipher-chat-app && npx expo start --web --port 8081 &
sleep 8
curl -s -o /dev/null -w "%{http_code}\n" http://localhost:8081/
curl -s -o /dev/null -w "%{http_code}\n" http://localhost:8081/settings
kill %1
```
Expected: both curl commands print `200`.

- [ ] **Step 10: Commit**

```bash
cd /Users/kiran/personal/cipher-chat-app
git add -A
git commit -m "Add ScreenStub component and 9 stub routes for all mockup screens"
```
