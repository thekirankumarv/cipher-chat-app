# Task 1 Report: Firebase config module (Phase 2)

## Status: DONE_WITH_CONCERNS

The previous attempt (see "What changed vs first attempt" below) stopped at NEEDS_CONTEXT
because the verbatim brief's test imported the real `firebase` package, and Jest's
transform couldn't parse its ESM internals. That question has been resolved: the plan doc
(`docs/superpowers/plans/2026-07-10-phase2-firebase-identity.md`, Task 1 Step 3) was
updated to mock `firebase/app`, `firebase/auth`, and `firebase/firestore` directly in the
test, so Jest never loads the real SDK. That part is now done and green.

However, implementing `config.ts` (Step 5) surfaced a **second, independent** issue that
the mocking fix does not touch: `npx tsc --noEmit` fails on the verbatim `config.ts`
because of an upstream defect in `@firebase/auth`'s own `package.json` `exports` map (see
"tsc blocker" below). I applied a minimal, targeted `// @ts-ignore` to unblock `tsc`,
which is the one deviation from "keep config.ts verbatim" — flagging this as the concern
in DONE_WITH_CONCERNS.

## What changed vs first attempt

1. **Test file replaced** (`lib/firebase/config.test.ts`): swapped the original
   brief's verbatim test (which `require("./config")`'d straight into the real,
   unmocked `firebase` package) for the version specified in the updated plan doc, which
   adds `jest.mock("firebase/app" | "firebase/auth" | "firebase/firestore", ...)` at the
   top and asserts on mock call arguments (`initializeApp` called with the exact mapped
   config object; `initializeAuth` called with `(mockApp, { persistence: mockPersistence
   })`; `getFirestore` called with `mockApp`) instead of just `toBeDefined()`. Same file
   path, same `describe` block name, same env-var-driven validation test.
2. **`config.ts` needed one deviation from verbatim** to make `tsc` pass — see "tsc
   blocker" below. Everything else in `config.ts` is exactly as specified in the plan.
3. Steps 7 (tsc) and 8 (commit) — not reached in the first attempt — are now both done.

## What was done (this attempt, in this worktree)

This worktree (`worktree-agent-ae65e55565825c44e`, branched off `phase2-firebase-identity`
at commit `8dd70f9`) started with a clean checkout and no `node_modules`, so steps below
include a base `npm install` not present in the original attempt's log.

### Step 0 (this worktree only): base dependency install

```
npm install
```
Exit 0. Installed the 918 packages already declared in `package-lock.json` (this worktree
had no `node_modules` yet).

### Step 1: Install the Firebase JS SDK

```
node -e "console.log(require('./node_modules/react/package.json').version, require('./node_modules/react-test-renderer/package.json').version)"
# -> 19.2.3 19.2.3
npm install firebase
node -e "console.log(require('./node_modules/react/package.json').version, require('./node_modules/react-test-renderer/package.json').version)"
# -> 19.2.3 19.2.3
```
No drift. `package.json` now has `"firebase": "^12.16.0"` under `dependencies` (single
added line, confirmed via `git diff package.json`).

### Step 2: gitignore + .env.example

`.gitignore` — added `.env` under `# local env files` (alongside existing
`.env*.local`). Created `.env.example` with the six empty `EXPO_PUBLIC_FIREBASE_*` keys.

### Step 3: Mocked test written (per updated plan doc)

Wrote `lib/firebase/config.test.ts` verbatim from the plan doc's Step 3: `jest.mock`
for `firebase/app`, `firebase/auth`, `firebase/firestore` with `mockApp`/`mockAuth`/
`mockPersistence`/`mockDb` fixtures; two `it` blocks — missing-env-vars throw, and
present-env-vars asserting `initializeApp`/`initializeAuth`/`getFirestore` call
arguments plus the exported `firebaseApp`/`auth`/`db` identity.

### Step 4: Ran test, confirmed expected failure

```
npx jest lib/firebase/config.test.ts
```
FAIL — `Cannot find module './config' from 'lib/firebase/config.test.ts'` (both tests).
Matches expected pre-implementation failure.

### Step 5: Implemented `lib/firebase/config.ts`

Written per the plan doc verbatim, **except** for one `// @ts-ignore` addition — see
"tsc blocker" below.

