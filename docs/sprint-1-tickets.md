# Sprint 1 — Dev Team Tickets

> **Status:** Ready for assignment.
> **Date:** April 29, 2026
> **Owner:** Tech Lead → Dev Team
> **Companion documents:** `sprint-plan.md` (S1 definition), `tech-handoff-core-v1.md` (architecture), `core-v1-requirements.md` (product behavior)

This document packages the remaining S1 work as four tickets. The DB foundation (client, migration runner, first migration, root layout wire-up) is already merged on `main` — start by reading those files before touching any of the tickets below.

---

## 0. Shared context — read before picking up a ticket

### What's already done in S1

The data-layer foundation is in place:

```
src/lib/db/
├── client.ts                  # initDb() + getDb()
├── migrations.ts              # forward-only migration runner
└── migrations/
    ├── 001_initial.ts         # local_habits, local_habit_logs, local_user_preferences
    └── index.ts               # registry of all migrations
```

`initDb()` is awaited in `app/_layout.tsx` before any route renders. By the time your code runs in any screen, hook, or service, the database is open with foreign keys enabled and migrations applied. You don't need to re-open it — call `getDb()` from `@/lib/db/client`.

### Data-layer conventions — non-negotiable

These patterns were established in sitting #1 and apply to every ticket below.

1. **`getDb()` is the only way to access the database.** Repositories never open their own connection. Services and feature modules never call SQLite directly — they go through repositories.

2. **Repositories never expose SQL.** A repository function takes typed inputs and returns typed outputs. SQL strings live inside the repository file and nowhere else. If a feature module needs a query that doesn't exist in a repo yet, *add it to the repo* — don't inline raw SQL in the feature.

3. **All repository functions are async.** Use `db.runAsync` (single statement with params), `db.getAllAsync<T>` (rows), `db.getFirstAsync<T>` (single row or null), and `db.withTransactionAsync` (multi-step atomicity). `execAsync` is for raw multi-statement SQL — repositories shouldn't need it; only the migration runner does.

4. **Timestamps are ISO 8601 strings.** `new Date().toISOString()` for every `created_at`, `updated_at`, `archived_at`, etc. Stored as TEXT in SQLite. No Date objects in the schema.

5. **`log_date` is `YYYY-MM-DD` in the device's local timezone.** Not UTC. Check `src/utils/dates.ts` for existing helpers before writing new ones — the project already has a logical-day concept (per `PROJECT_BRAIN.md` §12: *"Logical day = device local day (YYYY-MM-DD), not UTC"*).

6. **IDs are UUIDs generated client-side.** Use `crypto.randomUUID()` (works in React Native 0.71+). If you hit any environment that doesn't support it, fall back to `expo-crypto.randomUUID()` — but try `crypto` first.

7. **Errors propagate; repositories don't swallow.** If a query throws, let it. The caller decides how to handle (retry, surface to user, log). Use `@/services/logger` only for genuine fire-and-forget conditions.

8. **Migration files are immutable once merged.** To change schema, write a new migration. Never edit `001_initial.ts` after this point. Same forward-only rule as Supabase migrations.

### Path aliases

`@/*` maps to `src/*`. Use `@/lib/db/client`, not relative `../../lib/db/client`. See `tsconfig.json`.

### What's still broken at runtime — and shouldn't be fixed yet

The app currently logs runtime errors like *"Could not find the table 'public.habits'"* on launch. These come from `src/features/habits/api.ts`, `src/features/habits/hooks.ts`, and `src/providers/AuthBootstrap.tsx` (the "best-effort user profile upsert"). **Do not fix these in S1.** They are S2's job — S2 rewrites those modules to use the repositories you build in DEV-S1-01.

If a screen crashes during your manual smoke test for these tickets, that's expected. As long as your repository code works in isolation (or via a test fixture), the ticket is done.

### Sequencing

```
DEV-S1-01  Repositories                (foundation)
   │
   ├──> DEV-S1-02  Dev wipe utility    (small, can run in parallel)
   │
   └──> DEV-S1-03  Jest + SQLite infra (independent of -01, can run in parallel)
              │
              └──> DEV-S1-04  Repository tests   (depends on -01 and -03)
```

DEV-S1-01 and DEV-S1-03 can be picked up in parallel by two devs. DEV-S1-02 is tiny and can slot anywhere. DEV-S1-04 must wait for both -01 and -03.

