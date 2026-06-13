import { useEffect, useRef } from "react";

import {
  logInRevenueCat,
  logOutRevenueCat,
  syncPurchases,
} from "@/services/revenuecat";
import { logger } from "@/services/logger";

/**
 * Identifies the signed-in user with RevenueCat and runs a silent
 * syncPurchases() on every auth change (initial mount + user swap).
 * After sync resolves (success or failure), calls refresh() on the
 * trial context.
 *
 * Why syncPurchases() and not restorePurchases(): per RC docs,
 * restorePurchases() is a user-initiated API that may show an OS
 * sign-in prompt. This hook runs automatically on auth changes, so
 * the correct background-sync API is syncPurchases().
 *
 * Identity race: logIn / sync are also serialized at the service layer
 * (see revenuecat.ts identityQueue), so two overlapping auth changes
 * can't leave RC stuck on whichever native promise resolved last. The
 * lastUserIdRef.current check before sync is a second defence: if the
 * effect tore down (new identity, sign-out) between this logIn and our
 * sync, skip sync so we don't associate purchases with the wrong user.
 *
 * Webhook latency: syncPurchases() resolves locally before our webhook
 * has applied to Supabase. The immediate refresh() here may still see
 * the pre-purchase entitlement. We schedule a one-shot follow-up refresh
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
    const intendedUserId = userId;

    void (async () => {
      try {
        // CRITICAL: only sync after a confirmed identity swap, and only
        // if this effect is still the active identity. Syncing against a
        // stale RC identity would associate purchases with the previous
        // user. The identityQueue in revenuecat.ts also enforces this at
        // the SDK level, but the in-hook check skips the SDK call
        // entirely once we know we've been superseded.
        const identityOk = await logInRevenueCat(intendedUserId);
        if (cancelled || lastUserIdRef.current !== intendedUserId) {
          // Auth swapped while logIn was in flight — abandon this chain.
          return;
        }
        if (identityOk) {
          await syncPurchases();
        } else {
          logger.warn(
            "RevenueCat logIn failed; skipping syncPurchases for safety",
            { userId: intendedUserId },
          );
        }
      } catch (error) {
        logger.error("RevenueCat lifecycle (logIn/sync) failed", { error });
        // Fall through to refresh anyway — the webhook may have updated
        // the row from a separate event.
      }
      if (cancelled || lastUserIdRef.current !== intendedUserId) return;
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
