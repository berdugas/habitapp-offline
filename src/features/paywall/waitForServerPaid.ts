import { isPaidStatus } from "@/features/trial/entitlement";

import type { CachedTrialEntitlement } from "@/features/trial/types";

export type PaidPollResult = "paid" | "timed_out" | "failed";

const DEFAULT_ATTEMPTS = 5;
const DEFAULT_INTERVAL_MS = 2000;

/**
 * Polls the SERVER entitlement (via `refresh`) until it reports paid/active,
 * the attempt budget is exhausted, or the server stays unreachable.
 *
 * Reads the VALUE `refresh` returns — ground truth — rather than the caller's
 * React state, which is stale immediately after `await refresh()`. It checks
 * `entitlement_status` (paid/active) specifically, NOT `accessMode === "full"`,
 * because an in-window trial is also "full".
 *
 * Owns no UI: returns a verdict the caller maps to its own copy/state.
 *   "paid"      — server confirmed paid/active within the budget.
 *   "timed_out" — server was reachable but never reported paid in time (e.g.
 *                 the RevenueCat webhook hasn't propagated to Supabase yet).
 *   "failed"    — every refresh failed to reach the server (offline / error).
 *
 * This verifies entitlement only; it never grants client-side access.
 */
export async function waitForServerPaid(
  refresh: () => Promise<CachedTrialEntitlement | null>,
  options: {
    attempts?: number;
    intervalMs?: number;
    sleep?: (ms: number) => Promise<void>;
    // Returns true when the caller wants to stop early (e.g. the authenticated
    // user changed mid-poll, so polling the new account is meaningless and just
    // holds the caller's lock). Checked before the first poll, after each
    // refresh, and before each subsequent attempt.
    isAborted?: () => boolean;
  } = {},
): Promise<PaidPollResult> {
  const attempts = options.attempts ?? DEFAULT_ATTEMPTS;
  const intervalMs = options.intervalMs ?? DEFAULT_INTERVAL_MS;
  const sleep =
    options.sleep ??
    ((ms: number) => new Promise<void>((resolve) => setTimeout(resolve, ms)));
  const isAborted = options.isAborted ?? (() => false);

  let reachedServer = false;
  for (let attempt = 0; attempt < attempts; attempt += 1) {
    if (isAborted()) break;
    const entitlement = await refresh();
    if (isAborted()) break; // auth changed during the refresh — stop before sleeping
    if (entitlement) {
      reachedServer = true;
      if (isPaidStatus(entitlement.entitlement_status)) return "paid";
    }
    // Don't sleep after the final attempt.
    if (attempt < attempts - 1) await sleep(intervalMs);
  }

  return reachedServer ? "timed_out" : "failed";
}
