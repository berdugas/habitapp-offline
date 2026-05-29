# Goal Wording Fix + Goal Editing Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Stop the app from force-inserting "a"/"an" into a typed goal, and let people edit a goal's wording from the goal page (renaming it across all its habits).

**Architecture:** A "goal" is not a record — it is the set of `local_habits` rows sharing an `identity_phrase` string (the only table with that column). Displayed as `Become {identity_phrase}`. The fix has two halves: (1) simplify `normaliseBecomingPhrase` to clean-but-not-article-prepend, plus a shared validity helper; (2) add a goal-level `renameGoal` down the existing UI→api→repo layering, surfaced as an inline editor on the live goal page, with an analytics-id alias carried over before navigation.

**Tech Stack:** React Native (Expo), expo-router, expo-sqlite, TanStack Query v5, Jest + jest-expo + @testing-library/react-native, TypeScript.

**Spec:** `docs/superpowers/specs/2026-05-29-goal-wording-and-editing-design.md`

**Conventions for every task:**
- Run a single test file with `npx jest <path>`; add `-t "<name>"` to run one case.
- Run `npm run typecheck` before each commit.
- Commit after each task once its tests + typecheck pass.

---

## File Structure

- `src/utils/normalisePhrase.ts` (modify) — remove article-prepend; add `MAX_IDENTITY_PHRASE_LENGTH` + `isValidIdentityPhraseDraft`. One responsibility: clean/validate a typed identity phrase.
- `src/tests/unit/normalisePhrase.test.ts` (modify) — rewrite expectations.
- `src/services/goalIdRegistry.ts` (modify) — add `aliasGoalId`.
- `src/tests/unit/goalIdRegistry.test.ts` (modify) — add alias tests.
- `src/lib/db/repositories/habits.ts` (modify) — add `renameGoal` + `goalExists`.
- `src/lib/db/repositories/__tests__/habits.test.ts` (modify) — repo tests.
- `src/features/habits/api.ts` (modify) — add `renameGoal` + `goalExists` wrappers.
- `src/features/habits/__tests__/api.test.ts` (modify) — api-level tests.
- `src/features/habits/hooks.ts` (modify) — add `useRenameGoalMutation`.
- `src/features/habits/__tests__/useRenameGoalMutation.test.tsx` (create) — hook test.
- `src/features/today/screens/GoalDetailScreen.tsx` (modify) — inline editor + save/guard/merge/navigate.
- `src/features/today/__tests__/GoalDetailScreen.test.tsx` (modify) — edit-flow tests + mock updates.
- `src/features/habits/screens/CreateHabitFlow.tsx` (modify) — gate via helper; fix label/placeholder.
- `src/features/onboarding/screens/BecomingScreen.tsx` (modify) — gate via helper.
- `src/features/habits/screens/EditHabitScreen.tsx` (modify) — make the goal hint a link to the goal page.
- `src/tests/screen/EditHabitScreen.test.tsx` (modify) — hint-link test + router.push mock.

---

## Task 1: Grammar core + identity-phrase validity helper

**Files:**
- Modify: `src/utils/normalisePhrase.ts`
- Test: `src/tests/unit/normalisePhrase.test.ts`

- [ ] **Step 1: Rewrite the test file for the new behaviour**

Replace the entire contents of `src/tests/unit/normalisePhrase.test.ts` with:

```ts
import {
  isValidIdentityPhraseDraft,
  normaliseBecomingPhrase,
} from "@/utils/normalisePhrase";

describe("normaliseBecomingPhrase", () => {
  it("keeps a plain noun as typed (no article added)", () => {
    expect(normaliseBecomingPhrase("runner")).toBe("runner");
  });

  it("lowercases a capitalised phrase", () => {
    expect(normaliseBecomingPhrase("Healthy Guy")).toBe("healthy guy");
  });

  it("keeps a vowel-initial phrase as typed (no 'an' added)", () => {
    expect(normaliseBecomingPhrase("active person")).toBe("active person");
  });

  it("preserves a leading article the user typed", () => {
    expect(normaliseBecomingPhrase("a runner")).toBe("a runner");
    expect(normaliseBecomingPhrase("An honest person")).toBe("an honest person");
    expect(normaliseBecomingPhrase("the focused parent")).toBe("the focused parent");
  });

  it("preserves 'someone who' / 'people who' forms", () => {
    expect(normaliseBecomingPhrase("someone who reads daily")).toBe("someone who reads daily");
    expect(normaliseBecomingPhrase("people who exercise")).toBe("people who exercise");
  });

  it("trims surrounding whitespace", () => {
    expect(normaliseBecomingPhrase("  runner  ")).toBe("runner");
  });

  it("collapses internal whitespace", () => {
    expect(normaliseBecomingPhrase("better  partner")).toBe("better partner");
  });

  it("returns empty string for blank input", () => {
    expect(normaliseBecomingPhrase("   ")).toBe("");
  });

  it("strips 'I am a ' / 'I am ' lead-ins without adding an article", () => {
    expect(normaliseBecomingPhrase("I am a runner")).toBe("a runner");
    expect(normaliseBecomingPhrase("I am runner")).toBe("runner");
  });

  it("strips 'I'm a ' / 'I'm ' lead-ins", () => {
    expect(normaliseBecomingPhrase("I'm a runner")).toBe("a runner");
    expect(normaliseBecomingPhrase("I'm runner")).toBe("runner");
  });

  it("strips 'Become a ' / 'Becoming a ' lead-ins", () => {
    expect(normaliseBecomingPhrase("Become a runner")).toBe("a runner");
    expect(normaliseBecomingPhrase("Becoming a runner")).toBe("a runner");
  });

  it("strips 'I want to be a ' / 'I want to become a ' lead-ins", () => {
    expect(normaliseBecomingPhrase("I want to be a runner")).toBe("a runner");
    expect(normaliseBecomingPhrase("I want to become a better reader")).toBe("a better reader");
  });

  it("strips a lead-in and preserves the 'someone who' form", () => {
    expect(normaliseBecomingPhrase("I am someone who reads daily")).toBe("someone who reads daily");
  });

  it("handles mixed case 'BECOME a runner'", () => {
    expect(normaliseBecomingPhrase("BECOME a runner")).toBe("a runner");
  });

  it("regression: adjectives and verb phrases are no longer mangled with 'a'", () => {
    expect(normaliseBecomingPhrase("healthy")).toBe("healthy");
    expect(normaliseBecomingPhrase("read the bible")).toBe("read the bible");
  });
});

describe("isValidIdentityPhraseDraft", () => {
  it("accepts a cleaned phrase of length >= 2", () => {
    expect(isValidIdentityPhraseDraft("healthy")).toBe(true);
    expect(isValidIdentityPhraseDraft("ab")).toBe(true);
  });

  it("rejects input that cleans to fewer than 2 chars", () => {
    expect(isValidIdentityPhraseDraft("")).toBe(false);
    expect(isValidIdentityPhraseDraft("   ")).toBe(false);
    expect(isValidIdentityPhraseDraft("a")).toBe(false);
    // "become a" strips the "become " lead-in -> "a" (1 char)
    expect(isValidIdentityPhraseDraft("become a")).toBe(false);
  });

  it("rejects a cleaned phrase longer than the 240-char cap", () => {
    expect(isValidIdentityPhraseDraft("x".repeat(240))).toBe(true);
    expect(isValidIdentityPhraseDraft("x".repeat(241))).toBe(false);
  });
});
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `npx jest src/tests/unit/normalisePhrase.test.ts`
Expected: FAIL — `isValidIdentityPhraseDraft` is not exported, and the existing "runner" → "a runner" expectations no longer match the (still article-prepending) implementation.

- [ ] **Step 3: Rewrite the implementation**

Replace the entire contents of `src/utils/normalisePhrase.ts` with:

```ts
// Ordered longest-first to prevent shorter prefixes swallowing part of a longer one
const STRIP_PREFIXES = [
  "i want to become ",
  "i want to be ",
  "i am going to be ",
  "i'm going to be ",
  "i am ",
  "i'm ",
  "becoming ",
  "become ",
];

