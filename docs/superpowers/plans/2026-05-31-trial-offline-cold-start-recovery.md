# Trial Validation — Offline Cold-Start Auto-Recovery Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** When the very first app open is offline (no cached entitlement, network fetch fails → `read_only`), automatically recover the moment the OS reports the app foregrounding OR connectivity coming back. Today the AppState foreground revalidator bails on `!cached` and there is no connectivity listener at all, so the only escape is the manual "Reconnect" button or a force-quit/relaunch.

**Architecture:** Two scoped changes inside `src/features/trial/hooks.tsx`. (1) Lift the `!cached` guard in the existing `AppState.change` handler so the no-cache case is also revalidated on foreground. (2) Add a sibling `useEffect` that subscribes to `expo-network`'s `addNetworkStateListener` and refetches on offline→online transitions when `userId` is set and the cache is either missing or stale. Both handlers share a small inline `shouldRevalidate(cached, now)` helper. No new files, no new dependency — `expo-network@8.0.8` is already installed and its `addNetworkStateListener` API ships in this version. The strict `(D4)` "no cache → read_only" invariant at [grace.ts:13](src/features/trial/grace.ts:13) is unchanged — we are only changing when revalidation is *attempted*, not the access policy.

**Tech Stack:** TypeScript, React Native 0.81 (Expo SDK 54), `expo-network` 8.0.8, Jest with `jest-expo` preset and `@testing-library/react-native`. Repo uses `npm` (package-lock.json present, no pnpm-workspace).

**Bug summary:** Verified end-to-end in the systematic-debugging phase. Offline first-launch path: `readCachedEntitlement` → `null` → bootstrap calls `fetchAndCache(userId)` → network throws → catch block at [hooks.tsx:92-106](src/features/trial/hooks.tsx:92) leaves state `{cached:null,isBootstrapping:false}` → `computeAccessMode({lastValidatedAt:null})` returns `"read_only"` per [grace.ts:13-15](src/features/trial/grace.ts:13). After that, foreground events hit the handler at [hooks.tsx:170-172](src/features/trial/hooks.tsx:170) and bail because `cached === null`. `grep NetInfo` in `src/` returns zero matches, confirming no connectivity-change recovery path exists. Manual "Reconnect" (wired at [TodayScreen.tsx:326](src/features/today/screens/TodayScreen.tsx:326) → `refresh()` → `fetchAndCache`) is the only automatic-feeling escape; otherwise the user must kill + relaunch the app while online.

**Scope notes:**
- The fail-closed result (`read_only` while no cache) is intentional — Case 8 of the existing test suite at [hooks.test.tsx:233-252](src/features/trial/__tests__/hooks.test.tsx:233) tags it `(D1)/(D4) invariant`. We do not touch that policy.
- We only add *triggers* that attempt to re-fetch when conditions change. Each new trigger still funnels through `fetchAndCache`, so if the fetch fails again the state stays `read_only` and the next trigger retries.
- React Query's `refetchOnReconnect: true` ([queryClient.ts:8](src/lib/query/queryClient.ts:8)) doesn't help — the trial system has its own `useState`-based lifecycle and isn't a React Query query.
- `expo-network`'s `Network.NetworkStateEvent` has `isConnected?: boolean`. Treat `undefined` as offline (safe default).
- No native rebuild required — `expo-network` is already linked in the beta build.
- Commit pattern in this repo is scoped conventional commits (see `fix(reminders): drop double-schedule on habit edit`). Use `fix(trial): ...`.

---

## File Structure

**Modified:**
- `src/features/trial/hooks.tsx` — add inline `shouldRevalidate` helper; consolidate the bootstrap effect's inline staleness math through it; rewrite the existing AppState effect to drop the `!cached` guard and use the helper; add a new `useEffect` subscribing to `Network.addNetworkStateListener`.
- `src/features/trial/__tests__/hooks.test.tsx` — switch `beforeEach` to *capture* the AppState and Network listener callbacks (currently AppState is mocked to a no-op stub); add a `jest.mock("expo-network", ...)` declaration at the top with the other mocks; add new test cases covering both triggers across present/missing/stale-cache states.

**No new files. No new dependencies. No native rebuild.**

---

## Task 1: Refactor test setup to capture AppState and Network listeners

This is pure test plumbing — no production code changes yet. After this task, the existing test suite still passes, but now the `beforeEach` exposes the captured callbacks so subsequent TDD tasks can drive them.

**Files:**
- Modify: `src/features/trial/__tests__/hooks.test.tsx:1-115`

- [x] **Step 1: Add the `expo-network` mock declaration**

