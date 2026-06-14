import { useEffect, useRef, useState } from "react";
import { useQueryClient } from "@tanstack/react-query";

import { restorePaywallKeptHabits } from "@/features/habits/api";
import { isPaidStatus } from "@/features/trial/entitlement";
import { logger } from "@/services/logger";

import type { TrialEntitlementStatus } from "@/features/trial/types";

const MAX_RECONCILE_ATTEMPTS = 3;
const RECONCILE_RETRY_MS = 3000;

/**
 * Reconciles paywall-archived habits whenever a signed-in user is observed
 * paid — once per signed-in paid session.
 *
 * Fires on first-observed-paid (including a cold start that begins already
 * paid), which closes the missed-upgrade gap where a user upgrades, the app
 * closes before the client sees the non-paid→paid transition, and the
 * `paywall_keep_one`-tagged habits would otherwise stay archived forever.
 * restorePaywallKeptHabits is idempotent (no-op SELECT when nothing is
 * tagged), so this is cheap and safe. Keyed by userId so a different signed-in
 * user reconciles too.
 *
 * On a non-zero restore it invalidates the broad `["habits"]` query so the
 * already-mounted Today/library screens show the restored habits immediately
 * (they sit under the paywall and won't otherwise refetch on their own).
 *
 * A transient failure schedules a BOUNDED timer retry: just clearing the latch
 * wouldn't re-run the effect while userId/entitlementStatus are unchanged, so
 * the retry is driven through state (`retryTick`).
 */
export function useRestorePaywallKeptHabitsOnUpgrade(
  userId: string | null,
  entitlementStatus: TrialEntitlementStatus | null,
): void {
  const queryClient = useQueryClient();
  const reconciledForUserRef = useRef<string | null>(null);
  const attemptsForUserRef = useRef<string | null>(null);
  const attemptsRef = useRef(0);
  const [retryTick, setRetryTick] = useState(0);

  useEffect(() => {
    if (!userId) return;
    if (!isPaidStatus(entitlementStatus)) return;

    // Fresh retry budget per signed-in user.
    if (attemptsForUserRef.current !== userId) {
      attemptsForUserRef.current = userId;
      attemptsRef.current = 0;
    }
    if (reconciledForUserRef.current === userId) return; // already done this session
    reconciledForUserRef.current = userId;

    let cancelled = false;
    let timer: ReturnType<typeof setTimeout> | undefined;

    void (async () => {
      try {
        const result = await restorePaywallKeptHabits(userId);
        if (cancelled) return;
        attemptsRef.current = 0;
        if (result.restoredCount > 0) {
          logger.info("Restored paywall-archived habits", {
            userId,
            restoredCount: result.restoredCount,
          });
          // Refresh the mounted habit screens so restored habits appear now,
          // not after a later remount/refetch.
          await queryClient.invalidateQueries({ queryKey: ["habits"] });
        }
      } catch (error) {
        if (cancelled) return;
        logger.error("Failed to restore paywall habits", { userId, error });
        // Clear the latch AND schedule a bounded retry (a ref reset alone
        // wouldn't re-run this effect with unchanged deps).
        reconciledForUserRef.current = null;
        if (attemptsRef.current < MAX_RECONCILE_ATTEMPTS) {
          attemptsRef.current += 1;
          timer = setTimeout(
            () => setRetryTick((tick) => tick + 1),
            RECONCILE_RETRY_MS,
          );
        }
      }
    })();

    return () => {
      cancelled = true;
      if (timer) clearTimeout(timer);
    };
  }, [userId, entitlementStatus, retryTick, queryClient]);
}