// The longest an identity phrase may be once cleaned. Matches the existing
// identity_phrase cap enforced by the habit validator (src/features/habits/
// validators.ts), so create / edit / rename all agree on the limit.
export const MAX_IDENTITY_PHRASE_LENGTH = 240;

/**
 * Clean a user-typed identity phrase: trim, collapse internal whitespace,
 * lowercase, and strip redundant sentence-starters ("become", "I want to be",
 * etc.). The cleaned value is used verbatim after the "Become " display prefix,
 * so we deliberately do NOT insert an article — typing "healthy" yields
 * "Become healthy", and a user who wants "Become a runner" types the "a".
 *
 * Lowercasing is intentional: it keeps "Read the Bible" and "read the bible"
 * from fragmenting into two separate goals (goals are grouped by exact phrase),
 * and matches the app's established lowercase identity style.
 */
export function normaliseBecomingPhrase(raw: string): string {
  const trimmed = raw.trim().replace(/\s+/g, " ");
  if (!trimmed) return trimmed;

  let core = trimmed.toLowerCase();

  for (const prefix of STRIP_PREFIXES) {
    if (core.startsWith(prefix)) {
      core = core.slice(prefix.length).trimStart();
      break;
    }
  }

  return core;
}

/**
 * True when a typed draft cleans to a usable identity phrase: at least 2
 * characters and no longer than the cap. Validates the CLEANED value, not the
 * raw input — "become a" passes a naive raw length check but cleans to "a".
 */
export function isValidIdentityPhraseDraft(raw: string): boolean {
  const cleaned = normaliseBecomingPhrase(raw);
  return cleaned.length >= 2 && cleaned.length <= MAX_IDENTITY_PHRASE_LENGTH;
}
```

- [ ] **Step 4: Run the test to verify it passes**

Run: `npx jest src/tests/unit/normalisePhrase.test.ts`
Expected: PASS (all cases green).

- [ ] **Step 5: Typecheck and commit**

```bash
npm run typecheck
git add src/utils/normalisePhrase.ts src/tests/unit/normalisePhrase.test.ts
git commit -m "fix(goal): stop auto-inserting articles in identity phrase; add validity helper"
```

---

## Task 2: Analytics id alias (`aliasGoalId`)

**Files:**
- Modify: `src/services/goalIdRegistry.ts`
- Test: `src/tests/unit/goalIdRegistry.test.ts`

- [ ] **Step 1: Add the failing tests**

Append this `describe` block to the end of `src/tests/unit/goalIdRegistry.test.ts` (and add `aliasGoalId` to the existing import from `@/services/goalIdRegistry` at the top of the file):

```ts
describe("aliasGoalId (rename id carry-over)", () => {
  it("carries the source id to a brand-new target phrase", () => {
    const oldId = goalIdFor("a healthy");
    aliasGoalId("a healthy", "healthy");
    expect(goalIdFor("healthy")).toBe(oldId);
  });

  it("does not overwrite an existing target id (target wins on merge)", () => {
    const targetId = goalIdFor("a runner");
    goalIdFor("jogger");
    aliasGoalId("jogger", "a runner");
    expect(goalIdFor("a runner")).toBe(targetId);
  });

  it("is a no-op when the source phrase has no id yet", () => {
    aliasGoalId("never seen", "fresh name");
    // The new phrase still mints its own valid id on first read.
    expect(goalIdFor("fresh name")).toMatch(/^[0-9a-f]{8}$/);
  });

  it("makes the carried id available synchronously (before persistence flushes)", () => {
    const oldId = goalIdFor("old");
    aliasGoalId("old", "new");
    // No await: the in-memory write must already be visible.
    expect(goalIdFor("new")).toBe(oldId);
  });

  it("persists the carried id after hydration", async () => {
    await initGoalIdRegistry();
    const oldId = goalIdFor("old");
    aliasGoalId("old", "new");
    await new Promise((resolve) => setTimeout(resolve, 0));
    const stored = JSON.parse((await AsyncStorage.getItem(STORAGE_KEY))!) as Record<
      string,
      string
    >;
    expect(stored["new"]).toBe(oldId);
  });
});
```

Update the import at the top of the file to include `aliasGoalId`:

```ts
import {
  __resetForTests,
  aliasGoalId,
  goalIdFor,
  initGoalIdRegistry,
  isGoalIdRegistryHydrated,
  whenGoalIdRegistryHydrated,
} from "@/services/goalIdRegistry";
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `npx jest src/tests/unit/goalIdRegistry.test.ts -t "aliasGoalId"`
Expected: FAIL — `aliasGoalId` is not exported.

- [ ] **Step 3: Implement `aliasGoalId`**

In `src/services/goalIdRegistry.ts`, add this exported function immediately after `goalIdFor` (before the `persistMap` section):

```ts
/**
 * Carry a goal's analytics id from one phrase to another when the goal is
 * renamed. Copies cachedMap[oldPhrase] to newPhrase ONLY if newPhrase is not
 * already mapped — so renaming onto an existing goal keeps that target's id
 * (the target "wins"). When the target is unmapped (brand-new name, or an
 * existing goal that was never viewed/mutated), the source id carries over so
 * funnels stay continuous. If the source itself has no id, this is a no-op and
 * the new phrase mints a fresh id on next read.
 *
 * The in-memory write is synchronous: callers rely on goalIdFor(newPhrase)
 * returning the carried id immediately, before navigating to a screen that
 * emits an event under the new phrase (see GoalDetailScreen rename → replace).
 * Persistence is fire-and-forget and gated on hydration, exactly like goalIdFor.
 */
export function aliasGoalId(oldPhrase: string, newPhrase: string): void {
  if (oldPhrase === newPhrase) return;
  if (newPhrase in cachedMap) return;
  const oldId = cachedMap[oldPhrase];
  if (!oldId) return;
  cachedMap[newPhrase] = oldId;
  if (hydrated) void persistMap();
}
```