---

## DEV-S1-01 — Implement local DB repositories

**Estimate:** 1 day
**Depends on:** sitting #1 (already merged)
**Branch suggestion:** `s1/repositories`

### Context

The DB schema is in place; nothing reads or writes through it yet. Your job is to build the typed repository layer that feature modules in S2+ will call.

### Files to create

```
src/lib/db/repositories/
├── preferences.ts
├── habits.ts
└── habit_logs.ts
```

### Required exports

#### `preferences.ts`

Backs `local_user_preferences`. Used for onboarding completion, analytics opt-out, dismissed banners, etc. Values are stored as strings — callers serialize/deserialize objects themselves.

```ts
export async function getPreference(key: string): Promise<string | null>;
export async function setPreference(key: string, value: string): Promise<void>;
export async function deletePreference(key: string): Promise<void>;
export async function listPreferences(): Promise<Preference[]>;

export type Preference = {
  key: string;
  value: string;
  updated_at: string;
};
```

`setPreference` should upsert (use `INSERT ... ON CONFLICT(key) DO UPDATE`). Always update `updated_at` on writes.

#### `habits.ts`

Backs `local_habits`. CRUD plus filtered list.

```ts
export async function createHabit(input: CreateHabitInput): Promise<Habit>;
export async function updateHabit(id: string, patch: UpdateHabitPatch): Promise<Habit>;
export async function archiveHabit(id: string): Promise<void>;
export async function getHabit(id: string): Promise<Habit | null>;
export async function listHabits(filter: HabitFilter): Promise<Habit[]>;
export async function deleteHabit(id: string): Promise<void>;

export type HabitState = "focus" | "supporting" | "automatic";
export type HabitStatus = "active" | "archived" | "backlog";

export type Habit = {
  id: string;
  user_id: string;
  title: string;
  identity_phrase: string | null;
  cue: string;
  tiny_action: string;
  minimum_viable_action: string | null;
  preferred_time_window: string | null;
  habit_state: HabitState;
  status: HabitStatus;
  start_date: string;       // YYYY-MM-DD
  created_at: string;       // ISO 8601
  updated_at: string;       // ISO 8601
  archived_at: string | null;
  automated_at: string | null;
  backlog_at: string | null;
};

export type CreateHabitInput = Omit<
  Habit,
  "id" | "created_at" | "updated_at" | "archived_at" | "automated_at" | "backlog_at"
> & {
  // Optional overrides for default values; usually omitted.
  habit_state?: HabitState;
  status?: HabitStatus;
};

export type UpdateHabitPatch = Partial<
  Pick<
    Habit,
    | "title"
    | "identity_phrase"
    | "cue"
    | "tiny_action"
    | "minimum_viable_action"
    | "preferred_time_window"
    | "habit_state"
    | "status"
    | "automated_at"
    | "backlog_at"
  >
>;

export type HabitFilter = {
  user_id: string;                  // required — never list across users
  habit_state?: HabitState | HabitState[];
  status?: HabitStatus | HabitStatus[];
};
```

Behavior notes:

- `createHabit` generates `id`, sets `created_at` and `updated_at` to now. If `habit_state` or `status` not provided, use SQL defaults (`focus`, `active`).
- `updateHabit` always bumps `updated_at` on success. Throws if no row matches `id`.
- `archiveHabit` is a thin wrapper: `updateHabit(id, { status: 'archived' })` plus setting `archived_at = now`. Easier as its own function so callers don't have to remember the timestamp.
- `listHabits` requires `user_id` — non-optional in the type. The user_id check is the only data isolation we have locally.
- `deleteHabit` is a hard delete (used in S18 account deletion). `archiveHabit` is the soft path; this is the hard one.

#### `habit_logs.ts`

Backs `local_habit_logs`. Upsert is the primary operation — daily logging writes one row per (user, habit, day).

