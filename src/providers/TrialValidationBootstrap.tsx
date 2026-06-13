import type { PropsWithChildren } from "react";

import { useAuthSession } from "@/features/auth/hooks";
import {
  buildTrialContextValue,
  TrialValidationProvider,
  useTrialValidationLifecycle,
} from "@/features/trial/hooks";
import { useRestorePaywallKeptHabitsOnUpgrade } from "@/features/trial/useRestorePaywallKeptHabitsOnUpgrade";
import { useRevenueCatLifecycle } from "@/features/trial/useRevenueCatLifecycle";

export function TrialValidationBootstrap({ children }: PropsWithChildren) {
  const { user, isBootstrapping: isAuthBootstrapping } = useAuthSession();
  const { state, refresh } = useTrialValidationLifecycle(
    user?.id ?? null,
    isAuthBootstrapping,
  );

  // Identifies the signed-in user with RevenueCat on every auth change
  // and re-fetches the trial entitlement. Does NOT auto-call
  // syncPurchases/restorePurchases — per RC docs, auto-syncing on every
  // launch risks unintended subscriber aliasing/transfers. Explicit
  // user-initiated restore (Settings → Restore Purchase) is wired
  // separately in sub-plan #4.
  useRevenueCatLifecycle(user?.id ?? null, refresh);

  // Watch for non-paid → paid transitions to auto-restore paywall-archived
  // habits. The cached entitlement status flips as soon as the next fetch
  // returns; this hook runs the local SQLite UPDATE for paywall_keep_one
  // tagged rows.
  useRestorePaywallKeptHabitsOnUpgrade(
    user?.id ?? null,
    state.cached?.entitlement_status ?? null,
  );

  const contextValue = buildTrialContextValue(state, refresh);

  return (
    <TrialValidationProvider value={contextValue}>
      {children}
    </TrialValidationProvider>
  );
}