- [ ] **Step 4: Run the test to verify it passes**

Run: `npx jest src/tests/unit/goalIdRegistry.test.ts`
Expected: PASS (new block green; existing registry tests still green).

- [ ] **Step 5: Typecheck and commit**

```bash
npm run typecheck
git add src/services/goalIdRegistry.ts src/tests/unit/goalIdRegistry.test.ts
git commit -m "feat(analytics): add aliasGoalId to carry a goal id across a rename"
```

---

## Task 3: Repo — `renameGoal` + `goalExists`

**Files:**
- Modify: `src/lib/db/repositories/habits.ts`
- Test: `src/lib/db/repositories/__tests__/habits.test.ts`

- [ ] **Step 1: Add the failing repo tests**

Add `renameGoal` and `goalExists` to the existing import from `@/lib/db/repositories/habits` at the top of `src/lib/db/repositories/__tests__/habits.test.ts`. Then add this `describe` block inside the top-level `describe("habits repository", ...)` (e.g. just before its closing `})`):

```ts
  describe("renameGoal", () => {
    it("renames identity_phrase across every status for the user", async () => {
      const active = await createHabit(makeInput({ identity_phrase: "a runner", title: "A" }));
      const backlog = await createHabit(
        makeInput({ identity_phrase: "a runner", title: "B", status: "backlog" }),
      );
      const toArchive = await createHabit(makeInput({ identity_phrase: "a runner", title: "C" }));
      await archiveHabit(toArchive.id);
      const other = await createHabit(makeInput({ identity_phrase: "a writer", title: "D" }));

      const result = await renameGoal("user-1", "a runner", "runner");

      expect(result.renamedHabitIds.sort()).toEqual(
        [active.id, backlog.id, toArchive.id].sort(),
      );
      expect((await listHabits({ user_id: "user-1", identity_phrase: "runner" })).length).toBe(3);
      expect((await listHabits({ user_id: "user-1", identity_phrase: "a runner" })).length).toBe(0);
      const writer = await getHabit(other.id);
      expect(writer!.identity_phrase).toBe("a writer");
    });

    it("is scoped to the user", async () => {
      await createHabit(makeInput({ user_id: "user-1", identity_phrase: "a runner" }));
      const theirs = await createHabit(
        makeInput({ user_id: "user-2", identity_phrase: "a runner" }),
      );

      await renameGoal("user-1", "a runner", "runner");

      const after = await getHabit(theirs.id);
      expect(after!.identity_phrase).toBe("a runner");
    });

    it("returns no ids when nothing matches the old phrase", async () => {
      const result = await renameGoal("user-1", "ghost goal", "runner");
      expect(result.renamedHabitIds).toEqual([]);
    });

    it("merges into an existing target phrase", async () => {
      await createHabit(makeInput({ identity_phrase: "a runner", title: "Src" }));
      await createHabit(makeInput({ identity_phrase: "runner", title: "Target" }));

      await renameGoal("user-1", "a runner", "runner");

      expect((await listHabits({ user_id: "user-1", identity_phrase: "runner" })).length).toBe(2);
    });
  });

  describe("goalExists", () => {
    it("returns true when any status carries the phrase", async () => {
      const h = await createHabit(makeInput({ identity_phrase: "a writer" }));
      await archiveHabit(h.id);
      expect(await goalExists("user-1", "a writer")).toBe(true);
    });

    it("returns false for an unknown phrase", async () => {
      expect(await goalExists("user-1", "nobody")).toBe(false);
    });

    it("is user-scoped", async () => {
      await createHabit(makeInput({ user_id: "user-2", identity_phrase: "a runner" }));
      expect(await goalExists("user-1", "a runner")).toBe(false);
    });
  });
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `npx jest src/lib/db/repositories/__tests__/habits.test.ts -t "renameGoal|goalExists"`
Expected: FAIL — `renameGoal` / `goalExists` are not exported.

- [ ] **Step 3: Implement the repo functions**

In `src/lib/db/repositories/habits.ts`, add these two functions after `deleteGoal` (near the other goal-level functions):

```ts
export async function renameGoal(
  userId: string,
  oldPhrase: string,
  newPhrase: string,
): Promise<{ renamedHabitIds: string[] }> {
  const db = getDb();
  const now = new Date().toISOString();

  // SELECT the affected ids (every status) BEFORE the UPDATE so the caller
  // can refresh each habit's per-habit caches — mirrors deleteGoal. A bare
  // UPDATE would only return a count.
  const rows = await db.getAllAsync<{ id: string }>(
    "SELECT id FROM local_habits WHERE user_id = ? AND identity_phrase = ?",
    userId,
    oldPhrase,
  );
  if (rows.length === 0) return { renamedHabitIds: [] };

  const ids = rows.map((r) => r.id);
  await db.withTransactionAsync(async () => {
    await db.runAsync(
      `UPDATE local_habits
         SET identity_phrase = ?, updated_at = ?
       WHERE user_id = ? AND identity_phrase = ?`,
      newPhrase,
      now,
      userId,
      oldPhrase,
    );
  });

  return { renamedHabitIds: ids };
}

