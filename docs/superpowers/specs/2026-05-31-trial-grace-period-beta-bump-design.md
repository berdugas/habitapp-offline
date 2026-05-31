# Trial offline grace period — beta safety bump — Design

**Date:** 2026-05-31
**Status:** Approved design, ready for implementation plan

## Problem

The trial entitlement system's offline grace period is currently 7 days
([types.ts:26](../../../src/features/trial/types.ts:26)). If a user is offline
for more than 7 days without a successful re-validation, the cache ages past
`TRIAL_GRACE_PERIOD_DAYS` and `computeAccessMode`
([grace.ts:25-30](../../../src/features/trial/grace.ts:25)) flips them to
`"read_only"` — regardless of `entitlement_status`.

For beta, this is the one realistic way a tester can still get cut off mid-test
even after the offline cold-start auto-recovery fix landed earlier today
(commits `34502d4`, `60d0312`, `e9c8d43`, merged in `7f163ac`). The cold-start
trap is gone, but the staleness-based read-only fallback remains and would bite
a tester who's offline for >7 days (vacation without wifi, travel, etc.).

We do not yet have the bigger architectural fix in place (Thread A from the
brainstorm — branching `computeAccessMode` on `entitlement_status` so that
`"paid"` users get unlimited offline access and trial users are gated by
`trial_ends_at` rather than cache age). Payment integration (Thread B) and
trial-end / upgrade UX (Thread C) are also not built.

We need a cheap beta-only safety net that buys headroom until those threads ship
post-beta.

## Goals / Non-goals

**Goals**
- Eliminate the realistic "tester offline >7 days falls to read-only" failure
  mode during beta.