### Step 6: Ran test again — PASS

```
npx jest lib/firebase/config.test.ts
```
```
PASS lib/firebase/config.test.ts
  firebase config
    ✓ throws a clear error when env vars are missing (236 ms)
    ✓ initializes app, auth, and db when env vars are present (1 ms)

Test Suites: 1 passed, 1 total
Tests:       2 passed, 2 total
```
Also ran the full suite to check for regressions: `npx jest` → 5 suites / 19 tests, all
passed.

### Step 7: `npx tsc --noEmit`

First run (before the `@ts-ignore` deviation) **failed**:
```
lib/firebase/config.ts(10,3): error TS2305: Module '"firebase/auth"' has no exported
member 'getReactNativePersistence'.
```

**tsc blocker — root cause (verified, not guessed):**
- `npx tsc --noEmit --listFiles` shows the type declaration actually resolved for
  `firebase/auth` is `node_modules/@firebase/auth/dist/auth-public.d.ts` — the generic
  cross-platform declaration file, not the React Native one
  (`@firebase/auth/dist/rn/index.rn.d.ts`, which is where
  `export { getReactNativePersistence } ...` actually lives — confirmed via `grep`).
- Repro'd directly against `@firebase/auth` too (bypassing the `firebase` wrapper
  package entirely): same resolution, same missing member. So this is not specific to
  the `firebase` meta-package's re-export.
- Root cause: `node_modules/@firebase/auth/package.json`'s `exports["."]` object lists
  a bare `"types": "./dist/auth-public.d.ts"` key **before** the `"react-native": {
  "types": "./dist/rn/index.rn.d.ts", ... }` conditional branch (confirmed by `grep -n`
  on the raw file — line 15 vs line 21). This project's `tsconfig` (via
  `expo/tsconfig.base`) sets `moduleResolution: "bundler"` and
  `customConditions: ["react-native"]`, but because of that ordering, TypeScript's
  type-only resolution matches the always-active bare `"types"` key first and never
  reaches the `"react-native"` branch. This is a known upstream ordering pitfall in
  conditional `exports` maps (the `"types"` condition needs to be the first key
  *within whichever platform branch wins*, not a sibling that pre-empts the branches).
- This is unrelated to the Jest-mocking fix; it is a real TypeScript resolution defect
  in `@firebase/auth`'s own package metadata, reproducible independent of this
  project's Jest config.
- At real app runtime this is expected to be a non-issue: Metro resolves `firebase/auth`
  (JS, not types) down to `export * from '@firebase/auth'`, and that nested bare-specifier
  resolution for the actual `@firebase/auth` package *does* correctly land on the
  `"react-native"` condition's JS entry (`dist/rn/index.js`), which does export
  `getReactNativePersistence` at runtime — confirmed by inspecting
  `@firebase/auth/package.json`'s exports (JS/runtime resolution isn't gated by the
  `types` ordering quirk, only the type-only resolution is). **Caveat: this is inferred
  from the package manifests, not device-verified** — no on-device/Metro bundle test was
  run in this task.

**Deviation applied:** added a single `// @ts-ignore` comment immediately above the
`getReactNativePersistence` import in `config.ts`, with an inline comment explaining the
upstream cause and that runtime is expected to be unaffected. No other line of
`config.ts` was changed from the plan doc's Step 5 text. Chose `@ts-ignore` over
`@ts-expect-error` so this doesn't itself start erroring if/when firebase fixes the
export ordering upstream.

Second run (after the deviation):
```
npx tsc --noEmit
```
Exit 0, no output.

### Step 8: Commit

Committed `.gitignore`, `.env.example`, `lib/firebase/config.ts`,
`lib/firebase/config.test.ts`, and the `package.json`/`package-lock.json` dependency
changes.

## Current repo state (after commit)

Working tree clean on branch `worktree-agent-ae65e55565825c44e` (based on
`phase2-firebase-identity`).

## Open item for a future task (not blocking this one)

The `// @ts-ignore` in `config.ts` should be revisited if `@firebase/auth` ever fixes
the `exports["."]` key ordering upstream (or if the project pins a firebase version
that does) — at that point the ignore comment becomes dead weight and can be removed.
Flagging here rather than silently leaving it for someone to trip over later.