export async function goalExists(
  userId: string,
  phrase: string,
): Promise<boolean> {
  const db = getDb();
  const row = await db.getFirstAsync<{ one: number }>(
    "SELECT 1 AS one FROM local_habits WHERE user_id = ? AND identity_phrase = ? LIMIT 1",
    userId,
    phrase,
  );
  return row !== null;
}
```

- [ ] **Step 4: Run the test to verify it passes**

Run: `npx jest src/lib/db/repositories/__tests__/habits.test.ts`
Expected: PASS (new blocks green; existing repo tests still green).

- [ ] **Step 5: Typecheck and commit**

```bash
npm run typecheck
git add src/lib/db/repositories/habits.ts src/lib/db/repositories/__tests__/habits.test.ts
git commit -m "feat(repo): add renameGoal (returns affected ids) and goalExists"
```

---

## Task 4: api wrappers — `renameGoal` + `goalExists`

**Files:**
- Modify: `src/features/habits/api.ts`
- Test: `src/features/habits/__tests__/api.test.ts`

- [ ] **Step 1: Add the failing api tests**

In `src/features/habits/__tests__/api.test.ts`, add `goalExists` and `renameGoal` to the import from `@/features/habits/api`. Then add this `describe` block (e.g. after the existing top-level describe body, or nested inside it alongside the other mutation tests):

```ts
  describe("renameGoal / goalExists (api)", () => {
    it("renameGoal renames every habit under the phrase and returns their ids", async () => {
      const a = await seedActiveHabit({ identity_phrase: "a runner" });
      const b = await seedActiveHabit({ identity_phrase: "a runner" });
      await seedActiveHabit({ identity_phrase: "a writer" });

      const result = await renameGoal("user-1", "a runner", "runner");

      expect(result.renamedHabitIds.sort()).toEqual([a.id, b.id].sort());
      expect((await listHabits({ user_id: "user-1", identity_phrase: "runner" })).length).toBe(2);
      expect((await listHabits({ user_id: "user-1", identity_phrase: "a writer" })).length).toBe(1);
    });

    it("goalExists reflects whether a phrase is in use for the user", async () => {
      await seedActiveHabit({ identity_phrase: "a runner" });
      expect(await goalExists("user-1", "a runner")).toBe(true);
      expect(await goalExists("user-1", "a writer")).toBe(false);
      expect(await goalExists("user-2", "a runner")).toBe(false);
    });
  });
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `npx jest src/features/habits/__tests__/api.test.ts -t "renameGoal / goalExists"`
Expected: FAIL — `renameGoal` / `goalExists` are not exported from the api module.

- [ ] **Step 3: Implement the wrappers**

In `src/features/habits/api.ts`, add `renameGoal as renameGoalRow` and `goalExists as goalExistsRow` to the existing import from `@/lib/db/repositories/habits`. Then add these wrappers near the other goal-level functions (e.g. after `listGoalHabits`):

```ts
export async function renameGoal(
  userId: string,
  oldPhrase: string,
  newPhrase: string,
): Promise<{ renamedHabitIds: string[] }> {
  // Pure pass-through: a rename touches only local_habits.identity_phrase.
  // Reminders are keyed by habit id (unchanged here), so there is no
  // OS-notification teardown to do, unlike archive/delete.
  return renameGoalRow(userId, oldPhrase, newPhrase);
}

export async function goalExists(
  userId: string,
  phrase: string,
): Promise<boolean> {
  return goalExistsRow(userId, phrase);
}
```

- [ ] **Step 4: Run the test to verify it passes**

Run: `npx jest src/features/habits/__tests__/api.test.ts`
Expected: PASS.

- [ ] **Step 5: Typecheck and commit**

```bash
npm run typecheck
git add src/features/habits/api.ts src/features/habits/__tests__/api.test.ts
git commit -m "feat(api): expose renameGoal and goalExists"
```

---

## Task 5: `useRenameGoalMutation` hook

**Files:**
- Modify: `src/features/habits/hooks.ts`
- Test (create): `src/features/habits/__tests__/useRenameGoalMutation.test.tsx`

The hook's `onSuccess` must, in order: (1) call `aliasGoalId(old, new)` synchronously so `goalIdFor(new)` is continuous; (2) refresh each renamed habit via the **surface** helper (`invalidateHabitSurfaceQueries`, not the list helper — the rows still exist and `getHabitById` must succeed); (3) emit `goal_renamed` with `goalIdFor(new)`. Navigation is the screen's job (Task 6), and because React Query awaits `onSuccess` before `mutateAsync` resolves, the alias is guaranteed to land before the screen navigates.

- [ ] **Step 1: Write the failing hook test**

Create `src/features/habits/__tests__/useRenameGoalMutation.test.tsx`:

```tsx
import { renderHook, waitFor } from "@testing-library/react-native";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import React from "react";

import { useRenameGoalMutation } from "@/features/habits/hooks";
import { __resetForTests, goalIdFor } from "@/services/goalIdRegistry";

const mockRenameGoal = jest.fn();
const mockGetHabitById = jest.fn();
jest.mock("@/features/habits/api", () => ({
  renameGoal: (...args: unknown[]) => mockRenameGoal(...args),
  getHabitById: (...args: unknown[]) => mockGetHabitById(...args),
}));

const mockTrackEvent = jest.fn();
jest.mock("@/services/analytics", () => ({
  trackEvent: (...args: unknown[]) => mockTrackEvent(...args),
}));

jest.mock("@/features/auth/hooks", () => ({
  useAuthSession: () => ({ user: { id: "user-1" } }),
}));

function wrapper({ children }: { children: React.ReactNode }) {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return <QueryClientProvider client={client}>{children}</QueryClientProvider>;
}

beforeEach(() => {
  jest.clearAllMocks();
  __resetForTests();
  mockRenameGoal.mockResolvedValue({ renamedHabitIds: ["h1"] });
  mockGetHabitById.mockResolvedValue({ id: "h1", user_id: "user-1", identity_phrase: "healthy" });
});

describe("useRenameGoalMutation", () => {
  it("renames, carries the analytics id to the new phrase, and emits goal_renamed", async () => {
    const oldId = goalIdFor("a healthy");

    const { result } = renderHook(() => useRenameGoalMutation(), { wrapper });
    await result.current.mutateAsync({ oldPhrase: "a healthy", newPhrase: "healthy" });

    await waitFor(() => {
      expect(mockRenameGoal).toHaveBeenCalledWith("user-1", "a healthy", "healthy");
    });
    // Alias carried the source id onto the new phrase.
    expect(goalIdFor("healthy")).toBe(oldId);
    // Event fired with the continuous id.
    expect(mockTrackEvent).toHaveBeenCalledWith("goal_renamed", { goal_id: oldId });
  });

  it("on a merge, keeps the existing target id and reports it (alias no-ops)", async () => {
    const targetId = goalIdFor("runner");
    goalIdFor("a healthy");

    const { result } = renderHook(() => useRenameGoalMutation(), { wrapper });
    await result.current.mutateAsync({ oldPhrase: "a healthy", newPhrase: "runner" });

    await waitFor(() => {
      expect(mockRenameGoal).toHaveBeenCalledWith("user-1", "a healthy", "runner");
    });
    // Target already had an id — it wins; the alias must not overwrite it.
    expect(goalIdFor("runner")).toBe(targetId);
    expect(mockTrackEvent).toHaveBeenCalledWith("goal_renamed", { goal_id: targetId });
  });
});
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `npx jest src/features/habits/__tests__/useRenameGoalMutation.test.tsx`
Expected: FAIL — `useRenameGoalMutation` is not exported.

- [ ] **Step 3: Implement the hook**

In `src/features/habits/hooks.ts`:

First, add the new imports. Add `renameGoal` to the existing `@/features/habits/api` import block, and add `aliasGoalId` to the existing `@/services/goalIdRegistry` import:

```ts
import { aliasGoalId, goalIdFor } from "@/services/goalIdRegistry";
```

Then add this hook (e.g. immediately after `useDeleteGoalMutation`):

```ts
export function useRenameGoalMutation() {
  const { user } = useAuthSession();
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({
      oldPhrase,
      newPhrase,
    }: {
      oldPhrase: string;
      newPhrase: string;
    }) => {
      if (!user?.id) {
        throw new Error("You need an account session before renaming a goal.");
      }
      return renameGoal(user.id, oldPhrase, newPhrase);
    },
    onSuccess: async (result, variables) => {
      if (!user?.id) return;

      // Carry the goal's analytics id to the new phrase FIRST and
      // synchronously, before the screen navigates and the remounted goal
      // page emits goal_detail_viewed under the new phrase. No-ops on a
      // merge (target keeps its id). See src/services/goalIdRegistry.ts.
      aliasGoalId(variables.oldPhrase, variables.newPhrase);

      trackEvent("goal_renamed", {
        goal_id: goalIdFor(variables.newPhrase),
      });

      // Surviving-row mutation: every renamed habit still exists (only its
      // identity_phrase changed), so refresh per-habit caches via the surface
      // helper — NOT the list helper, which forbids the getHabitById fetch.
      // The goal-scoped caches it invalidates use broad-prefix keys that omit
      // the phrase, so this one loop refreshes both the old (now empty) and
      // new (now populated) goals.
      for (const habitId of result.renamedHabitIds) {
        await invalidateHabitSurfaceQueries(user.id, habitId, queryClient);
      }
    },
    onError: (error, variables) => {
      logger.error("Goal rename mutation failed", {
        error,
        oldPhrase: variables.oldPhrase,
        newPhrase: variables.newPhrase,
        userId: user?.id ?? null,
      });
    },
  });
}
```

> Note: `goalIdFor` is already imported in `hooks.ts`; only `aliasGoalId` is new on that import line. `renameGoal` is new on the `@/features/habits/api` import line.

- [ ] **Step 4: Run the test to verify it passes**

Run: `npx jest src/features/habits/__tests__/useRenameGoalMutation.test.tsx`
Expected: PASS.

- [ ] **Step 5: Typecheck and commit**

```bash
npm run typecheck
git add src/features/habits/hooks.ts src/features/habits/__tests__/useRenameGoalMutation.test.tsx
git commit -m "feat(habits): add useRenameGoalMutation (alias-before-navigate, goal_renamed)"
```

---

## Task 6: Goal page — inline editor, save, redirect guard, merge confirm, navigation

**Files:**
- Modify: `src/features/today/screens/GoalDetailScreen.tsx`
- Test: `src/features/today/__tests__/GoalDetailScreen.test.tsx`

- [ ] **Step 1: Update the test harness mocks**

In `src/features/today/__tests__/GoalDetailScreen.test.tsx`:

1. Add `useRenameGoalMutation` to the `@/features/habits/hooks` mock factory and its `jest.requireMock` destructure:

```ts
jest.mock("@/features/habits/hooks", () => ({
  useArchiveGoalMutation: jest.fn(),
  useGoalCascadeCountQuery: jest.fn(),
  useGoalHabitCountQuery: jest.fn(),
  useRenameGoalMutation: jest.fn(),
}));
```

```ts
const {
  useArchiveGoalMutation,
  useGoalCascadeCountQuery,
  useGoalHabitCountQuery,
  useRenameGoalMutation,
} = jest.requireMock("@/features/habits/hooks") as {
  useArchiveGoalMutation: jest.Mock;
  useGoalCascadeCountQuery: jest.Mock;
  useGoalHabitCountQuery: jest.Mock;
  useRenameGoalMutation: jest.Mock;
};
```

2. Add mocks for the auth hook and the api `goalExists` (the screen newly imports both). Place these alongside the other top-of-file `jest.mock` calls:

```ts
jest.mock("@/features/auth/hooks", () => ({
  useAuthSession: () => ({ user: { id: "user-1" } }),
}));

const mockGoalExists = jest.fn();
jest.mock("@/features/habits/api", () => ({
  goalExists: (...args: unknown[]) => mockGoalExists(...args),
}));
```

3. In the `beforeEach`, give the rename mutation and `goalExists` defaults (add after the `useArchiveGoalMutation.mockReturnValue(...)` block):

```ts
  useRenameGoalMutation.mockReturnValue({
    mutate: jest.fn(),
    mutateAsync: jest.fn().mockResolvedValue({ renamedHabitIds: [] }),
    isPending: false,
  });
  mockGoalExists.mockResolvedValue(false);
