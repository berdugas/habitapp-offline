# Sprint 2 — Follow-up Fixes (DEV-S2-07)

> **Status:** Ready for assignment.
> **Owner:** Tech Lead → Dev Team
> **Companion documents:** `sprint-2-tickets.md` (the S2 ticket package this follows up on), `sprint-plan.md`

This ticket cleans up one issue surfaced during code review of the S2 implementation. It's small enough that it shouldn't justify its own sprint, but it must land **before** `sprint-2` merges to `main` — the bug was introduced by the S0 server-schema migration and the S2 cascade pass missed it.

---

## DEV-S2-07 — Remove dead `upsertUserProfile` call

**Estimate:** 0.25 day (≈10 minutes of code, plus verification)
**Depends on:** DEV-S2-06 (merged on `sprint-2`)
**Branch suggestion:** `s2/auth-profile-cleanup` (off `sprint-2`, PR back into `sprint-2`)

### Context

`src/features/auth/api.ts` exports a function that upserts to a Supabase table that no longer exists:

```ts
export async function upsertUserProfile(userId: string) {
  return supabase.from("user_profiles").upsert({
    id: userId,
  });
}
```

The S0 migration (`supabase/migrations/0005_core_v1_local_first_pivot.sql`) explicitly drops this table:

```sql
drop table if exists public.user_profiles cascade;
```

It also creates a *new* table `public.profiles` and a `handle_new_user` trigger that auto-provisions the row on signup. **The client-side upsert is therefore both broken and redundant.**

`src/providers/AuthBootstrap.tsx` calls this function on every session hydration. The call is wrapped in try/catch with a `logger.warn`, so the app does not crash — but every login and every session-resume produces a noisy "Best-effort user profile upsert failed" warning in production logs.

DEV-S2-06's ticket asked the dev to read AuthBootstrap.tsx and "stop calling the dropped tables." That sweep missed this call site. We're cleaning it up now rather than carrying a known-broken code path into S3.

### Why this isn't bigger

There's no replacement to write. The S0 trigger (`handle_new_user`) provisions both `profiles` and `trial_entitlements` rows automatically when a user is created in `auth.users`. Existing users from before S0 already had their rows migrated when the migration ran. The client never needs to provision a profile.

This ticket is therefore a pure deletion — no replacement code, no new tests.

### Files to modify

```
src/features/auth/api.ts
src/providers/AuthBootstrap.tsx
```

### The change

**1. Delete the export from `src/features/auth/api.ts`.**

Remove the `upsertUserProfile` function entirely. Keep the rest of the file (`signInWithPassword`, `signUpWithPassword`, `signOut`, `getSession`) — those are legitimate auth calls and Supabase remains the auth backend.

**2. Remove the call site in `src/providers/AuthBootstrap.tsx`.**

Delete the second `useEffect` block — the one that calls `upsertUserProfile`. Looks roughly like:

```ts
useEffect(() => {
  if (!authState.user?.id) {
    return;
  }

  void upsertUserProfile(authState.user.id)
    .then(({ error }) => {
      if (error) {
        logger.warn("Best-effort user profile upsert failed", { error });
      }
    })
    .catch((error) => {
      logger.warn("Best-effort user profile upsert threw unexpectedly", {
        error,
      });
    });
}, [authState.user?.id]);
```

Delete the whole effect. Also remove `upsertUserProfile` from the imports at the top of the file.

The `logger` import may become unused depending on what else uses it in the file — if so, remove that too.

### Verification

Before opening the PR, confirm no other call sites exist:

```bash
grep -rn "upsertUserProfile" src/
```

Should return zero matches after your deletions. If anything else imported it, decide ticket-by-ticket whether the caller can also drop the call (likely yes — same reasoning) or whether it needs replacement logic.

### Acceptance criteria

- `upsertUserProfile` no longer exists in the codebase.
- `AuthBootstrap.tsx` no longer calls it; no other file imports it.
- `npx tsc --noEmit` is clean.
- `npm test` passes (no test changes expected — the function had no dedicated test).
- Manual smoke test: sign out, sign back in. The "Best-effort user profile upsert failed" log line **does not appear** in the dev console.
- Manual smoke test: sign up a brand-new account. After signup, query the dev Supabase project — `profiles` and `trial_entitlements` rows exist for the new user (provisioned by the S0 trigger, not by client code).

### Out of scope

- **The `getLatestWeeklyReview` Supabase calls** in `src/features/reviews/api.ts`. That code queries the dropped `weekly_reviews` table and produces silent errors on every Today screen render. This is the largest remaining transitional-state issue in the codebase, but it's a feature rewrite, not a 10-line deletion — it gets addressed when the reviews feature migrates to SQLite (separate sprint, not yet planned). Document this in the `sprint-2 → main` PR description so QA doesn't flag the console noise as a regression introduced by S2.
- **`features/recommendations/` AI-related code paths.** `aiRewrite` flag stays off; those code paths are gated and don't run in production. Out of scope.

### Branching

Per `sprint-plan.md` §8.5, this branches off `sprint-2`, not `main`:

```bash
git checkout sprint-2 && git pull
git checkout -b s2/auth-profile-cleanup
# ... apply the deletion ...
# Open PR: s2/auth-profile-cleanup → sprint-2
```

After this lands on `sprint-2`, the sprint is complete. Open the final `sprint-2 → main` PR.

### Notes for the reviewer

- This is a deletion, not a replacement. If the dev added any new code to "fix" the upsert, push back — the right answer is removal.
- Keep an eye on the import list at the top of `AuthBootstrap.tsx`. Stale imports after a deletion are a common smell.
- The two manual smoke-test items are the actual confirmation that this works. Static checks won't catch a typo in the function name; only an actual sign-in flow will.

---

*End of S2 follow-up ticket.*
