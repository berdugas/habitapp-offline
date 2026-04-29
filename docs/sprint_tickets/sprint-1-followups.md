# Sprint 1 — Follow-up Fixes (DEV-S1-05)

> **Status:** Ready for assignment.
> **Owner:** Tech Lead → Dev Team
> **Companion documents:** `sprint-1-tickets.md` (the S1 ticket package these follow up on), `sprint-plan.md`

This ticket cleans up five minor issues surfaced during code review of the S1 implementation. None are bugs in the strict sense — the code works — but each tightens correctness, idempotence, or cleanliness in ways that pay off as the code starts being relied on in S2+.

---

## DEV-S1-05 — Repository and test-adapter polish

**Estimate:** 0.5 day
**Depends on:** DEV-S1-01 through DEV-S1-04 (all merged on `main`)
**Branch suggestion:** `s1/followups`

### Context

S1 shipped a clean local DB layer. Code review surfaced five small refinements worth making before S2 starts touching this code. They're bundled into one ticket because each is too small to justify its own PR, and they're all in the same files (`habits.ts`, `habit_logs.ts`, `sqliteTestAdapter.ts`) plus their tests.

Issues are listed in priority order. **#1 is the only one with real bug-bait** — the others are correctness-and-idempotence polish. Do them all in one PR.

### Files to modify

```
src/lib/db/repositories/habits.ts
src/lib/db/repositories/habit_logs.ts
src/lib/db/repositories/__tests__/habits.test.ts
src/lib/db/repositories/__tests__/habit_logs.test.ts
src/tests/setup/sqliteTestAdapter.ts
```

---

### Fix 1 — `updateHabit` should not treat `undefined` as `null`

**File:** `src/lib/db/repositories/habits.ts`

**Current behavior.** The patch loop uses `if (key in patch)`, which is `true` even when the property is explicitly set to `undefined`. Combined with `patch[key] ?? null`, that means `updateHabit(id, { title: undefined })` tries to set `title = NULL` — which then fails the `NOT NULL` constraint at runtime. The error fires far from the call site, making it confusing to debug.

**Change.** Replace the guard so explicit `undefined` is treated as "don't update this field." Nullable fields can still be explicitly set to `null` (e.g. clearing `identity_phrase`), which is correct.

```ts
// Replace this:
for (const key of allowed) {
  if (key in patch) {
    sets.push(`${key} = ?`);
    params.push(patch[key] ?? null);
  }
}

// With this:
for (const key of allowed) {
  const value = patch[key];
  if (value !== undefined) {
    sets.push(`${key} = ?`);
    params.push(value);
  }
}
```

**Test update.** Add to `habits.test.ts`:

```ts
it("updateHabit ignores fields explicitly set to undefined", async () => {
  const habit = await createHabit(makeInput({ title: "Original" }));
  await updateHabit(habit.id, { title: undefined, cue: "New cue" });

  const after = await getHabit(habit.id);
  expect(after!.title).toBe("Original");   // unchanged
  expect(after!.cue).toBe("New cue");
});

it("updateHabit can explicitly clear nullable fields with null", async () => {
  const habit = await createHabit(
    makeInput({ identity_phrase: "a runner" }),
  );
  await updateHabit(habit.id, { identity_phrase: null });

  const after = await getHabit(habit.id);
  expect(after!.identity_phrase).toBeNull();
});
```

---

### Fix 2 — Remove the dead ternary in `openDatabaseAsync`

**File:** `src/tests/setup/sqliteTestAdapter.ts`

**Current behavior.** The function has `const filename = name === ":memory:" ? ":memory:" : ":memory:";` — both branches collapse to the same value. Functionally fine, but reads like a bug-in-the-making. Anyone editing later might assume the ternary does something.

**Change.** Replace with the direct call. Drop the unused `filename` local.

```ts
// Replace this:
export async function openDatabaseAsync(name: string): Promise<SQLiteDatabase> {
  const filename = name === ":memory:" ? ":memory:" : ":memory:";
  const db = new Database(filename);
  return createAdapter(db);
}

// With this:
export async function openDatabaseAsync(_name: string): Promise<SQLiteDatabase> {
  // Always open in-memory; name is ignored to keep tests fully isolated.
  const db = new Database(":memory:");
  return createAdapter(db);
}
```

**Test update.** None — pure cosmetic.

---

### Fix 3 — `listHabits` should have a stable order

**File:** `src/lib/db/repositories/habits.ts`

**Current behavior.** SQL returns rows in undefined order without `ORDER BY`. Probably-but-not-guaranteed insertion order today; not contractual. When this list backs the Today screen and Settings → Habit Management in S2, you want most-recent-first (matches user expectation).

**Change.** Append `ORDER BY created_at DESC` to the SELECT.

```ts
// Replace the return statement of listHabits:
return db.getAllAsync<Habit>(
  `SELECT * FROM local_habits
   WHERE ${conditions.join(" AND ")}
   ORDER BY created_at DESC`,
  ...params,
);
```

**Test update.** Update one existing list test to also assert order:

```ts
it("listHabits returns habits in created_at DESC order", async () => {
  const a = await createHabit(makeInput({ title: "A" }));
  await new Promise((r) => setTimeout(r, 5));
  const b = await createHabit(makeInput({ title: "B" }));
  await new Promise((r) => setTimeout(r, 5));
  const c = await createHabit(makeInput({ title: "C" }));

  const results = await listHabits({ user_id: "user-1" });
  expect(results.map((h) => h.id)).toEqual([c.id, b.id, a.id]);
});
```