```

- [ ] **Step 2: Write the failing edit-flow tests**

Add this `describe` block inside the top-level `describe("GoalDetailScreen", ...)` in the same test file:

```tsx
  describe("goal editing", () => {
    it("renames the goal and navigates to the new phrase on save", async () => {
      const renameMutateAsync = jest.fn().mockResolvedValue({ renamedHabitIds: ["h1"] });
      useRenameGoalMutation.mockReturnValue({
        mutate: jest.fn(),
        mutateAsync: renameMutateAsync,
        isPending: false,
      });
      useGoalDetail.mockReturnValue(baseDetail({ habits: [makeHabit()] }));

      renderWithClient(<GoalDetailScreen />);

      fireEvent.press(screen.getByTestId("edit-goal-button"));
      fireEvent.changeText(screen.getByTestId("goal-phrase-input"), "healthy");
      fireEvent.press(screen.getByTestId("save-goal-rename"));

      await waitFor(() => {
        expect(renameMutateAsync).toHaveBeenCalledWith({
          oldPhrase: "a reader",
          newPhrase: "healthy",
        });
      });
      expect(mockReplace).toHaveBeenCalledWith({
        pathname: "/(app)/goals/[identityPhrase]",
        params: { identityPhrase: encodeURIComponent("healthy") },
      });
      // The editor must close after a successful save. router.replace updates
      // params without necessarily remounting, so the screen relies on the
      // explicit reset in commitRename — not on a remount — to clear it.
      expect(screen.queryByTestId("goal-phrase-input")).toBeNull();
    });

    it("does not rename when the cleaned phrase is too short", async () => {
      const renameMutateAsync = jest.fn().mockResolvedValue({ renamedHabitIds: [] });
      useRenameGoalMutation.mockReturnValue({
        mutate: jest.fn(),
        mutateAsync: renameMutateAsync,
        isPending: false,
      });
      useGoalDetail.mockReturnValue(baseDetail({ habits: [makeHabit()] }));

      renderWithClient(<GoalDetailScreen />);

      fireEvent.press(screen.getByTestId("edit-goal-button"));
      fireEvent.changeText(screen.getByTestId("goal-phrase-input"), "become a");
      fireEvent.press(screen.getByTestId("save-goal-rename"));

      await waitFor(() => {
        expect(screen.getByText("Enter at least 2 characters.")).toBeTruthy();
      });
      expect(renameMutateAsync).not.toHaveBeenCalled();
    });

    it("closes without renaming when the phrase is unchanged (no-op)", async () => {
      const renameMutateAsync = jest.fn().mockResolvedValue({ renamedHabitIds: [] });
      useRenameGoalMutation.mockReturnValue({
        mutate: jest.fn(),
        mutateAsync: renameMutateAsync,
        isPending: false,
      });
      useGoalDetail.mockReturnValue(baseDetail({ habits: [makeHabit()] }));

      renderWithClient(<GoalDetailScreen />);

      fireEvent.press(screen.getByTestId("edit-goal-button"));
      // Field pre-fills with "a reader"; save unchanged.
      fireEvent.press(screen.getByTestId("save-goal-rename"));

      await waitFor(() => {
        expect(screen.queryByTestId("goal-phrase-input")).toBeNull();
      });
      expect(renameMutateAsync).not.toHaveBeenCalled();
      expect(mockReplace).not.toHaveBeenCalled();
    });

    it("confirms before merging when the target phrase already exists", async () => {
      mockGoalExists.mockResolvedValue(true);
      const alertSpy = jest
        .spyOn(require("react-native").Alert, "alert")
        .mockImplementation(() => {});
      const renameMutateAsync = jest.fn().mockResolvedValue({ renamedHabitIds: ["h1"] });
      useRenameGoalMutation.mockReturnValue({
        mutate: jest.fn(),
        mutateAsync: renameMutateAsync,
        isPending: false,
      });
      useGoalDetail.mockReturnValue(baseDetail({ habits: [makeHabit()] }));

      renderWithClient(<GoalDetailScreen />);

      fireEvent.press(screen.getByTestId("edit-goal-button"));
      fireEvent.changeText(screen.getByTestId("goal-phrase-input"), "a runner");
      fireEvent.press(screen.getByTestId("save-goal-rename"));

      await waitFor(() => {
        expect(alertSpy).toHaveBeenCalled();
      });
      // mutateAsync waits for the user to confirm in the dialog.
      expect(renameMutateAsync).not.toHaveBeenCalled();

      // Invoke the confirm button's onPress from the Alert call.
      const buttons = alertSpy.mock.calls[0][2] as { text: string; onPress?: () => void }[];
      const confirm = buttons.find((b) => b.text === "Combine");
      confirm?.onPress?.();

      await waitFor(() => {
        expect(renameMutateAsync).toHaveBeenCalledWith({
          oldPhrase: "a reader",
          newPhrase: "a runner",
        });
      });
      alertSpy.mockRestore();
    });

    it("hides the edit control in read-only mode", () => {
      const { useTrialValidation } = jest.requireMock("@/features/trial/hooks") as {
        useTrialValidation: jest.Mock;
      };
      useTrialValidation.mockReturnValue({
        accessMode: "read_only",
        isValidating: false,
        refresh: jest.fn().mockResolvedValue(undefined),
      });
      useGoalDetail.mockReturnValue(baseDetail({ habits: [makeHabit()] }));

      renderWithClient(<GoalDetailScreen />);

      expect(screen.queryByTestId("edit-goal-button")).toBeNull();
    });
  });
```

- [ ] **Step 3: Run the test to verify it fails**

Run: `npx jest src/features/today/__tests__/GoalDetailScreen.test.tsx -t "goal editing"`
Expected: FAIL — no `edit-goal-button` testID exists yet.

- [ ] **Step 4: Implement the screen changes**

In `src/features/today/screens/GoalDetailScreen.tsx`:

4a. Update imports:

```ts
import { Alert, ScrollView, StyleSheet, Text, TextInput, View, Pressable } from "react-native";
import { ChevronLeft, Pencil } from "lucide-react-native";
```

Add these imports alongside the existing ones:

```ts
import { useAuthSession } from "@/features/auth/hooks";
import { goalExists } from "@/features/habits/api";
import {
  isValidIdentityPhraseDraft,
  normaliseBecomingPhrase,
} from "@/utils/normalisePhrase";
```

Add `useRenameGoalMutation` to the existing `@/features/habits/hooks` import block (which already imports `useArchiveGoalMutation`, etc.).

4b. Inside the component, add state + the auth session + the rename mutation (near the existing `isExitingRef` / `archiveGoalMutation` declarations):

```ts
  const { user } = useAuthSession();
  const renameGoalMutation = useRenameGoalMutation();
  const [isEditingGoal, setIsEditingGoal] = useState(false);
  const [goalDraft, setGoalDraft] = useState("");
  const [renameError, setRenameError] = useState<string | null>(null);
  const renameLockRef = useRef(false);
```

4c. Add the handlers (near `confirmArchiveGoal` / `handleArchiveGoal`):

```ts
  function startEditingGoal() {
    setGoalDraft(identityPhrase ?? "");
    setRenameError(null);
    setIsEditingGoal(true);
  }

  function cancelEditingGoal() {
    setIsEditingGoal(false);
    setRenameError(null);
  }

  async function commitRename(cleaned: string) {
    if (renameLockRef.current || !identityPhrase) return;
    renameLockRef.current = true;
    // Suppress the stale-route redirect: the old phrase's habit list is about
    // to go empty, which would otherwise bounce us to Today before we
    // navigate to the renamed goal. Same guard the archive flow uses.
    isExitingRef.current = true;
    try {
      await renameGoalMutation.mutateAsync({
        oldPhrase: identityPhrase,
        newPhrase: cleaned,
      });
      // Close the editor explicitly. A param-only router.replace may re-render
      // this screen instead of remounting it, so the local editor state would
      // otherwise persist over the renamed goal. Do NOT reset isExitingRef
      // here: the route param is still the now-empty old phrase until
      // navigation lands, and re-arming the redirect guard would race a bounce
      // to Today.
      setIsEditingGoal(false);
      setGoalDraft("");
      setRenameError(null);
      router.replace({
        pathname: "/(app)/goals/[identityPhrase]",
        params: { identityPhrase: encodeURIComponent(cleaned) },
      });
    } catch {
      isExitingRef.current = false;
      renameLockRef.current = false;
      setRenameError("We couldn't rename this goal. Try again.");
    }
  }

  async function handleSaveGoalRename() {
    if (!identityPhrase || !user?.id) return;
    if (!isValidIdentityPhraseDraft(goalDraft)) {
      setRenameError("Enter at least 2 characters.");
      return;
    }
    const cleaned = normaliseBecomingPhrase(goalDraft);
    if (cleaned === identityPhrase) {
      // No-op: nothing changed after cleaning.
      cancelEditingGoal();
      return;
    }
    setRenameError(null);

    const exists = await goalExists(user.id, cleaned);
    if (exists) {
      Alert.alert(
        "Combine goals?",
        `You already have a goal called "${cleaned}". Saving will combine them.`,
        [
          { text: "Cancel", style: "cancel" },
          { text: "Combine", onPress: () => void commitRename(cleaned) },
        ],
      );
      return;
    }
    await commitRename(cleaned);
  }
