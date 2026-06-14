import { useEffect, useRef } from "react";

import { restorePaywallKeptHabits } from "@/features/habits/api";
import { isPaidStatus } from "@/features/trial/entitlement";
import { logger } from "@/services/logger";

import type { TrialEntitlementStatus } from "@/features/trial/types";

/**
 * Reconciles paywall-archived habits whenever a signed-in user is observed
 * paid — once per signed-in paid session.
 *
 * The old version only fired on an in-session non-paid → paid TRANSITION, and
 * deliberately skipped a cold start that began already paid. That stranded a
 * real case: a user upgrades, the app closes before the client observes the
 * transition, and on the next launch they start paid → the upgrade is never
 * seen → their `paywall_keep_one`-tagged habits stay archived forever.
 *
 * restorePaywallKeptHabits is idempotent (a no-op SELECT when no tagged rows
 * exist), so reconciling on first-observed-paid each session is cheap and
 * safe. Keyed by userId so a different signed-in user reconciles too. On
 * failure the latch resets so a later render retries.
 */
export function useRestorePaywallKeptHabitsOnUpgrade(
  userId: string | null,
  entitlementStatus: TrialEntitlementStatus | null,
): void {
  const reconciledForUserRef = useRef<string | null>(null);

  useEffect(() => {
    if (!userId) return;
    if (!isPaidStatus(entitlementStatus)) return;
    if (reconciledForUserRef.current === userId) return; // already done this session
    reconciledForUserRef.current = userId;

    void (async () => {
      try {
        const result = await restorePaywallKeptHabits(userId);
        if (result.restoredCount > 0) {
          logger.info("Restored paywall-archived habits", {
            userId,
            restoredCount: result.restoredCount,
          });
        }
      } catch (error) {
        // Allow a retry on a later render if the reconcile failed.
        if (reconciledForUserRef.current === userId) {
          reconciledForUserRef.current = null;
        }
        logger.error("Failed to restore paywall habits", { userId, error });
      }
    })();
  }, [userId, entitlementStatus]);
}
