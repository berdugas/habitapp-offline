import { useEffect, useRef } from "react";

import {
  logInRevenueCat,
  logOutRevenueCat,
  restorePurchases,
} from "@/services/revenuecat";
import { logger } from "@/services/logger";

/**
 * Identifies the signed-in user with RevenueCat and runs a silent
 * restorePurchases() on every auth change (initial mount + user swap).
 * After restore resolves (success or failure), calls refresh() on the
 * trial context.
 *
 * Race: restorePurchases() resolves locally before our webhook has
 * applied to Supabase. The immediate refresh() here may still see the
 * pre-purchase entitlement. We schedule a one-shot follow-up refresh
 * ~3 seconds later to catch the typical webhook latency without setting
 * up a polling loop. Two refreshes total (immediate + 3s) covers the
 * vast majority of real-world cases; the existing AppState/Network
 * listeners catch any longer latency on next foreground or reconnect.
 */
export function useRevenueCatLifecycle(
  userId: string | null,
  refresh: () => Promise<void>,
): void {
  const lastUserIdRef = useRef<string | null>(null);

  useEffect(() => {
    const prevUserId = lastUserIdRef.current;
    lastUserIdRef.current = userId;

    if (prevUserId === userId) return;

    if (userId === null) {
      void logOutRevenueCat().catch((error) => {
        logger.error("RevenueCat logOut failed", { error });
      });
      return;
    }

    let cancelled = false;
    let followupTimer: ReturnType<typeof setTimeout> | undefined;

    void (async () => {
      try {
        // CRITICAL: only restore after a confirmed identity swap.
        // Restoring against a stale RC identity would associate purchases
        // with the previous user. If logIn fails, skip restore but still
        // refresh — the webhook may have applied state from a separate
        // event.
        const identityOk = await logInRevenueCat(userId);
        if (identityOk) {
          await restorePurchases();
        } else {
          logger.warn(
            "RevenueCat logIn failed; skipping restorePurchases for safety",
            { userId },
          );
        }
      } catch (error) {
        logger.error("RevenueCat lifecycle (logIn/restore) failed", { error });
        // Fall through to refresh anyway — the webhook may have updated
        // the row from a separate event.
      }
      if (cancelled) return;
      try {
        await refresh();
      } catch (error) {
        logger.error("RevenueCat lifecycle refresh failed", { error });
      }
      // Follow-up refresh to catch the typical RC → webhook → Supabase
      // latency. One-shot, ~3s after the initial refresh. Cancelled if
      // the effect tears down (user switch, sign out).
      followupTimer = setTimeout(() => {
        if (cancelled) return;
        void refresh().catch((error) => {
          logger.error("RevenueCat lifecycle follow-up refresh failed", {
            error,
          });
        });
      }, 3000);
    })();

    return () => {
      cancelled = true;
      if (followupTimer !== undefined) clearTimeout(followupTimer);
    };
  }, [userId, refresh]);
}
