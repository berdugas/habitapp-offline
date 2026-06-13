import { useEffect, useRef } from "react";

import {
  logInRevenueCat,
  logOutRevenueCat,
} from "@/services/revenuecat";
import { logger } from "@/services/logger";

/**
 * Identifies the signed-in user with RevenueCat on every auth change
 * (initial mount + user swap), then re-fetches the trial entitlement
 * from Supabase via refresh().
 *
 * Why NOT call syncPurchases() or restorePurchases() here: per RC docs,
 * automatic background syncs on every launch / account change can cause
 * unintended subscriber aliasing or unwanted transfers between RC
 * customers. restorePurchases() is also a user-initiated API that can
 * show OS sign-in prompts. We rely on RC's webhook to push entitlement
 * state into Supabase, and refresh() reads that — no client-side
 * reconciliation needed. A separate explicit "Restore Purchase" gesture
 * (Settings → Restore Purchase, sub-plan #4) drives the restorePurchases
 * wrapper from a user tap.
 *
 * Identity race: logIn is serialized at the service layer (see
 * revenuecat.ts identityQueue), so two overlapping auth changes can't
 * leave RC stuck on whichever native promise resolved last. The
 * lastUserIdRef.current check before refresh is a second defence: if the
 * effect tore down (new identity, sign-out) between this logIn and our
 * refresh, abandon the chain.
 *
 * Webhook latency: when a purchase happens on this device, RC delivers
 * the webhook to Supabase asynchronously. We schedule a one-shot
 * follow-up refresh ~3 seconds after the immediate refresh to catch the
 * typical webhook delivery latency. The existing AppState/Network
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
    const intendedUserId = userId;

    void (async () => {
      try {
        const identityOk = await logInRevenueCat(intendedUserId);
        if (cancelled || lastUserIdRef.current !== intendedUserId) {
          // Auth swapped while logIn was in flight — abandon this chain.
          return;
        }
        if (!identityOk) {
          logger.warn(
            "RevenueCat logIn failed; refresh will still re-fetch Supabase state",
            { userId: intendedUserId },
          );
        }
      } catch (error) {
        logger.error("RevenueCat lifecycle (logIn) failed", { error });
        // Fall through to refresh — the webhook may have already updated
        // the row.
      }
      if (cancelled || lastUserIdRef.current !== intendedUserId) return;
      try {
        await refresh();
      } catch (error) {
        logger.error("RevenueCat lifecycle refresh failed", { error });
      }
      // Follow-up refresh to catch typical RC → webhook → Supabase
      // latency on a recent purchase. One-shot, ~3s after the initial
      // refresh. Cancelled if the effect tears down (user switch,
      // sign out).
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
