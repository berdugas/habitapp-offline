import type { PropsWithChildren } from "react";

import { useAuthSession } from "@/features/auth/hooks";
import {
  buildTrialContextValue,
  TrialValidationProvider,
  useTrialValidationLifecycle,
} from "@/features/trial/hooks";
import { useRestorePaywallKeptHabitsOnUpgrade } from "@/features/trial/useRestorePaywallKeptHabitsOnUpgrade";
import { useRevenueCatLifecycle } from "@/features/trial/useRevenueCatLifecycle";
import { useTrialEndingNotification } from "@/features/paywall/useTrialEndingNotification";

export function TrialValidationBootstrap({ children }: PropsWithChildren) {
  const { user, isBootstrapping: isAuthBootstrapping } = useAuthSession();
  const userId = user?.id ?? null;
  const { state, refresh } = useTrialValidationLifecycle(
    userId,
    isAuthBootstrapping,
  );

  // Account-scope the cache SYNCHRONOUSLY at render time. The lifecycle's
  // post-commit mask still leaves one committed render where state.cached
  // belongs to the previous user while userId is already the new one — which
  // would feed the wrong (e.g. paid) status into the hooks below and the
  // context, briefly granting/reconciling access for the wrong account. Drop a
  // mismatched cache here so no render (or sibling hook) ever sees it.
  const effectiveCached =
    state.cached && state.cached.user_id === userId ? state.cached : null;
  const effectiveState =
    effectiveCached === state.cached ? state : { ...state, cached: effectiveCached };

  // Identifies the signed-in user with RevenueCat on every auth change
  // and re-fetches the trial entitlement. Does NOT auto-call
  // syncPurchases/restorePurchases — per RC docs, auto-syncing on every
  // launch risks unintended subscriber aliasing/transfers. Explicit
  // user-initiated restore (Settings → Restore Purchase) is wired
  // separately in sub-plan #4.
  useRevenueCatLifecycle(userId, refresh);

  // Watch for non-paid → paid transitions to auto-restore paywall-archived
  // habits. The cached entitlement status flips as soon as the next fetch
  // returns; this hook runs the local SQLite UPDATE for paywall_keep_one
  // tagged rows.
  useRestorePaywallKeptHabitsOnUpgrade(
    userId,
    effectiveCached?.entitlement_status ?? null,
  );

  useTrialEndingNotification(
    effectiveCached?.entitlement_status ?? null,
    effectiveCached?.trial_ends_at ?? null,
  );

  const contextValue = buildTrialContextValue(effectiveState, refresh);

  return (
    <TrialValidationProvider value={contextValue}>
      {children}
    </TrialValidationProvider>
  );
}