```

4d. Replace the header block (the `<View style={[styles.header, ...]}>` containing the "Become …" title) so it renders either the title-with-pencil or the inline editor. Replace the existing headline `<Text>` region with:

```tsx
      {/* Header */}
      <View style={[styles.header, { paddingTop: insets.top + SCREEN_TOP_PADDING }]}>
        <Pressable hitSlop={12} onPress={() => router.back()} style={styles.backButton}>
          <ChevronLeft color={colors.textMuted} size={22} strokeWidth={1.75} />
        </Pressable>

        {isEditingGoal ? (
          <View style={styles.editGoalRow}>
            <Text style={styles.editGoalPrefix}>Become</Text>
            <TextInput
              testID="goal-phrase-input"
              style={styles.editGoalInput}
              value={goalDraft}
              onChangeText={setGoalDraft}
              autoFocus
              placeholder="healthier, a calmer person…"
              placeholderTextColor={colors.textFaint}
            />
            <Pressable
              testID="save-goal-rename"
              hitSlop={8}
              onPress={() => void handleSaveGoalRename()}
              disabled={renameGoalMutation.isPending}
            >
              <Text style={styles.editGoalSave}>Save</Text>
            </Pressable>
            <Pressable testID="cancel-goal-rename" hitSlop={8} onPress={cancelEditingGoal}>
              <Text style={styles.editGoalCancel}>Cancel</Text>
            </Pressable>
          </View>
        ) : (
          <View style={styles.headlineRow}>
            <Text
              style={[styles.headlineText, goalGraduated && styles.headlineTextGraduated]}
            >
              Become {identityPhrase ?? ""}
              {goalGraduated ? (
                <Text style={styles.graduatedSuffix}> (Graduated)</Text>
              ) : null}
            </Text>
            {!isReadOnly ? (
              <Pressable
                testID="edit-goal-button"
                hitSlop={12}
                onPress={startEditingGoal}
                style={styles.editGoalButton}
              >
                <Pencil color={colors.textMuted} size={16} strokeWidth={1.75} />
              </Pressable>
            ) : null}
          </View>
        )}

        {renameError ? <Text style={styles.renameErrorText}>{renameError}</Text> : null}
        <Text style={styles.streakCopyText}>{getStreakCopy(goalStreak)}</Text>
      </View>
```

4e. Add the new styles to the `StyleSheet.create({...})` block:

```ts
  headlineRow: {
    alignItems: "flex-start",
    flexDirection: "row",
    gap: spacing.sm,
    justifyContent: "space-between",
  },
  editGoalButton: {
    alignItems: "center",
    height: 28,
    justifyContent: "center",
    width: 28,
  },
  editGoalRow: {
    alignItems: "center",
    flexDirection: "row",
    flexWrap: "wrap",
    gap: spacing.sm,
  },
  editGoalPrefix: {
    color: colors.text,
    fontFamily: fontFamilies.bodyMedium,
    fontSize: 21,
    fontWeight: "500",
  },
  editGoalInput: {
    borderBottomColor: colors.primary,
    borderBottomWidth: 1,
    color: colors.text,
    flexGrow: 1,
    fontFamily: fontFamilies.bodyMedium,
    fontSize: 21,
    minWidth: 120,
    paddingVertical: 2,
  },
  editGoalSave: {
    color: colors.primary,
    fontFamily: fontFamilies.bodySemi,
    fontSize: typography.bodyMd,
  },
  editGoalCancel: {
    color: colors.textMuted,
    fontFamily: fontFamilies.body,
    fontSize: typography.bodyMd,
  },
  renameErrorText: {
    color: colors.danger,
    fontFamily: fontFamilies.body,
    fontSize: 12,
  },
```

- [ ] **Step 5: Run the tests to verify they pass**

Run: `npx jest src/features/today/__tests__/GoalDetailScreen.test.tsx`
Expected: PASS (new "goal editing" block green; existing GoalDetailScreen tests still green).

- [ ] **Step 6: Typecheck and commit**

```bash
npm run typecheck
git add src/features/today/screens/GoalDetailScreen.tsx src/features/today/__tests__/GoalDetailScreen.test.tsx
git commit -m "feat(goal): inline goal editing on the goal page (rename + merge confirm)"
```

---

## Task 7: Create-flow — validate cleaned value, fix label/placeholder

**Files:**
- Modify: `src/features/habits/screens/CreateHabitFlow.tsx`

The validation correctness is covered by `isValidIdentityPhraseDraft`'s unit test (Task 1); this task wires it in. The existing `CreateHabitFlow.test.tsx` starts at the "action" step (goal phrase injected via params) and never renders the goal-step gate, so no existing test changes.

- [ ] **Step 1: Import the helper**

Add `isValidIdentityPhraseDraft` to the existing import from `@/utils/normalisePhrase` in `src/features/habits/screens/CreateHabitFlow.tsx` (which already imports `normaliseBecomingPhrase`):

```ts
import {
  isValidIdentityPhraseDraft,
  normaliseBecomingPhrase,
} from "@/utils/normalisePhrase";
```

- [ ] **Step 2: Gate "Continue" on the cleaned value**

Replace the goal-step gate (currently `const canContinue = draft.identityPhrase.trim().length >= 2;`):

```ts
    const canContinue = isValidIdentityPhraseDraft(draft.identityPhrase);
```

- [ ] **Step 3: Fix the contradictory label + placeholder**

Replace the `OnboardingInput` `label`/`placeholder` on the goal step (currently `label="Become someone who..."` and `placeholder="runs regularly, reads daily..."`):

```tsx
          label="Become…"
          placeholder="a calmer person, healthier, someone who reads daily"
```

- [ ] **Step 4: Verify nothing regressed**

Run: `npx jest src/features/habits/screens/__tests__/CreateHabitFlow.test.tsx`
Expected: PASS (unchanged — the test never touches the goal step).
Run: `npm run typecheck`
Expected: no errors.

- [ ] **Step 5: Commit**

```bash
git add src/features/habits/screens/CreateHabitFlow.tsx
git commit -m "fix(create): gate goal step on cleaned value; align label with 'Become {phrase}'"
```

---

## Task 8: Onboarding — validate cleaned value

**Files:**
- Modify: `src/features/onboarding/screens/BecomingScreen.tsx`

`BecomingScreen` has the same raw-length gate (`draft.becomingPhrase.trim().length < 2`) and normalise-after pattern as the create step, so `"become a"` → `"a"` slips through there too. There is no `BecomingScreen.test.tsx`; correctness is covered by Task 1's helper unit test. The chips are already identity-style, so no copy change is needed here.

- [ ] **Step 1: Import the helper**

Add to `src/features/onboarding/screens/BecomingScreen.tsx` (it already imports `normaliseBecomingPhrase`):

```ts
import {
  isValidIdentityPhraseDraft,
  normaliseBecomingPhrase,
} from "@/utils/normalisePhrase";
```

- [ ] **Step 2: Gate "Continue" on the cleaned value**

Replace the `PrimaryButton` `disabled` prop (currently `disabled={draft.becomingPhrase.trim().length < 2}`):

```tsx
          disabled={!isValidIdentityPhraseDraft(draft.becomingPhrase)}