At the top of [src/features/trial/__tests__/hooks.test.tsx](src/features/trial/__tests__/hooks.test.tsx), add a new `jest.mock` block alongside the existing ones. Insert this between the existing `jest.mock("@/features/trial/storage", ...)` block (ends at line 22) and the `jest.mock("@/services/logger", ...)` block (begins at line 24):

```ts
jest.mock("expo-network", () => ({
  addNetworkStateListener: jest.fn(),
}));
```

- [x] **Step 2: Add the new imports**

Update the import block at lines 28-49 to add `act` from testing-library and the namespace import for `expo-network`:

```ts
import React from "react";
import { AppState, type AppStateStatus } from "react-native";
import * as Network from "expo-network";
import { act, renderHook, waitFor } from "@testing-library/react-native";
```

- [x] **Step 3: Add capture refs and mock handle below the existing `const mockClearCachedEntitlement` declaration (~line 54)**

After line 54 (`const mockClearCachedEntitlement = clearCachedEntitlement as jest.Mock;`), add:

```ts
const mockAddNetworkStateListener = Network.addNetworkStateListener as jest.Mock;

let capturedAppStateListener:
  | ((nextState: AppStateStatus) => void)
  | null = null;
let capturedNetworkListener:
  | ((event: Network.NetworkStateEvent) => void)
  | null = null;
```

- [x] **Step 4: Replace the AppState stub in `beforeEach` with capture-aware implementations for both listeners**

Replace the existing `beforeEach` block at lines 104-111:

```ts
beforeEach(() => {
  jest.clearAllMocks();
  setNowForTesting(NOW);
  mockWriteCachedEntitlement.mockResolvedValue(undefined);
  mockClearCachedEntitlement.mockResolvedValue(undefined);
  // Prevent real AppState subscriptions from firing in tests.
  jest.spyOn(AppState, "addEventListener").mockReturnValue({ remove: jest.fn() } as never);
});
```

with:

```ts
beforeEach(() => {
  jest.clearAllMocks();
  setNowForTesting(NOW);
  mockWriteCachedEntitlement.mockResolvedValue(undefined);
  mockClearCachedEntitlement.mockResolvedValue(undefined);

  capturedAppStateListener = null;
  capturedNetworkListener = null;

  jest
    .spyOn(AppState, "addEventListener")
    .mockImplementation((event, listener) => {
      if (event === "change") {
        capturedAppStateListener = listener as (
          nextState: AppStateStatus,
        ) => void;
      }
      return { remove: jest.fn() } as never;
    });

  mockAddNetworkStateListener.mockImplementation((listener) => {
    capturedNetworkListener = listener;
    return { remove: jest.fn() };
  });
});
```

- [x] **Step 5: Run the full trial test file to confirm nothing regressed**

Run: `npm test -- src/features/trial/__tests__/hooks.test.tsx`

