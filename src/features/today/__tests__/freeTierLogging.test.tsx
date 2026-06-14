import { upsertHabitLog } from "@/features/habits/api";

// upsertHabitLog takes (userId, payload) — no accessMode param — proving the
// log path is entitlement-agnostic. This is a regression guard: if someone
// later adds an accessMode arg, this test breaks and forces a re-think of the
// free-tier-can-log invariant the paywall UX depends on.
it("upsertHabitLog signature has no accessMode parameter", () => {
  expect(upsertHabitLog.length).toBe(2);
});
