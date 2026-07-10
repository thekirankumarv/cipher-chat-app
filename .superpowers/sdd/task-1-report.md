# Task 1 Report: Invite code generator + Firestore invite/chat store (Phase 3)

## Status: DONE_WITH_CONCERNS

Implemented per brief, with one deliberate deviation from the brief's Step 4
sample code (documented below, confirmed by empirical test failure — this
report supersedes the stale Phase 2 report previously at this path).

## Files created

- `lib/invite/inviteCode.ts`
- `lib/invite/inviteCode.test.ts`
- `lib/invite/useInvite.ts`
- `lib/invite/useInvite.test.ts`

## TDD steps followed

### Step 1-2: `generateInviteCode`

Wrote `lib/invite/inviteCode.test.ts` verbatim from the brief. Ran it first to
confirm the expected failure:

```
$ npx jest lib/invite/inviteCode.test.ts
FAIL lib/invite/inviteCode.test.ts
  ● Test suite failed to run
    Cannot find module './inviteCode' from 'lib/invite/inviteCode.test.ts'
```

Implemented `lib/invite/inviteCode.ts` verbatim from the brief. Re-ran:

```
$ npx jest lib/invite/inviteCode.test.ts
PASS lib/invite/inviteCode.test.ts
  generateInviteCode
    ✓ matches the XXX-XXXX-XX shape using only unambiguous characters
    ✓ can produce different values across calls
Tests: 2 passed, 2 total
```

### Step 3-4: `useInvite` store

Wrote `lib/invite/useInvite.test.ts` verbatim from the brief. Ran it first to
confirm the expected failure:

```
$ npx jest lib/invite/useInvite.test.ts
FAIL lib/invite/useInvite.test.ts
  ● Test suite failed to run
    Cannot find module './useInvite' from 'lib/invite/useInvite.test.ts'
```

Implemented `lib/invite/useInvite.ts` starting from the brief's Step 4 sample
code, **with one change** (see "Deviation from brief" below). Re-ran:

```
$ npx jest lib/invite/inviteCode.test.ts lib/invite/useInvite.test.ts
PASS lib/invite/useInvite.test.ts
PASS lib/invite/inviteCode.test.ts
Test Suites: 2 passed, 2 total
Tests: 8 passed, 8 total
```

## Deviation from brief (why DONE_WITH_CONCERNS)

The brief's Step 4 sample implementation calls `Timestamp.fromMillis(...)`
when writing `expiresAt` in `createInvite`. Typing that in literally and
running the Step 3 test verbatim failed at **runtime** (not a typing issue):

```
TypeError: _firestore.Timestamp.fromMillis is not a function
  at Object.fromMillis (lib/invite/useInvite.ts:32:28)
  ... at createInvite (lib/invite/useInvite.test.ts:26:41)
```

Root cause: the brief's own Step 3 test mocks `firebase/firestore` wholesale
and only stubs `Timestamp.now`:

```js
Timestamp: { now: jest.fn(() => ({ toMillis: () => 1000 })) },
```

`jest.mock("firebase/firestore", ...)` replaces the entire module for the
test file, so `createInvite`'s call to `Timestamp.fromMillis` hits the mocked
object, which has no `fromMillis` — it throws before `setDoc` is ever
reached. The brief's Step 5 note claims "this call only runs against the real
firebase/firestore module at runtime" and frames the mismatch as a
TypeScript-typing footnote — that framing does not hold for the Jest runtime;
the mock fully replaces the module, so the call is intercepted and fails
every time, not just under type-checking.

**Fix applied:** replaced `Timestamp.fromMillis(Date.now() + EXPIRY_MS)` with
`new Date(Date.now() + EXPIRY_MS)`, and dropped the now-unused `Timestamp`
import. This is production-equivalent: the Firestore SDK auto-converts a
plain JS `Date` to a `Timestamp` on write, and `snap.data()` returns a real
`Timestamp` (with `.toMillis()`) on read — exactly what `redeemInvite`
consumes via `invite.expiresAt.toMillis()`. Nothing downstream changes; the
on-disk field type is identical to what `Timestamp.fromMillis` would have
produced. Alternative considered and rejected: calling the mocked
`Timestamp.now()` and adding `EXPIRY_MS` to its `.toMillis()` result would
yield a bare number without a `.toMillis()` method, silently breaking the
equivalent production read path.

The test file's mocks were not modified (per instructions to keep the
brief's mocks as-is).

## Full verification (clean tree, before commit)

```
$ npx jest
Test Suites: 13 passed, 13 total
Tests:       50 passed, 50 total
```
All 13 suites pass, including the 8 new invite tests. Two pre-existing
suites (`create-identity-screen.test.tsx`, `useIdentity.test.ts`) print
unrelated pre-existing React `act()` console warnings from Phase 2 code —
not introduced by this task, already present/passing before this change.

```
$ npx tsc --noEmit
(exit 0, no output)
```

```
$ grep -E '"react"|"react-test-renderer"' package.json
    "react": "19.2.3",
    "react-test-renderer": "19.2.3",
```
No install was run in this task; pins unchanged and unaffected.

## Commit

```
git add -A
git commit -m "Add invite code generator and Firestore invite/chat store"
```

Commit hash: see reply message (recorded after commit).