Expected: all 9 existing tests pass. (`expo-network` mock is in place but no production code consumes it yet, so it's inert.)

- [x] **Step 6: Commit**

```bash
git add src/features/trial/__tests__/hooks.test.tsx
git commit -m "test(trial): capture AppState and Network listeners in test setup"
```

---

## Task 2: Add the `shouldRevalidate` helper (failing-test-first proves call-site choice)

Pure logic helper that both effects will call. Inline at module scope in `hooks.tsx`. We TDD the AppState rewrite next; this helper lands together with that rewrite.

**Files:**
- Modify: `src/features/trial/hooks.tsx:29-30` (add the helper just after the imports block)

- [x] **Step 1: Add the helper at module scope**

In [src/features/trial/hooks.tsx](src/features/trial/hooks.tsx), after the existing `import { now } from "@/utils/clock";` line (line 29), add a blank line and then this helper:

```ts
function shouldRevalidate(
  cached: CachedTrialEntitlement | null,
  currentTime: Date,
): boolean {
  if (!cached) return true;
  const stalenessMs = TRIAL_REVALIDATION_STALENESS_MINUTES * 60 * 1000;
  const ageMs =
    currentTime.getTime() - new Date(cached.last_validated_at).getTime();
  return ageMs > stalenessMs;
}
```

- [x] **Step 2: Run typecheck to confirm no broken references**

Run: `npm run typecheck`

Expected: clean (no errors). The helper is unused so far — that's fine; the next task wires it in.

- [x] **Step 3: No commit yet** — Task 3 lands the helper together with the AppState rewrite as one logical change.

---

## Task 3: Fix the AppState `!cached` bail-out (TDD)

This is the core bug fix. The existing handler at [hooks.tsx:164-184](src/features/trial/hooks.tsx:164) bails on `!cached`, leaving the offline-cold-start user stranded. After this task, foregrounding the app revalidates whenever the cache is missing OR stale (and a `userId` is present).

**Files:**
- Modify: `src/features/trial/hooks.tsx:163-184`
- Test: `src/features/trial/__tests__/hooks.test.tsx` (append new cases)

- [x] **Step 1: Write the failing test for the bug — AppState=active with no cache should fetch**

Append at the end of the `describe("useTrialValidation", ...)` block in [src/features/trial/__tests__/hooks.test.tsx](src/features/trial/__tests__/hooks.test.tsx), just before the closing `});` of the describe (currently line 270):

```ts
  // ─── Case 10: AppState foreground with no cache (offline cold-start recovery) ──

  it("fetches when app becomes active and there is no cached entitlement", async () => {
    mockReadCachedEntitlement.mockResolvedValue(null);
    const { TrialEntitlementFetchError } = jest.requireMock(
      "@/features/trial/api",
    ) as {
      TrialEntitlementFetchError: new (
        msg: string,
        reason: string,
      ) => Error & { reason: string };
    };
    // Initial bootstrap fetch fails (offline cold start).
    mockFetchTrialEntitlement.mockRejectedValueOnce(
      new TrialEntitlementFetchError("network error", "network"),
    );

    const wrapper = makeAuthWrapper({
      isBootstrapping: false,
      userId: "user-1",
    });
    const { result } = renderHook(() => useTrialValidation(), { wrapper });

    await waitFor(() => expect(result.current.isBootstrapping).toBe(false));
    expect(result.current.accessMode).toBe("read_only");
    mockFetchTrialEntitlement.mockClear();

    // Network comes back; the next fetch succeeds.
    mockFetchTrialEntitlement.mockResolvedValueOnce(freshEntitlement());

    expect(capturedAppStateListener).not.toBeNull();
    await act(async () => {
      capturedAppStateListener!("active");
    });

    await waitFor(() => {
      expect(mockFetchTrialEntitlement).toHaveBeenCalledWith("user-1");
    });
    await waitFor(() => expect(result.current.accessMode).toBe("full"));
  });
```

- [x] **Step 2: Run the new test and confirm it fails**

Run: `npm test -- src/features/trial/__tests__/hooks.test.tsx -t "fetches when app becomes active and there is no cached entitlement"`

Expected: FAIL — `mockFetchTrialEntitlement` is called once (the initial bootstrap rejection) but not a second time after `capturedAppStateListener("active")`. This is because the current handler bails on `!cached`.

- [x] **Step 3: Rewrite the AppState effect to use `shouldRevalidate`**

Replace the entire `useEffect` block at [src/features/trial/hooks.tsx:163-184](src/features/trial/hooks.tsx:163):

```tsx
  // Revalidate when the app returns to the foreground and cache is missing or stale.
  useEffect(() => {
    const subscription = AppState.addEventListener(
      "change",
      (nextState: AppStateStatus) => {
        if (nextState !== "active") return;

        const uid = userIdRef.current;
        if (!uid) return;

        if (shouldRevalidate(cachedRef.current, now())) {
          void fetchAndCache(uid);
        }
      },
    );

    return () => subscription.remove();
  }, [fetchAndCache]);
```

(Diff vs. current: removed the `const cached = cachedRef.current;` line and the `!cached` clause from the early-return; replaced the staleness math at lines 174-179 with a single `shouldRevalidate` call.)

- [x] **Step 4: Run the new test and confirm it passes**

Run: `npm test -- src/features/trial/__tests__/hooks.test.tsx -t "fetches when app becomes active and there is no cached entitlement"`

Expected: PASS.

- [x] **Step 4b: Consolidate the bootstrap effect's staleness math into `shouldRevalidate` (pure refactor)**

The bootstrap effect at [hooks.tsx:138-147](src/features/trial/hooks.tsx:138) duplicates the staleness arithmetic that `shouldRevalidate` now owns. Fold it in. This is behavior-equivalent — the existing Case 5 ("surfaces cached entitlement without re-fetching when cache is fresh") and Case 6 ("surfaces stale cache immediately then re-fetches in background") already cover both branches and must remain green.

Replace the `if (cached) { ... }` block at lines 138-148 of the *current* file (the entire stale-cache branch):

```ts
      if (cached) {
        // Surface cache immediately, then decide whether to re-fetch.
        setState({ cached, isBootstrapping: false, isValidating: false });
        const stalenessMs = TRIAL_REVALIDATION_STALENESS_MINUTES * 60 * 1000;
        const ageMs =
          now().getTime() - new Date(cached.last_validated_at).getTime();
        if (!cancelled && ageMs > stalenessMs) {
          await fetchAndCache(userId);
        }
        return;
      }
```

with:

```ts
      if (cached) {
        // Surface cache immediately, then decide whether to re-fetch.
        setState({ cached, isBootstrapping: false, isValidating: false });
        if (!cancelled && shouldRevalidate(cached, now())) {
          await fetchAndCache(userId);
        }
        return;
      }
```

- [x] **Step 4c: Run Cases 5 and 6 to confirm the refactor preserved behavior**

Run: `npm test -- src/features/trial/__tests__/hooks.test.tsx -t "surfaces cached entitlement without re-fetching when cache is fresh"`

Expected: PASS.

Run: `npm test -- src/features/trial/__tests__/hooks.test.tsx -t "surfaces stale cache immediately then re-fetches in background"`

Expected: PASS.

- [x] **Step 5: Add a regression test — AppState=active with stale cache should still fetch**

Append after Case 10 (still inside the describe block):

> **Setup note:** The bootstrap effect at [hooks.tsx:138-147](src/features/trial/hooks.tsx:138) surfaces a stale cache and *immediately* calls `fetchAndCache`. If we let that bootstrap fetch *succeed* with a fresh entitlement, the cache ref becomes fresh and `shouldRevalidate` returns `false` when AppState fires — the test would assert a fetch that never happens. So we **reject** the bootstrap call (network blip) to leave the cache stale, then **resolve** the AppState-triggered call. As a bonus this lets us assert recovery to `"full"`, mirroring Case 10's shape.

```ts
  // ─── Case 11: AppState foreground with stale cache (existing behavior, regression guard) ──

  it("fetches when app becomes active and the cached entitlement is stale", async () => {
    mockReadCachedEntitlement.mockResolvedValue(staleEntitlement());
    const { TrialEntitlementFetchError } = jest.requireMock(
      "@/features/trial/api",
    ) as {
      TrialEntitlementFetchError: new (
        msg: string,
        reason: string,
      ) => Error & { reason: string };
    };
    // Bootstrap revalidation fails → cache stays stale.
    mockFetchTrialEntitlement.mockRejectedValueOnce(
      new TrialEntitlementFetchError("network error", "network"),
    );

    const wrapper = makeAuthWrapper({
      isBootstrapping: false,
      userId: "user-1",
    });
    const { result } = renderHook(() => useTrialValidation(), { wrapper });

    await waitFor(() => {
      expect(result.current.isBootstrapping).toBe(false);
      expect(result.current.isValidating).toBe(false);
    });
    // Cache is still stale because the bootstrap fetch rejected.
    expect(result.current.lastValidatedAt).toBe(
      staleEntitlement().last_validated_at,
    );
    mockFetchTrialEntitlement.mockClear();

    // Network recovers; the AppState-triggered fetch succeeds.
    mockFetchTrialEntitlement.mockResolvedValueOnce(freshEntitlement());

    await act(async () => {
      capturedAppStateListener!("active");
    });

    await waitFor(() => {
      expect(mockFetchTrialEntitlement).toHaveBeenCalledWith("user-1");
    });
    await waitFor(() =>
      expect(result.current.lastValidatedAt).toBe(
        freshEntitlement().last_validated_at,
      ),
    );
  });
```

- [x] **Step 6: Add a regression test — AppState=active with fresh cache should NOT fetch**

Append after Case 11:

> **Settling pattern note (applies to all negative-path tests below):** Use `waitFor(() => expect(result.current.isBootstrapping).toBe(false))` to gate on bootstrap completion — *not* `waitFor(() => mockFetchTrialEntitlement.not.toHaveBeenCalled())`. The latter is satisfied at t=0 before bootstrap has populated `cachedRef`, so the AppState/Network handler would see `cached === null`, `shouldRevalidate` would return `true`, and a fetch would fire — exactly what the test claims won't happen. Gate on the hook's own settled state instead.

```ts
  // ─── Case 12: AppState foreground with fresh cache should not fetch ──────────

  it("does not fetch when app becomes active and the cached entitlement is fresh", async () => {
    mockReadCachedEntitlement.mockResolvedValue(freshEntitlement());

    const wrapper = makeAuthWrapper({
      isBootstrapping: false,
      userId: "user-1",
    });
    const { result } = renderHook(() => useTrialValidation(), { wrapper });

    // Settle on the hook's bootstrap completion so cachedRef is populated.
    await waitFor(() => expect(result.current.isBootstrapping).toBe(false));
    expect(mockFetchTrialEntitlement).not.toHaveBeenCalled();

    await act(async () => {
      capturedAppStateListener!("active");
    });

    // Give microtasks a chance to flush.
    await new Promise((resolve) => setImmediate(resolve));
    expect(mockFetchTrialEntitlement).not.toHaveBeenCalled();
  });
```

- [x] **Step 7: Add a regression test — signed-out user should not fetch on foreground**

Append after Case 12:

```ts
  // ─── Case 13: AppState foreground while signed out should not fetch ─────────

  it("does not fetch when app becomes active and the user is signed out", async () => {
    mockReadCachedEntitlement.mockResolvedValue(null);

    const wrapper = makeAuthWrapper({ isBootstrapping: false, userId: null });
    const { result } = renderHook(() => useTrialValidation(), { wrapper });

    await waitFor(() => expect(result.current.isBootstrapping).toBe(false));
    expect(mockFetchTrialEntitlement).not.toHaveBeenCalled();

    await act(async () => {
      capturedAppStateListener!("active");
    });

    await new Promise((resolve) => setImmediate(resolve));
    expect(mockFetchTrialEntitlement).not.toHaveBeenCalled();
  });
```

- [x] **Step 8: Run the full trial test file and confirm all tests pass**

Run: `npm test -- src/features/trial/__tests__/hooks.test.tsx`

Expected: PASS (13 tests — 9 original + 4 new).

- [x] **Step 9: Run typecheck**

Run: `npm run typecheck`

Expected: clean.

- [x] **Step 10: Commit (this commit includes Task 2's helper plus Task 3's fix and tests)**

```bash
git add src/features/trial/hooks.tsx src/features/trial/__tests__/hooks.test.tsx
git commit -m "fix(trial): revalidate on foreground even when no cache exists"
```

---

## Task 4: Add `expo-network` subscription for offline→online auto-recovery (TDD)

The AppState fix in Task 3 handles "user backgrounds the app while offline and foregrounds after network returns." This task closes the other half: "user keeps the app in the foreground and waits for connectivity to come back." Subscribe to `expo-network`'s state events; fire `fetchAndCache` only on the offline→online edge.

**Files:**
- Modify: `src/features/trial/hooks.tsx` (add new import + new effect)
- Test: `src/features/trial/__tests__/hooks.test.tsx` (append new cases)

- [x] **Step 1: Write the failing test for the core bug — connectivity returns and the cache is empty**

Append after Case 13 in [src/features/trial/__tests__/hooks.test.tsx](src/features/trial/__tests__/hooks.test.tsx):

```ts
  // ─── Case 14: Network offline→online with no cache (the second half of the trap) ──

  it("fetches when connectivity transitions offline→online and there is no cached entitlement", async () => {
    mockReadCachedEntitlement.mockResolvedValue(null);
    const { TrialEntitlementFetchError } = jest.requireMock(
      "@/features/trial/api",
    ) as {
      TrialEntitlementFetchError: new (
        msg: string,
        reason: string,
      ) => Error & { reason: string };
    };
    mockFetchTrialEntitlement.mockRejectedValueOnce(
      new TrialEntitlementFetchError("network error", "network"),
    );

    const wrapper = makeAuthWrapper({
      isBootstrapping: false,
      userId: "user-1",
    });
    const { result } = renderHook(() => useTrialValidation(), { wrapper });

    await waitFor(() => expect(result.current.isBootstrapping).toBe(false));
    expect(result.current.accessMode).toBe("read_only");
    mockFetchTrialEntitlement.mockClear();

    mockFetchTrialEntitlement.mockResolvedValueOnce(freshEntitlement());

    expect(capturedNetworkListener).not.toBeNull();
    // Simulate the OS reporting offline first, then online.
    await act(async () => {
      capturedNetworkListener!({ isConnected: false });
    });
    await act(async () => {
      capturedNetworkListener!({ isConnected: true });
    });

    await waitFor(() => {
      expect(mockFetchTrialEntitlement).toHaveBeenCalledWith("user-1");
    });
    await waitFor(() => expect(result.current.accessMode).toBe("full"));
  });
```

- [x] **Step 2: Run the new test and confirm it fails**

Run: `npm test -- src/features/trial/__tests__/hooks.test.tsx -t "fetches when connectivity transitions offline.->.online and there is no cached entitlement"`

Expected: FAIL — `capturedNetworkListener` is `null` because the production code does not subscribe to `expo-network` yet.

- [x] **Step 3: Add the `expo-network` import**

In [src/features/trial/hooks.tsx](src/features/trial/hooks.tsx), add the namespace import to the imports block. Insert after `import { AppState, type AppStateStatus } from "react-native";` (currently line 10):

```ts
import * as Network from "expo-network";
```

- [x] **Step 4: Add the new `useEffect` after the AppState effect**

> **Note on placement:** Line numbers have shifted from the original file because Task 2 inserted `shouldRevalidate` near line 30 and Task 3 shortened the AppState effect. Locate by content: find the `useEffect` whose body calls `AppState.addEventListener("change", …)` and whose dependency array is `[fetchAndCache]`. Insert the new effect immediately after that block's closing `}, [fetchAndCache]);`.

Insert this new effect at that location:

```tsx
  // Revalidate when connectivity transitions offline→online.
  // Mirrors the AppState handler so users who keep the app foregrounded
  // through a network drop recover without tapping Reconnect.
  useEffect(() => {
    // Assume online at subscribe time so that a "true" replay (if the platform
    // sends one) does not look like a transition. Only false→true triggers.
    let prevConnected = true;

    const subscription = Network.addNetworkStateListener((event) => {
      const isConnected = event.isConnected === true;
      const wasOffline = prevConnected === false;
      prevConnected = isConnected;

      if (!wasOffline || !isConnected) return;

      const uid = userIdRef.current;
      if (!uid) return;

      if (shouldRevalidate(cachedRef.current, now())) {
        void fetchAndCache(uid);
      }
    });

    return () => subscription.remove();
  }, [fetchAndCache]);
```

- [x] **Step 5: Run the failing test and confirm it now passes**

Run: `npm test -- src/features/trial/__tests__/hooks.test.tsx -t "fetches when connectivity transitions offline.->.online and there is no cached entitlement"`

Expected: PASS.

- [x] **Step 6: Add regression test — offline→online with stale cache should also fetch**

Append after Case 14:

> **Setup note:** Same reasoning as Case 11. If the bootstrap revalidation succeeds, `cachedRef` becomes fresh and the Network handler's `shouldRevalidate` returns `false`. Reject the bootstrap call, then resolve the Network-triggered call.

```ts
  // ─── Case 15: Network offline→online with stale cache ────────────────────────

  it("fetches when connectivity transitions offline→online and the cached entitlement is stale", async () => {
    mockReadCachedEntitlement.mockResolvedValue(staleEntitlement());
    const { TrialEntitlementFetchError } = jest.requireMock(
      "@/features/trial/api",
    ) as {
      TrialEntitlementFetchError: new (
        msg: string,
        reason: string,
      ) => Error & { reason: string };
    };
    // Bootstrap revalidation fails → cache stays stale.
    mockFetchTrialEntitlement.mockRejectedValueOnce(
      new TrialEntitlementFetchError("network error", "network"),
    );

    const wrapper = makeAuthWrapper({
      isBootstrapping: false,
      userId: "user-1",
    });
    const { result } = renderHook(() => useTrialValidation(), { wrapper });

    await waitFor(() => {
      expect(result.current.isBootstrapping).toBe(false);
      expect(result.current.isValidating).toBe(false);
    });
    expect(result.current.lastValidatedAt).toBe(
      staleEntitlement().last_validated_at,
    );
    mockFetchTrialEntitlement.mockClear();

    // Network recovers; the connectivity-triggered fetch succeeds.
    mockFetchTrialEntitlement.mockResolvedValueOnce(freshEntitlement());

    await act(async () => {
      capturedNetworkListener!({ isConnected: false });
    });
    await act(async () => {
      capturedNetworkListener!({ isConnected: true });
    });

    await waitFor(() => {
      expect(mockFetchTrialEntitlement).toHaveBeenCalledWith("user-1");
    });
    await waitFor(() =>
      expect(result.current.lastValidatedAt).toBe(
        freshEntitlement().last_validated_at,
      ),
    );
  });
```

- [x] **Step 7: Add regression test — offline→online with fresh cache should NOT fetch**

Append after Case 15:

```ts
  // ─── Case 16: Network offline→online with fresh cache should not fetch ──────

  it("does not fetch when connectivity transitions offline→online and the cached entitlement is fresh", async () => {
    mockReadCachedEntitlement.mockResolvedValue(freshEntitlement());

    const wrapper = makeAuthWrapper({
      isBootstrapping: false,
      userId: "user-1",
    });
    const { result } = renderHook(() => useTrialValidation(), { wrapper });

    await waitFor(() => expect(result.current.isBootstrapping).toBe(false));
    expect(mockFetchTrialEntitlement).not.toHaveBeenCalled();

    await act(async () => {
      capturedNetworkListener!({ isConnected: false });
    });
    await act(async () => {
      capturedNetworkListener!({ isConnected: true });
    });

    await new Promise((resolve) => setImmediate(resolve));
    expect(mockFetchTrialEntitlement).not.toHaveBeenCalled();
  });
```

- [x] **Step 8: Add regression test — online→online (no transition) should NOT fetch**

Append after Case 16:

```ts
  // ─── Case 17: Network online→online (no transition) should not fetch ────────

  it("does not fetch when connectivity reports online without an offline→online transition", async () => {
    mockReadCachedEntitlement.mockResolvedValue(freshEntitlement());

    const wrapper = makeAuthWrapper({
      isBootstrapping: false,
      userId: "user-1",
    });
    const { result } = renderHook(() => useTrialValidation(), { wrapper });

    await waitFor(() => expect(result.current.isBootstrapping).toBe(false));
    expect(mockFetchTrialEntitlement).not.toHaveBeenCalled();

    // Two "online" events back-to-back — no transition.
    await act(async () => {
      capturedNetworkListener!({ isConnected: true });
    });
    await act(async () => {
      capturedNetworkListener!({ isConnected: true });
    });

    await new Promise((resolve) => setImmediate(resolve));
    expect(mockFetchTrialEntitlement).not.toHaveBeenCalled();
  });
```

- [x] **Step 9: Add regression test — signed-out user should NOT fetch on connectivity change**

Append after Case 17:

```ts
  // ─── Case 18: Network offline→online while signed out should not fetch ──────

  it("does not fetch when connectivity transitions offline→online and the user is signed out", async () => {
    mockReadCachedEntitlement.mockResolvedValue(null);

    const wrapper = makeAuthWrapper({ isBootstrapping: false, userId: null });
    const { result } = renderHook(() => useTrialValidation(), { wrapper });

    await waitFor(() => expect(result.current.isBootstrapping).toBe(false));
    expect(mockFetchTrialEntitlement).not.toHaveBeenCalled();

    await act(async () => {
      capturedNetworkListener!({ isConnected: false });
    });
    await act(async () => {
      capturedNetworkListener!({ isConnected: true });
    });

    await new Promise((resolve) => setImmediate(resolve));
    expect(mockFetchTrialEntitlement).not.toHaveBeenCalled();
  });
```

- [x] **Step 10: Add cleanup test — subscription is removed on unmount**

Append after Case 18:

```ts
  // ─── Case 19: Network listener subscription is removed on unmount ──────────

  it("removes the network listener subscription when the hook unmounts", async () => {
    mockReadCachedEntitlement.mockResolvedValue(freshEntitlement());
    const remove = jest.fn();
    mockAddNetworkStateListener.mockImplementation((listener) => {
      capturedNetworkListener = listener;
      return { remove };
    });

    const wrapper = makeAuthWrapper({
      isBootstrapping: false,
      userId: "user-1",
    });
    const { unmount } = renderHook(() => useTrialValidation(), { wrapper });

    await waitFor(() => expect(mockAddNetworkStateListener).toHaveBeenCalled());

    unmount();
    expect(remove).toHaveBeenCalled();
  });
```

- [x] **Step 11: Run the full trial test file**

Run: `npm test -- src/features/trial/__tests__/hooks.test.tsx`

Expected: PASS — 19 tests total (9 original + 4 from Task 3 + 6 from Task 4).

- [x] **Step 12: Run typecheck**

Run: `npm run typecheck`

Expected: clean.

- [x] **Step 13: Run the full test suite to catch any cross-file regressions**

Run: `npm test`

Expected: all suites pass. (Reminder from memory: `srhi` full-run flakiness pre-exists and is unrelated; if it surfaces, re-run that suite isolated to confirm.)

- [x] **Step 14: Commit**

```bash
git add src/features/trial/hooks.tsx src/features/trial/__tests__/hooks.test.tsx
git commit -m "fix(trial): auto-recover read-only state on offline->online transition"
```

---

## Task 5: Manual smoke verification

The beta is already on TestFlight per the memory state. This change touches the trial validation lifecycle, so a quick device smoke before merging is worth the time. Both code paths can be exercised with airplane mode.

**No code changes in this task.** This is the verification gate before merging.

- [ ] **Step 1: Reproduce the original trap, then verify Task 3's fix**

On a device or emulator with a signed-in account:
1. Force-stop the app to clear in-memory state.
2. Clear app data (Android: Settings → Apps → Habits → Storage → Clear Data, OR iOS: delete & reinstall) so `readCachedEntitlement` returns `null`.
3. Enable airplane mode.
4. Open the app. Expected: bootstrap completes, ReadOnlyBanner appears.
5. Disable airplane mode (but keep the app foregrounded).
6. **Expected (Task 4 path):** within a few seconds, the ReadOnlyBanner disappears and full access returns. If it does, both paths effectively pass — connectivity restoration alone recovered.
7. If you want to specifically prove Task 3's path: instead of step 5/6, background the app while still in airplane mode, disable airplane mode, then foreground the app. Banner should disappear on foreground.

- [ ] **Step 2: Confirm no spurious refetches on fresh-cache foreground**

With a normal online sign-in and a recent successful validation:
1. Background and foreground the app several times.
2. Toggle airplane mode off→on→off without leaving the foreground.
3. **Expected:** no extra calls to the entitlement endpoint beyond what the bootstrap or 60-minute staleness already triggers. (Spot-check via the Sentry / Supabase logs if you want hard evidence; otherwise visual smoke is fine.)

- [ ] **Step 3: Confirm the manual Reconnect button still works**

Force the read-only state again, then tap **Reconnect** from the banner. Expected: revalidates and clears the banner. (Unchanged by this work, but worth confirming we didn't regress the existing path.)

---

## Self-Review

**Spec coverage:**
- Lift `!cached` guard in AppState handler → Task 3.
- Add NetInfo / connectivity-change listener → Task 4 (via `expo-network`).
- Recovery without manual tap → covered by both Task 3 (foreground edge) and Task 4 (connectivity edge).
- Preserve the `(D4)` strict invariant ("no cache → read_only") — explicitly unchanged; only triggers added.
- Don't break the existing 9 test cases — verified by Step 5 of Task 1 and Step 13 of Task 4.

**Placeholder scan:** No "TBD", "implement later", "similar to Task N", or "add appropriate error handling" left in the plan. Every code step contains the full code to write.

**Type consistency:**
- `shouldRevalidate(cached, currentTime)` — defined in Task 2 Step 1, called in Task 3 Step 3 and Task 4 Step 4 with the same name and argument order.
- `capturedAppStateListener` / `capturedNetworkListener` — declared in Task 1 Step 3, set in Task 1 Step 4, invoked in Tasks 3 and 4 with the same names.
- `mockAddNetworkStateListener` — declared in Task 1 Step 3, re-mocked in Task 4 Step 10's cleanup test using the same handle.
- `Network.NetworkStateEvent` — used in Task 1 Step 3's type annotation, matches the `expo-network` 8.0.8 export verified in `node_modules/expo-network/build/Network.types.d.ts`.
- Commit message scope — both commits use `fix(trial):` / `test(trial):`, consistent with the existing `fix(reminders): ...` convention in recent history.

**Risk notes for the executor:**
- `Network.addNetworkStateListener`'s subscribe-time replay behavior is not contractually documented across platforms. The `prevConnected = true` initialization makes the effect correct under both "fires immediately" and "doesn't fire" semantics — only an actual false→true transition triggers a fetch.
- A flapping network could fire multiple fetches in rapid succession. The current AppState handler has the same surface and we're not adding debounce here — keep the fix focused. If it ever matters, add it in a follow-up.
- The `mockFetchTrialEntitlement.mockRejectedValueOnce` then `mockResolvedValueOnce` pattern in Cases 10, 11, 14, 15 is load-bearing. The bootstrap effect calls `fetchAndCache` whenever cache is null OR stale, and `fetchAndCache` writes a successful result into both state and (via the sync effect) `cachedRef.current`. If you let the bootstrap call succeed, the cache becomes fresh and the new revalidation triggers (`shouldRevalidate`) see a fresh cache and bail — the test then asserts a fetch that never happens. Reject the bootstrap call, then resolve the revalidation call.
- Negative-path tests (Cases 12, 13, 16, 17, 18) all gate on `waitFor(() => result.current.isBootstrapping === false)` rather than `waitFor(... not.toHaveBeenCalled())`. The "not called" assertion is true at t=0 before bootstrap runs, so it doesn't actually wait for `cachedRef` to be populated. Without the explicit `isBootstrapping` gate, the trigger fires against a null `cachedRef`, `shouldRevalidate` returns `true`, and a fetch happens — flaking the test under CI load. Always gate on the hook's settled state.
- All three staleness-rule sites are consolidated into `shouldRevalidate` by Task 3 Step 4b (bootstrap, AppState handler, Network handler). The existing Cases 5 and 6 cover the bootstrap branches and must stay green after that refactor.

---

## Execution Handoff

**Plan complete and saved to `docs/superpowers/plans/2026-05-31-trial-offline-cold-start-recovery.md`. Two execution options:**

**1. Subagent-Driven (recommended)** - I dispatch a fresh subagent per task, review between tasks, fast iteration.

**2. Inline Execution** - Execute tasks in this session using executing-plans, batch execution with checkpoints.

**Which approach?**