- Zero policy change — keep the existing fail-closed (D4) invariant ("no cache
  → read-only") intact.
- Zero ripple — change one constant; rewrite affected boundary tests so they
  remain meaningful at the new value.
- Make the constant easy to revert / re-tune when post-beta work begins.

**Non-goals**
- Branching `computeAccessMode` on `entitlement_status` (Thread A — deferred).
- Building payment integration (Thread B — deferred).
- Building a trial-end / upgrade screen (Thread C — deferred).
- Reducing the existing cold-start auto-recovery's behavior.
- Changing `TRIAL_REVALIDATION_STALENESS_MINUTES` (the 60-min "re-fetch in
  background" knob — unrelated).

---

## Design

### Approach

Bump `TRIAL_GRACE_PERIOD_DAYS` from `7` to `90` and reparameterize the existing
tests that hardcode the 7-day boundary so they continue to test the *actual*
boundary regardless of the constant's value. One commit, scope `chore`.

90 days is chosen because it:
- Covers any reasonable beta-tester offline window (a 90-day offline stretch is
  effectively never).
- Is short enough that even if a tester reuses the beta build into production
  (which they shouldn't), the offline-cache trust window doesn't outlast the
  beta cycle.
- Is large enough relative to 7 that a future "I dropped from 90 back to 14 for
  paid users" tuning step is one constant change away.

### Files changed

**1. `src/features/trial/types.ts`** — change `7` → `90`, add an inline comment
that explains the choice and tags it for revisit:

```ts
// 90 days is a beta safety net. Once we ship entitlement-aware access
// (status-based gating for paid vs trial vs expired), revisit this value
// — it should likely drop back toward 7-14 days for trial users while
// paid users stop being gated on staleness at all.
export const TRIAL_GRACE_PERIOD_DAYS = 90;
```

**2. `src/features/trial/__tests__/grace.test.ts`** — three of the eight
existing tests hardcode the 7-day boundary and would either silently invert or
loudly fail after the bump:

- `"returns full at 6 days"` (line 36-44) — still passes at 90 (6 < 90) but
  no longer tests the boundary it claims to.
- `"returns full at exactly 7 days (boundary inclusive)"` (line 46-54) — still
  passes at 90 but no longer tests the boundary.
- `"returns read_only at 7 days + 1 millisecond"` (line 56-67) — **breaks**.
  At 90-day grace, 7d+1ms is well within grace.
- `"returns read_only at 8 days"` (line 69-77) — **breaks**. 8 < 90.
- `"returns read_only at 30 days"` (line 79-87) — **breaks**. 30 < 90.

Reparameterize all five to derive their day offsets from
`TRIAL_GRACE_PERIOD_DAYS`. Rename the test descriptions to reflect intent
("just inside the boundary," "exact boundary," "1 ms past the boundary," etc.)
rather than specific day numbers. The "at 30 days" test becomes "well past the
boundary" using `TRIAL_GRACE_PERIOD_DAYS * 2` — "doubly past" reads more
clearly than an additive offset and self-scales if the constant moves again.

After this change, only the *constant* drives the boundary; the tests follow.

**3. `src/features/trial/__tests__/hooks.test.tsx`** — the
`graceExhaustedEntitlement` fixture at lines 90-94 hardcodes 8 days:

```ts
function graceExhaustedEntitlement(userId = "user-1"): CachedTrialEntitlement {
  // last_validated_at 8 days ago — beyond the 7-day grace period
  return {
    ...freshEntitlement(userId),
    last_validated_at: new Date(NOW.getTime() - 8 * 24 * 60 * 60 * 1000).toISOString(),
  };
}
```

Reparameterize to derive from `TRIAL_GRACE_PERIOD_DAYS`:

```ts
function graceExhaustedEntitlement(userId = "user-1"): CachedTrialEntitlement {
  // last_validated_at past the grace boundary (drives Case 8's "fetch
  // fails + beyond grace → read_only" assertion regardless of the
  // constant's value).
  const beyondGraceMs = (TRIAL_GRACE_PERIOD_DAYS + 1) * 24 * 60 * 60 * 1000;
  return {
    ...freshEntitlement(userId),
    last_validated_at: new Date(NOW.getTime() - beyondGraceMs).toISOString(),
  };
}
```

This requires adding `TRIAL_GRACE_PERIOD_DAYS` to the imports from
`@/features/trial/types` at the top of the test file. Currently the file
has:

```ts
import type { CachedTrialEntitlement } from "@/features/trial/types";
```

Add a sibling value import (preserves the existing `import type` discipline
that is visually obvious throughout the file):

```ts
import { TRIAL_GRACE_PERIOD_DAYS } from "@/features/trial/types";
import type { CachedTrialEntitlement } from "@/features/trial/types";
```

Case 8 — "flips to read_only when fetch fails and cached last_validated_at
is beyond grace" — keeps the same intent and remains a regression guard
against future `computeAccessMode` changes.

### Files NOT changed

- `src/features/trial/grace.ts` — already reads `TRIAL_GRACE_PERIOD_DAYS` from
  the types module; the constant flow-through is intact.
- `src/features/trial/hooks.tsx` — reads `TRIAL_REVALIDATION_STALENESS_MINUTES`
  for the 60-min revalidation gate, not `TRIAL_GRACE_PERIOD_DAYS`. Untouched.
- Anything outside `src/features/trial/`. Grep confirms no other site
  references `TRIAL_GRACE_PERIOD_DAYS` or hardcodes `7 * 24 * 60 * 60` in trial
  contexts.

### Risk

Near-zero, by construction:
- The constant is referenced through exactly one path in production
  (`grace.ts` → `computeAccessMode`).
- All affected tests are rewritten to derive from the constant, so future
  bumps require no test churn.
- Worst case for production users: a beta tester gets 90 days of offline
  tolerance instead of 7. That is the intended effect.
- The (D4) invariant ("no cache → read_only") is *not* relaxed — first-time
  offline users still need to be online once to bootstrap.
- The cold-start auto-recovery that shipped this session is unaffected — it
  triggers re-validation on foreground and connectivity events; this change
  only widens the window during which a stale-but-existing cache still grants
  full access.

### What this does NOT change

- `computeAccessMode` still ignores `entitlement_status`. Trial vs paid vs
  expired vs cancelled all treated identically. Thread A still deferred.
- No payment integration. Thread B still deferred.
- No trial-end / upgrade screen. Thread C still deferred.

### Test plan

Verification after implementation:
1. `npm test -- src/features/trial/__tests__/grace.test.ts` — 9 tests pass
   (one test count may change slightly depending on how the boundary tests
   are reorganized; intent matters more than count).
2. `npm test -- src/features/trial/__tests__/hooks.test.tsx` — 19 tests pass
   (including Case 8 still asserting `read_only` for a beyond-grace cache).
3. `npm test` — full suite green (modulo the known srhi flake and pre-existing
   6 typecheck-unrelated baseline errors).
4. `npm run typecheck` — clean for `src/features/trial/`.

### Commit shape

One commit, scope `chore`:

```
chore(trial): bump offline grace period to 90 days for beta
```

Body should reference this design doc and call out that the 7→90 bump is a
beta safety net pending Thread A (entitlement-aware access policy).

---

## Open questions

None. The brainstorm settled on this single approach and the user approved.
Defer Threads A / B / C to post-beta milestones.