---

### Fix 4 — `deleteHabit` and `deleteLog` should return whether a row was deleted

**Files:** `src/lib/db/repositories/habits.ts`, `src/lib/db/repositories/habit_logs.ts`

**Current behavior.** Both functions return `Promise<void>`. Callers can't tell whether anything was actually deleted. This bites later for analytics ("habit_deleted" should only fire on real deletion) and for any "are you sure?" confirmation flows.

**Change.** Return `Promise<boolean>` — `true` if a row was deleted, `false` if no row matched the id. No throw. Idempotent semantics preserved.

```ts
// habits.ts
export async function deleteHabit(id: string): Promise<boolean> {
  const db = getDb();
  const result = await db.runAsync(
    "DELETE FROM local_habits WHERE id = ?",
    id,
  );
  return result.changes > 0;
}

// habit_logs.ts
export async function deleteLog(id: string): Promise<boolean> {
  const db = getDb();
  const result = await db.runAsync(
    "DELETE FROM local_habit_logs WHERE id = ?",
    id,
  );
  return result.changes > 0;
}
```

**Test update.** Update existing delete tests to also assert the boolean return:

```ts
// habits.test.ts — adjust the existing deleteHabit test:
it("deleteHabit removes the row and returns true", async () => {
  const habit = await createHabit(makeInput());
  const deleted = await deleteHabit(habit.id);

  expect(deleted).toBe(true);
  expect(await getHabit(habit.id)).toBeNull();
});

it("deleteHabit returns false when the id does not exist", async () => {
  expect(await deleteHabit("does-not-exist")).toBe(false);
});

// habit_logs.test.ts — adjust the existing deleteLog test similarly:
it("deleteLog removes the row by id and returns true", async () => {
  const log = await upsertLog(makeLogInput(habitId));
  const deleted = await deleteLog(log.id);

  expect(deleted).toBe(true);
  expect(await getLog({
    habit_id: habitId,
    user_id: "user-1",
    log_date: "2026-04-29",
  })).toBeNull();
});

it("deleteLog returns false when the id does not exist", async () => {
  expect(await deleteLog("does-not-exist")).toBe(false);
});
```

---

### Fix 5 — `archiveHabit` should be idempotent

**File:** `src/lib/db/repositories/habits.ts`

**Current behavior.** Calling `archiveHabit(id)` on an already-archived habit overwrites both `archived_at` and `updated_at` to the new "now." The original archive timestamp is lost. Rare in normal flow, but easy to trigger from a UI double-tap or a retry.

**Change.** Add a status guard so `archived_at` is set exactly once. Still throw on missing id (matches `updateHabit`'s convention). On already-archived, no-op silently — the desired end state is already reached.

```ts
export async function archiveHabit(id: string): Promise<void> {
  const db = getDb();
  const now = new Date().toISOString();

  const result = await db.runAsync(
    `UPDATE local_habits
       SET status = 'archived', archived_at = ?, updated_at = ?
     WHERE id = ? AND status != 'archived'`,
    now,
    now,
    id,
  );

  if (result.changes === 0) {
    // Either the habit doesn't exist, or it's already archived.
    // Distinguish by checking existence — throw only on missing.
    const existing = await getHabit(id);
    if (!existing) {
      throw new Error(`Habit not found: ${id}`);
    }
    // Already archived; no-op.
  }
}
```

**Test updates.** Add to `habits.test.ts`:

```ts
it("archiveHabit is idempotent — re-archiving preserves the original archived_at", async () => {
  const habit = await createHabit(makeInput());
  await archiveHabit(habit.id);

  const afterFirst = await getHabit(habit.id);
  const firstArchivedAt = afterFirst!.archived_at;

  await new Promise((r) => setTimeout(r, 5));
  await archiveHabit(habit.id);

  const afterSecond = await getHabit(habit.id);
  expect(afterSecond!.archived_at).toBe(firstArchivedAt);
});

it("archiveHabit throws when the id does not exist", async () => {
  await expect(archiveHabit("does-not-exist")).rejects.toThrow(
    "does-not-exist",
  );
});
```

---

### Acceptance criteria

- All five fixes applied in a single PR.
- `npx tsc --noEmit` is clean.
- `npm test` passes — both new tests added in this ticket and the existing S1 suite.
- No changes outside the five listed files (and their test files). Specifically: do not touch `features/`, `_layout.tsx`, or any S2-territory code.
- The PR description lists which tests were added or modified and why.

### Notes for the reviewer

- Fix 4 is the only signature change. Any caller of `deleteHabit` or `deleteLog` that exists today (likely none, since S2 hasn't started) needs updating. Search for `deleteHabit(` and `deleteLog(` in the repo before merging — if there are call sites, decide ticket-by-ticket whether to handle the boolean or ignore it (`void deleteHabit(...)` works as a deliberate ignore).
- Fix 5's "no-op on already-archived" semantic is a deliberate choice. If product later wants "throw on already-archived," the change is one line. We pick no-op for now because it matches user-facing UX expectations — tapping Archive twice shouldn't surface an error.

---

*End of S1 follow-up ticket.*
