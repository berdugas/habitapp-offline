# Trial Offline Grace Period — Beta Safety Bump Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Bump `TRIAL_GRACE_PERIOD_DAYS` from 7 to 90 as a beta safety net, and reparameterize the existing 7-day-boundary tests so they keep testing the *actual* boundary regardless of the constant's value. One commit, scope `chore`.

**Architecture:** Single production constant change in [src/features/trial/types.ts](src/features/trial/types.ts:26). Five reparameterizations in [src/features/trial/__tests__/grace.test.ts](src/features/trial/__tests__/grace.test.ts) (the boundary tests). One fixture reparameterization in [src/features/trial/__tests__/hooks.test.tsx](src/features/trial/__tests__/hooks.test.tsx) (`graceExhaustedEntitlement`). All test changes derive from `TRIAL_GRACE_PERIOD_DAYS`, so the constant becomes the single source of truth. **Order matters within the task:** reparameterize the tests FIRST (so they pass at the existing 7-day value, proving they aren't accidentally testing the constant), then bump the constant.

**Tech Stack:** TypeScript, React Native 0.81 (Expo SDK 54), Jest with `jest-expo` preset. Repo uses `npm` (package-lock.json present).

**Source spec:** [docs/superpowers/specs/2026-05-31-trial-grace-period-beta-bump-design.md](docs/superpowers/specs/2026-05-31-trial-grace-period-beta-bump-design.md). Read it for the "why" — this plan is just the "how."

**Scope notes:**
- Verified via grep: `TRIAL_GRACE_PERIOD_DAYS` is referenced in exactly 4 places (production: `types.ts:26`, `grace.ts:1,26`; tests: `grace.test.ts`, `hooks.test.tsx`). The `7 * 24 * 60 * 60` hardcode lives only at `grace.test.ts:59`. The `8 * 24 * 60 * 60` hardcode lives only at `hooks.test.tsx:94`. No other site needs touching.
- This change does NOT touch policy. `computeAccessMode` still ignores `entitlement_status`. The Thread A (entitlement-aware access policy), Thread B (payment integration), and Thread C (trial-end UX) work is explicitly deferred.
- The offline cold-start auto-recovery merged earlier today (`7f163ac`) is orthogonal and unaffected.

---

## File Structure

**Modified:**
- `src/features/trial/types.ts` — change the `TRIAL_GRACE_PERIOD_DAYS` value from `7` to `90`; add an inline comment tagging it for revisit when Thread A ships.
- `src/features/trial/__tests__/grace.test.ts` — add value import of `TRIAL_GRACE_PERIOD_DAYS`; reparameterize 5 boundary tests (lines 36, 46, 56, 69, 79) to derive day offsets from the constant. The "0 days" test and the "future timestamp (clock skew)" test are correctly left alone — they pass regardless of the constant's value.
- `src/features/trial/__tests__/hooks.test.tsx` — add value import of `TRIAL_GRACE_PERIOD_DAYS`; reparameterize `graceExhaustedEntitlement` fixture (lines 90-94) to use `(TRIAL_GRACE_PERIOD_DAYS + 1) * 24 * 60 * 60 * 1000`.

**No new files. No new dependencies.**

---

## Task 1: Reparameterize tests at the existing value, then bump the constant

This is one logical change, one commit. Eight steps. The order is load-bearing: by reparameterizing the tests FIRST at the existing `7`-day value, we prove the reparameterization is behavior-equivalent. Then we bump the constant and the tests automatically follow without needing edits.

**Files:**
- Modify: `src/features/trial/__tests__/hooks.test.tsx` (imports + lines 90-94)
- Modify: `src/features/trial/__tests__/grace.test.ts` (imports + 5 boundary tests)
- Modify: `src/features/trial/types.ts:26`

---

- [ ] **Step 1: Reparameterize the `graceExhaustedEntitlement` fixture in `hooks.test.tsx`**

Two edits in the same file.

**1a.** Locate the existing type-only import at line 49 (or thereabouts — find by content, not line):

```ts
import type { CachedTrialEntitlement } from "@/features/trial/types";
```

Add a sibling value import immediately above it (preserves the file's existing `import type` discipline that is visually obvious throughout):

```ts
import { TRIAL_GRACE_PERIOD_DAYS } from "@/features/trial/types";
import type { CachedTrialEntitlement } from "@/features/trial/types";
```

**1b.** Locate the `graceExhaustedEntitlement` fixture (currently around lines 90-94):

```ts
function graceExhaustedEntitlement(userId = "user-1"): CachedTrialEntitlement {
  // last_validated_at 8 days ago — beyond the 7-day grace period
  return {
    ...freshEntitlement(userId),
    last_validated_at: new Date(NOW.getTime() - 8 * 24 * 60 * 60 * 1000).toISOString(),
  };
}
```

Replace it with:

```ts
function graceExhaustedEntitlement(userId = "user-1"): CachedTrialEntitlement {
  // last_validated_at past the grace boundary (drives Case 8's
  // "fetch fails + beyond grace → read_only" assertion regardless of
  // the constant's value).
  const beyondGraceMs = (TRIAL_GRACE_PERIOD_DAYS + 1) * 24 * 60 * 60 * 1000;
  return {
    ...freshEntitlement(userId),
    last_validated_at: new Date(NOW.getTime() - beyondGraceMs).toISOString(),
  };
}
```

- [ ] **Step 2: Run `hooks.test.tsx` to confirm reparameterization is behavior-equivalent at the current 7-day value**

Run: `npm test -- src/features/trial/__tests__/hooks.test.tsx`

Expected: 19/19 tests pass. (At grace=7, `8` ↔ `7+1` produce the same numeric value, so behavior is identical. Case 8 "flips to read_only when fetch fails and cached last_validated_at is beyond grace" still asserts `read_only` as before.)

If a test fails, the reparameterization has drifted from the original semantics — STOP and re-check the math before continuing.

- [ ] **Step 3: Reparameterize the 5 boundary tests in `grace.test.ts`**

Three edits in the same file: add the import, then rewrite five `it(...)` blocks.

**3a.** Locate the existing import at line 1:

```ts
import { computeAccessMode } from "@/features/trial/grace";
```

Add a sibling import for the constant:

```ts
import { computeAccessMode } from "@/features/trial/grace";
import { TRIAL_GRACE_PERIOD_DAYS } from "@/features/trial/types";
```

**3b.** Locate the existing `isoDaysAgo` helper (around line 4). Leave it as-is — it's still useful. Below it (or beside it), add a millisecond helper that we'll use for the `+ 1 millisecond` precision test:

```ts
function isoMsAgo(ms: number, fromNow: Date = new Date()): string {
  return new Date(fromNow.getTime() - ms).toISOString();
}
```

**3c.** Replace the test at lines 36-44 (currently `returns full at 6 days`) with:

```ts
  it("returns full just inside the boundary (1 day before expiry)", () => {
    const now = new Date("2026-05-01T00:00:00.000Z");
    expect(
      computeAccessMode({
        lastValidatedAt: isoDaysAgo(TRIAL_GRACE_PERIOD_DAYS - 1, now),
        now,
      }),
    ).toBe("full");
  });
```

**3d.** Replace the test at lines 46-54 (currently `returns full at exactly 7 days (boundary inclusive)`) with:

```ts
  it("returns full at exactly the boundary (inclusive)", () => {
    const now = new Date("2026-05-01T00:00:00.000Z");
    expect(
      computeAccessMode({
        lastValidatedAt: isoDaysAgo(TRIAL_GRACE_PERIOD_DAYS, now),
        now,
      }),
    ).toBe("full");
  });
```

**3e.** Replace the test at lines 56-67 (currently `returns read_only at 7 days + 1 millisecond`) with:

```ts
  it("returns read_only at boundary + 1 millisecond", () => {
    const now = new Date("2026-05-01T00:00:00.000Z");
    const graceMs = TRIAL_GRACE_PERIOD_DAYS * 24 * 60 * 60 * 1000;
    expect(
      computeAccessMode({
        lastValidatedAt: isoMsAgo(graceMs + 1, now),
        now,
      }),
    ).toBe("read_only");
  });
```

**3f.** Replace the test at lines 69-77 (currently `returns read_only at 8 days`) with:

```ts
  it("returns read_only just past the boundary (1 day after expiry)", () => {
    const now = new Date("2026-05-01T00:00:00.000Z");
    expect(
      computeAccessMode({
        lastValidatedAt: isoDaysAgo(TRIAL_GRACE_PERIOD_DAYS + 1, now),
        now,
      }),
    ).toBe("read_only");
  });
```

**3g.** Replace the test at lines 79-87 (currently `returns read_only at 30 days`) with:

```ts
  it("returns read_only well past the boundary", () => {
    const now = new Date("2026-05-01T00:00:00.000Z");
    expect(
      computeAccessMode({
        lastValidatedAt: isoDaysAgo(TRIAL_GRACE_PERIOD_DAYS * 2, now),
        now,
      }),
    ).toBe("read_only");
  });
```

- [ ] **Step 4: Run `grace.test.ts` to confirm reparameterization is behavior-equivalent at the current 7-day value**

Run: `npm test -- src/features/trial/__tests__/grace.test.ts`

Expected: 9/9 tests pass. At grace=7: `7-1=6` matches the old "6 days" test; `7+0=7` matches "exactly 7"; `7*24*60*60*1000+1` matches "7d + 1ms"; `7+1=8` matches "8 days"; `7*2=14` is still well past grace, so the "30 days" assertion (read_only) still holds.

If a test fails, the reparameterization has drifted from the original semantics — STOP and re-check the math before bumping the constant.

- [ ] **Step 5: Bump `TRIAL_GRACE_PERIOD_DAYS` from 7 to 90 in `types.ts`**

Locate line 26 of `src/features/trial/types.ts`:

```ts
export const TRIAL_GRACE_PERIOD_DAYS = 7;
```

Replace it with:

```ts
// 90 days is a beta safety net. Once we ship entitlement-aware access
// (status-based gating for paid vs trial vs expired), revisit this value
// — it should likely drop back toward 7-14 days for trial users while
// paid users stop being gated on staleness at all.
export const TRIAL_GRACE_PERIOD_DAYS = 90;
```

- [ ] **Step 6: Run both reparameterized test files to confirm the bump works**

Run: `npm test -- src/features/trial/__tests__/grace.test.ts`

Expected: 9/9 tests pass. At grace=90: `90-1=89` days = full; `90` days = full (boundary inclusive); `90d + 1ms` = read_only; `90+1=91` days = read_only; `90*2=180` days = read_only. All five boundary tests now exercise the new boundary automatically.

Run: `npm test -- src/features/trial/__tests__/hooks.test.tsx`

Expected: 19/19 tests pass. Case 8 still asserts `read_only` for a beyond-grace cache (`90+1=91` days), so the "fetch fails + beyond grace → read_only" regression guard still does its job.

- [ ] **Step 7: Run typecheck**

Run: `npm run typecheck`

Expected: clean for `src/features/trial/`. The 6 pre-existing typecheck errors in unrelated test files (`TodayScreen.integration.test.tsx`, `dayBoundary.test.ts`, `useTodayDateString.test.ts`, `CreateHabitFlow.goalStep.test.tsx`) are baseline noise from origin/main and predate this work — do not try to fix them, just confirm they're unchanged.

- [ ] **Step 8: Commit**

```bash
git add src/features/trial/types.ts src/features/trial/__tests__/grace.test.ts src/features/trial/__tests__/hooks.test.tsx
git commit -m "$(cat <<'EOF'
chore(trial): bump offline grace period to 90 days for beta

Buys headroom against the "tester offline >7 days falls to read-only"
failure mode during beta, pending Thread A (entitlement-status-aware
access policy). The 5 boundary tests in grace.test.ts and the
graceExhaustedEntitlement fixture in hooks.test.tsx are reparameterized
to derive from TRIAL_GRACE_PERIOD_DAYS, so future tuning is a one-line
change with no test churn.

See docs/superpowers/specs/2026-05-31-trial-grace-period-beta-bump-design.md
for the full design rationale.
EOF
)"
```

---

## Self-Review

**Spec coverage:**
- Bump `TRIAL_GRACE_PERIOD_DAYS` 7→90 with comment → Step 5.
- Reparameterize `grace.test.ts` boundary tests → Step 3 (3c-3g).
- Reparameterize `graceExhaustedEntitlement` fixture → Step 1 (1b).
- Add value imports for `TRIAL_GRACE_PERIOD_DAYS` in both test files → Steps 1a, 3a.
- Use `TRIAL_GRACE_PERIOD_DAYS * 2` for the "well past boundary" test → Step 3g.
- Use the two-line `import type` pattern → explicitly called out in Step 1a.
- Single commit, scope `chore` → Step 8.
- Test plan from the spec (`npm test` per file, `npm run typecheck`) → Steps 2, 4, 6, 7.

**Placeholder scan:** Every step contains the actual code to write or the actual command to run. No "TBD," no "similar to other tests," no "add appropriate handling."

**Type consistency:**
- `TRIAL_GRACE_PERIOD_DAYS` — imported and used identically across `hooks.test.tsx` and `grace.test.ts` (Steps 1a, 3a, 1b, 3c-3g).
- `isoDaysAgo` (existing) and `isoMsAgo` (added in 3b) — both follow the same `(arg, fromNow = new Date()) => string` signature.
- Fixture `graceExhaustedEntitlement` — same external signature `(userId = "user-1") => CachedTrialEntitlement`, same call sites (Case 8 unchanged).

**Risk notes for the executor:**
- The reparameterization step MUST come before the constant bump. If you bump first, three tests in `grace.test.ts` will fail (`7 days + 1ms`, `8 days`, `30 days`) — that's the "tests hardcoded to 7" failure mode. Always reparameterize → verify-at-old-value → bump → verify-at-new-value.
- The Case 8 mock sequence in `hooks.test.tsx` (rejects with `TrialEntitlementFetchError`) is unrelated to this change. Don't touch it. The fixture rewrite changes only the input data, not Case 8's mock or assertion.
- This commit shares a CRLF warning pattern that's harmless on this Windows checkout — the `git commit` output may show `LF will be replaced by CRLF the next time Git touches it` for the touched test files. Not a problem.

---

## Post-implementation note (not in plan scope, but recommended)

After the commit lands, update the memory file `state_beta_packaging.md` with a one-line callout:

> Offline grace period temporarily bumped to 90 days as beta safety net (commit `<sha>`); revisit when Thread A (entitlement-status-aware access policy) ships post-beta.

This is documentation hygiene only and not part of the implementation task. The reviewer flagged it during spec review; mentioning here so future-you doesn't grep `7` looking for the old value.

---

## Execution Handoff

**Plan complete and saved to `docs/superpowers/plans/2026-05-31-trial-grace-period-beta-bump.md`. Two execution options:**

**1. Subagent-Driven (recommended)** - I dispatch a fresh subagent for the task, review between phases, fast iteration.

**2. Inline Execution** - Execute the task in this session using executing-plans, batch execution with a checkpoint after the test reparameterization and before the constant bump.

For this plan specifically: since it's a single task with 8 mechanical steps and one commit, inline execution is also a defensible choice — there's not much for review-between-tasks to catch when there's only one task. Subagent-driven is still my recommendation because the fresh-context guarantees clean execution and the two-stage review catches reparameterization arithmetic drift.

**Which approach?**