```ts
export async function upsertLog(input: UpsertLogInput): Promise<HabitLog>;
export async function getLog(args: {
  habit_id: string;
  user_id: string;
  log_date: string;
}): Promise<HabitLog | null>;
export async function listLogs(args: {
  habit_id: string;
  from_date?: string;       // inclusive, YYYY-MM-DD
  to_date?: string;         // inclusive, YYYY-MM-DD
  limit?: number;
}): Promise<HabitLog[]>;
export async function listLogsByUser(args: {
  user_id: string;
  from_date?: string;
  to_date?: string;
}): Promise<HabitLog[]>;
export async function deleteLog(id: string): Promise<void>;

export type LogStatus = "done" | "skipped" | "missed";

export type HabitLog = {
  id: string;
  habit_id: string;
  user_id: string;
  log_date: string;         // YYYY-MM-DD
  status: LogStatus;
  note: string | null;
  created_at: string;
  updated_at: string;
};

export type UpsertLogInput = {
  habit_id: string;
  user_id: string;
  log_date: string;
  status: LogStatus;
  note?: string | null;
};
```

Behavior notes:

- `upsertLog` uses `INSERT ... ON CONFLICT(user_id, habit_id, log_date) DO UPDATE`. On conflict, update `status`, `note`, and `updated_at`. Return the resulting row.
- `listLogs` defaults to descending `log_date` order. Apply `from_date` / `to_date` only when provided.
- **Do NOT add 48-hour validation here.** That's S2 work — `upsertHabitLog` in `features/habits/api.ts` will enforce the window before calling this repo. Repositories are dumb and trustworthy; product rules live one layer up.

### Acceptance criteria

- All three files exist with the exact exports listed above.
- TypeScript strict mode passes (`npx tsc --noEmit` is clean).
- Every function uses `getDb()` — no `SQLite.openDatabaseAsync` calls outside `client.ts`.
- No raw SQL outside the three repository files (and `migrations/`).
- Manual smoke test from a debug REPL or a temporary screen:
  - Create a habit → returns Habit object with `id`, `created_at`, `updated_at` populated
  - Update the habit → returned `updated_at` is later than `created_at`
  - Upsert a log for today → row exists in `local_habit_logs`
  - Upsert again with different status → row still has unique key, status changed, `updated_at` bumped
  - List logs for the habit → returns the log
  - Archive habit → `status='archived'`, `archived_at` set
  - Delete habit → log row also gone (FK cascade)

### References

