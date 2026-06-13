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

  // RevenueCat identifies the signed-in user and runs silent
  // restorePurchases() on every auth change.
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