```

- [ ] **Step 3: Verify nothing regressed**

Run: `npm run typecheck`
Expected: no errors.
Run: `npx jest src/features/onboarding`
Expected: PASS (existing onboarding tests still green).

- [ ] **Step 4: Commit**

```bash
git add src/features/onboarding/screens/BecomingScreen.tsx
git commit -m "fix(onboarding): gate becoming step on cleaned identity value"
```

---

## Task 9: Revive the dead "change in goal settings" hint

**Files:**
- Modify: `src/features/habits/screens/EditHabitScreen.tsx`
- Test: `src/tests/screen/EditHabitScreen.test.tsx`

- [ ] **Step 1: Add `router.push` to the test's expo-router mock and write the failing test**

In `src/tests/screen/EditHabitScreen.test.tsx`, add a `push` mock to the `expo-router` factory and a `mockPush` declaration:

```ts
const mockPush = jest.fn();
```

```ts
jest.mock("expo-router", () => ({
  router: {
    replace: (...args: unknown[]) => mockReplace(...args),
    back: (...args: unknown[]) => mockBack(...args),
    push: (...args: unknown[]) => mockPush(...args),
    canGoBack: () => mockCanGoBack(),
  },
  useLocalSearchParams: () => mockUseLocalSearchParams(),
}));
```

Add this test inside `describe("EditHabitScreen", ...)`:

```tsx
  it("navigates to the goal page when the identity hint is tapped", async () => {
    renderEdit();

    await waitFor(() => {
      expect(screen.getByTestId("goal-settings-link")).toBeTruthy();
    });
    fireEvent.press(screen.getByTestId("goal-settings-link"));

    expect(mockPush).toHaveBeenCalledWith({
      pathname: "/(app)/goals/[identityPhrase]",
      params: { identityPhrase: encodeURIComponent("Become a reader") },
    });
  });
```

> The fixture's `identity_phrase` is `"Become a reader"` (`baseHabitData`), so the expected param echoes that exact stored value.

- [ ] **Step 2: Run the test to verify it fails**

Run: `npx jest src/tests/screen/EditHabitScreen.test.tsx -t "identity hint"`
Expected: FAIL — no `goal-settings-link` testID; the hint is a plain `Text`.

- [ ] **Step 3: Make the hint a navigating Pressable**

In `src/features/habits/screens/EditHabitScreen.tsx`, replace the identity-card hint `Text` (currently `<Text style={styles.identityHint}>Part of a goal · change in goal settings</Text>`) with:

```tsx
          <Pressable
            testID="goal-settings-link"
            hitSlop={8}
            onPress={() =>
              router.push({
                pathname: "/(app)/goals/[identityPhrase]",
                params: { identityPhrase: encodeURIComponent(identityPhrase) },
              })
            }
          >
            <Text style={styles.identityHint}>Part of a goal · edit on the goal page ›</Text>
          </Pressable>
```

> `Pressable` and `router` are already imported in this file. `identityPhrase` is the component's state value holding the stored phrase.

- [ ] **Step 4: Run the test to verify it passes**

Run: `npx jest src/tests/screen/EditHabitScreen.test.tsx`
Expected: PASS (new test green; existing EditHabitScreen tests still green).

- [ ] **Step 5: Typecheck and commit**

```bash
npm run typecheck
git add src/features/habits/screens/EditHabitScreen.tsx src/tests/screen/EditHabitScreen.test.tsx
git commit -m "fix(edit-habit): link the goal hint to the goal page"
```

---

## Final verification

- [ ] **Run the full suite and typecheck**

Run: `npm test`
Expected: all suites pass.
Run: `npm run typecheck`
Expected: no errors.

---

## Self-Review (author's pass against the spec)

**Spec coverage:**
- Part 1 grammar (remove article prepend, keep lowercasing) → Task 1.
- Part 1 cleaned-value validation on create AND onboarding → Tasks 1 (helper) + 7 + 8.
- Part 1 create-flow label/placeholder fix (onboarding chips already fine) → Task 7.
- Part 1 "no live preview, keep on-blur rewrite" → no task needed (on-blur rewrite is left untouched; no preview is added). ✓
- Part 2 inline editor on the live goal page, read-only hides it → Task 6.
- Part 2 save: clean + validate + no-op guard + merge confirm → Task 6.
- Part 2 redirect guard (isExitingRef before mutate) + navigate to new phrase + close the editor on success (explicit reset, not relying on remount) → Task 6.
- Part 2 revive the dead hint → Task 9.
- Part 3 repo `renameGoal` (returns ids, all statuses) + `goalExists` → Task 3.
- Part 3 api wrappers → Task 4.
- Part 3 `useRenameGoalMutation` (alias-first, surface helper, goal_renamed) → Task 5.
- Part 3 `aliasGoalId` (copy only if target unmapped) + ordering contract → Tasks 2 + 5.
- Analytics `goal_renamed` post-alias → Task 5.
- Goal-existence lookup drives the merge confirm → Tasks 3/4 (impl) + 6 (wiring).
- Testing section items → all mapped to the test steps above.

**Placeholder scan:** No TBD/TODO/"handle edge cases"/"similar to Task N" — every code step shows complete code.

**Type consistency:**
- `renameGoal` returns `{ renamedHabitIds: string[] }` in repo (Task 3), api (Task 4), and is consumed as `result.renamedHabitIds` in the hook (Task 5). ✓
- Hook variables `{ oldPhrase, newPhrase }` match the screen's `mutateAsync({ oldPhrase, newPhrase })` (Task 6) and the hook test (Task 5). ✓
- `goalExists(userId, phrase)` signature consistent across repo/api/screen. ✓
- `isValidIdentityPhraseDraft` / `normaliseBecomingPhrase` / `MAX_IDENTITY_PHRASE_LENGTH` names consistent across Tasks 1, 6, 7, 8. ✓
- `aliasGoalId(oldPhrase, newPhrase)` consistent between Task 2 and Task 5. ✓
- Route `/(app)/goals/[identityPhrase]` with `encodeURIComponent` param matches the existing convention used in Task 6 and Task 9. ✓