- `docs/tech-handoff-core-v1.md` §4 (table DDL), §5 (repository pattern)
- `src/lib/db/migrations/001_initial.ts` (the actual schema you're working against)
- `src/lib/db/client.ts` (the DB handle)
- `src/utils/dates.ts` (date helpers — check before writing new ones)

### Out of scope

- 3-active cap enforcement (product rule, S2)
- 48-hour log validation (product rule, S2)
- Streak math (S2)
- React Query hooks (S2)
- UI changes
- Tests (DEV-S1-04)

---

## DEV-S1-02 — Dev-only DB wipe utility

**Estimate:** 0.5 day
**Depends on:** sitting #1 (already merged)
**Branch suggestion:** `s1/dev-wipe`

### Context

During development we'll occasionally need to reset the local DB — typically when a migration changes shape during development before being merged, or when a dev's local state goes weird. We want a one-liner instead of "uninstall the app and re-launch."

### Files to create

```
src/lib/db/devWipe.ts
```

### Required exports

```ts
/**
 * Closes the current DB connection and deletes the underlying SQLite
 * file. Next call to initDb() recreates everything from scratch.
 *
 * Dev-only — no-ops in production builds (gated behind __DEV__).
 */
export async function wipeLocalDb(): Promise<void>;
```

### Implementation notes

- Gate with `if (!__DEV__) return;` at the top. We don't want this reachable from prod regardless of import paths.
- Close the cached DB instance via the existing client (you may need to add a `closeDb()` export to `client.ts` — that's allowed; document it in the same PR).
- Use `SQLite.deleteDatabaseAsync(DB_NAME)` from `expo-sqlite`.
- Reset the cached `dbInstance` and `initPromise` in `client.ts` to `null` so the next `initDb()` opens fresh.
- Log via `@/services/logger` so a dev sees confirmation.

### How devs will invoke this

Two acceptable patterns; pick whichever is least friction:

1. Expose a debug screen behind a long-press on app version in Settings. Calls `wipeLocalDb()` then prompts a manual app reload.
2. Export from a debug helper that can be invoked from a Metro REPL or a temp button in dev-only screens.

Either is fine. Don't ship a button to prod.

### Acceptance criteria

- File exists, exports `wipeLocalDb()`.
- Calling `wipeLocalDb()` and re-launching the app produces the migration logs as if first launch (`DB migrations: applying pending`).
- Function returns early without effect in non-dev builds.
- TypeScript strict passes.

### References

- `src/lib/db/client.ts` (lifecycle pattern)
- expo-sqlite `deleteDatabaseAsync` API

---

## DEV-S1-03 — Jest infrastructure for SQLite tests

**Estimate:** 1 day
**Depends on:** sitting #1 (already merged)
**Branch suggestion:** `s1/test-infra`

### Context

`expo-sqlite` is a native module. Jest runs in Node. The two don't talk. To run repository tests in CI, we swap the SQLite implementation for `better-sqlite3` (a real synchronous SQL backend in Node) when tests run, and wrap it in an adapter that matches the `expo-sqlite` async API surface.

This is one of the trickier setups in the project. Get it right once, and every future test that touches the DB benefits.

### Files to create / modify

```
package.json                                        # add better-sqlite3 to devDependencies
jest.config.js                                      # add moduleNameMapper for expo-sqlite
src/tests/setup/sqliteTestAdapter.ts                # the adapter (the real work)
src/tests/setup/createTestDb.ts                     # helper: in-memory DB + migrations applied
src/tests/setup/sqliteTestAdapter.test.ts          # sanity test for the adapter itself
```

### Approach

The expo-sqlite API surface we use:

```ts
SQLite.openDatabaseAsync(name): Promise<SQLiteDatabase>
SQLite.deleteDatabaseAsync(name): Promise<void>

db.execAsync(sql): Promise<void>                    // multi-statement
db.runAsync(sql, ...params): Promise<{ lastInsertRowId, changes }>
db.getAllAsync<T>(sql, ...params): Promise<T[]>
db.getFirstAsync<T>(sql, ...params): Promise<T | null>
db.withTransactionAsync(asyncTask: () => Promise<void>): Promise<void>
db.closeAsync?(): Promise<void>
```

`better-sqlite3` is synchronous and uses a different API (`db.exec`, `db.prepare(sql).run/all/get`, `db.transaction`). The adapter wraps each better-sqlite3 method in `Promise.resolve(...)` so it matches the async signature.

For in-memory DBs, `better-sqlite3` accepts `:memory:` as the filename. Each test gets a fresh in-memory DB so tests are fully isolated.

### Required exports

```ts
// src/tests/setup/createTestDb.ts
/**
 * Creates a fresh in-memory SQLite DB, runs all registered migrations
 * against it, and returns the (adapter-wrapped) connection. Each call
 * returns an isolated DB — perfect for `beforeEach`.
 */
export async function createTestDb(): Promise<SQLiteDatabase>;
```

### Jest config

Use `moduleNameMapper` to redirect `expo-sqlite` imports to the adapter:

```js
// jest.config.js
moduleNameMapper: {
  "^expo-sqlite$": "<rootDir>/src/tests/setup/sqliteTestAdapter",
}
```

### Acceptance criteria

- `better-sqlite3` is in `devDependencies`.
- `jest.config.js` redirects `expo-sqlite` to the adapter in the test environment.
- `createTestDb()` returns a working DB with migration 001 already applied. Verifiable via `SELECT * FROM schema_migrations` returning one row.
- Sample test in `sqliteTestAdapter.test.ts` covers: open, exec multi-statement, run with params, getAll, getFirst, withTransactionAsync (including rollback on throw).
- `npm test` exits 0 with the sample test passing.
- The adapter does NOT leak test-only methods or types into production import paths — production code still imports from `expo-sqlite` and gets the real thing.

### Notes / gotchas

- `better-sqlite3` requires a native build on install. On Windows machines, devs may need Python and Visual Studio Build Tools. Document this in `README.md` if the team isn't already set up.
- `withTransactionAsync` semantics: better-sqlite3's `db.transaction(fn)` is sync. To match expo-sqlite's async pattern, the adapter needs to manually handle BEGIN / COMMIT / ROLLBACK using `db.exec` and try/catch around the user's async callback. Don't use `db.transaction()` directly — it requires sync callbacks.
- `lastInsertRowId` differs by type — better-sqlite3 returns `number | bigint`. Coerce to number for compatibility.

### References

- expo-sqlite docs (current version: ~16.0.10 in this project)
- better-sqlite3 docs
- `src/lib/db/migrations.ts` — what the adapter must satisfy

### Out of scope

- Actual repository tests (DEV-S1-04)
- E2E / screen / integration tests (later sprints)
- Mocking React Native components or other native modules

---

## DEV-S1-04 — Repository unit tests

**Estimate:** 1 day
**Depends on:** DEV-S1-01 + DEV-S1-03
**Branch suggestion:** `s1/repo-tests`

### Context

With repositories built (DEV-S1-01) and the test infra working (DEV-S1-03), write the test suites. Every repository function gets at least one happy-path test; constraint and edge cases get dedicated tests where they matter.

### Files to create

```
src/lib/db/repositories/__tests__/
├── preferences.test.ts
├── habits.test.ts
└── habit_logs.test.ts
```

### Required test cases

#### `preferences.test.ts`

- `getPreference` returns `null` for missing key
- `setPreference` then `getPreference` round-trips the value
- `setPreference` on existing key updates the value (and bumps `updated_at`)
- `deletePreference` removes the row; subsequent `getPreference` returns null
- `listPreferences` returns all rows

#### `habits.test.ts`

- `createHabit` returns a habit with `id`, `created_at`, `updated_at` populated
- `createHabit` defaults to `habit_state='focus'`, `status='active'` when not specified
- `updateHabit` changes specified fields and bumps `updated_at`
- `updateHabit` throws when id doesn't exist
- `archiveHabit` sets `status='archived'` and `archived_at`
- `getHabit` returns `null` for missing id
- `listHabits` filters by `user_id` (other users' habits not returned)
- `listHabits` filters by `habit_state` (single value and array)
- `listHabits` filters by `status`
- `deleteHabit` removes the row
- `deleteHabit` cascades to `local_habit_logs` (verify by inserting a log first)
- Inserting with invalid `habit_state` (e.g. `'foo'`) is rejected by CHECK constraint
- Inserting with invalid `status` is rejected by CHECK constraint

#### `habit_logs.test.ts`

- `upsertLog` inserts a new row when (user, habit, date) is unique
- `upsertLog` updates the existing row when (user, habit, date) collides — same `id`, new status, bumped `updated_at`
- `getLog` returns the log for matching args; `null` otherwise
- `listLogs` returns logs in descending `log_date` order
- `listLogs` with `from_date` / `to_date` filters correctly (boundary inclusive)
- `listLogs` with `limit` returns at most that many rows
- `listLogsByUser` returns logs across multiple habits for one user
- `deleteLog` removes by id
- Inserting with invalid `status` is rejected by CHECK constraint
- Inserting a log for a `habit_id` that doesn't exist is rejected by FK constraint (with foreign keys ON)

### Acceptance criteria

- All three test files exist with the cases listed above.
- `npm test` exits 0; all tests pass.
- Each test uses a fresh in-memory DB via `createTestDb()` — no test pollutes another.
- No `console.error` or unhandled promise rejections during the test run.
- Test names are descriptive (`it("returns null when key is missing", …)`, not `it("test 1", …)`).

### Notes

- `crypto.randomUUID()` may need polyfilling in the Node test environment. If you hit issues, use `randomUUID` from Node's `node:crypto` module via the adapter, or stub it in test setup.
- Use `beforeEach` to call `createTestDb()` and store the connection on a test-scoped variable. Don't share DBs across tests.
- If you find yourself wanting to test product rules (3-active cap, 48-hour window, streak math) — stop. Those are S2 tests. This ticket only covers repository behavior.

### References

- DEV-S1-01 (the repositories under test)
- DEV-S1-03 (`createTestDb`, the test infra)

### Out of scope

- Integration tests (multiple repos at once)
- Testing the migration runner itself (covered by sample test in DEV-S1-03)
- Streak math, eligibility, recovery flow tests (later sprints)

---

## Definition of S1 done

S1 is complete when **all four tickets** are merged AND:

1. `npx tsc --noEmit` is clean.
2. `npm test` passes.
3. The app launches, runs migration 001, and produces the expected logs (already verified — sitting #1).
4. A dev can open `src/lib/db/repositories/habits.ts` and call `createHabit` from a debug REPL, get a row in `local_habits`, and read it back via `getHabit`.

After S1 closes, S2 begins: rewriting `src/features/habits/api.ts` against these repositories and replacing the strict streak rule with the forgiving streak.

---

*End of S1 ticket package.*
