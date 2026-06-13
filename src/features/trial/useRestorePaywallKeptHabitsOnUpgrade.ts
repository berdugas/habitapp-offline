import { useEffect, useRef } from "react";

import { restorePaywallKeptHabits } from "@/features/habits/api";
import { isPaidStatus } from "@/features/trial/entitlement";
import { logger } from "@/services/logger";

import type { TrialEntitlementStatus } from "@/features/trial/types";

/**
 * Watches entitlement_status for non-paid → paid transitions and runs the
 * one-shot local SQLite UPDATE that restores paywall-archived habits.
 *
 * Skips the initial render when status is already paid, because we can't
 * distinguish "user is paying since signup" from "user just upgraded" on
 * the first render of a session. To upgrade we require having seen a
 * non-null non-paid status FIRST. Cold-start paid users still have their
 * habits intact because the picker never archived anything for them.
 *
 * Idempotent at the api.ts level too — restorePaywallKeptHabits is a
 * no-op when no paywall_keep_one rows exist.
 */
export function useRestorePaywallKeptHabitsOnUpgrade(
  userId: string | null,
  entitlementStatus: TrialEntitlementStatus | null,
): void {
  const hasSeenNonPaidRef = useRef(false);
  const lastStatusRef = useRef<TrialEntitlementStatus | null>(null);

  useEffect(() => {
    const prev = lastStatusRef.current;
    lastStatusRef.current = entitlementStatus;

    // Track whether we've observed a non-null non-paid status. Until then,
    // any transition to paid could be a cold-start (no upgrade).
    if (entitlementStatus !== null && !isPaidStatus(entitlementStatus)) {
      hasSeenNonPaidRef.current = true;
    }

    if (!userId) return;
    if (prev === entitlementStatus) return;
    if (!hasSeenNonPaidRef.current) return;
    if (!isPaidStatus(entitlementStatus)) return;
    if (isPaidStatus(prev)) return; // already-paid stays already-paid

    void (async () => {
      try {
        const result = await restorePaywallKeptHabits(userId);
        if (result.restoredCount > 0) {
          logger.info("Restored paywall-archived habits on upgrade", {
            userId,
            restoredCount: result.restoredCount,
          });
        }
      } catch (error) {
        logger.error("Failed to restore paywall habits on upgrade", {
          userId,
          error,
        });
      }
    })();
  }, [userId, entitlementStatus]);
}
