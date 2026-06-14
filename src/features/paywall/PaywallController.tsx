import { createContext, useCallback, useContext, useMemo, useState } from "react";
import { Modal } from "react-native";

import { purchaseLifetimeUnlock, restorePurchases } from "@/services/revenuecat";
import { useTrialValidation } from "@/features/trial/hooks";
import { logger } from "@/services/logger";
import { PaywallScreen } from "@/features/paywall/PaywallScreen";

export type PaywallTrigger =
  | "cap_create"
  | "cap_edit"
  | "cap_archive"
  | "cap_delete"
  | "cap_restore"
  | "settings_upgrade";

type PaywallContextValue = { showCapBlockPaywall: (trigger: PaywallTrigger) => void };

const PaywallContext = createContext<PaywallContextValue | null>(null);

export function usePaywall(): PaywallContextValue {
  const ctx = useContext(PaywallContext);
  if (!ctx) throw new Error("usePaywall must be used within a PaywallController");
  return ctx;
}

/**
 * Shared purchase + restore handlers reused by the cap-block modal here and
 * the app-shell hard-block (Task 7). On a successful (non-cancelled) purchase
 * or a restore, refreshes the trial context so the paywall unmounts and
 * paywall-archived habits auto-restore (via the already-mounted detector).
 */
export function usePaywallActions(onResolved?: () => void) {
  const { refresh } = useTrialValidation();
  const [isPurchasing, setIsPurchasing] = useState(false);
  const [isRestoring, setIsRestoring] = useState(false);

  const onUnlock = useCallback(async () => {
    if (isPurchasing || isRestoring) return;
    setIsPurchasing(true);
    try {
      const { cancelled } = await purchaseLifetimeUnlock();
      if (!cancelled) {
        await refresh();
        onResolved?.();
      }
    } catch (err) {
      logger.error("Paywall purchase failed", { err: err as Error });
    } finally {
      setIsPurchasing(false);
    }
  }, [isPurchasing, isRestoring, refresh, onResolved]);

  const onRestore = useCallback(async () => {
    if (isPurchasing || isRestoring) return;
    setIsRestoring(true);
    try {
      await restorePurchases();
      await refresh();
      onResolved?.();
    } catch (err) {
      logger.error("Paywall restore failed", { err: err as Error });
    } finally {
      setIsRestoring(false);
    }
  }, [isPurchasing, isRestoring, refresh, onResolved]);

  return { isPurchasing, isRestoring, onUnlock, onRestore };
}

export function PaywallController({ children }: { children: React.ReactNode }) {
  const [visible, setVisible] = useState(false);
  const { entitlementStatus } = useTrialValidation();
  const dismiss = useCallback(() => setVisible(false), []);
  const actions = usePaywallActions(dismiss);

  const showCapBlockPaywall = useCallback((_trigger: PaywallTrigger) => {
    // _trigger is consumed by telemetry in a later sub-plan.
    setVisible(true);
  }, []);

  const value = useMemo(() => ({ showCapBlockPaywall }), [showCapBlockPaywall]);

  return (
    <PaywallContext.Provider value={value}>
      {children}
      <Modal visible={visible} animationType="slide" onRequestClose={dismiss}>
        <PaywallScreen
          variant="cap_block"
          isPurchasing={actions.isPurchasing}
          isRestoring={actions.isRestoring}
          showRefundedBanner={entitlementStatus === "cancelled"}
          onUnlock={actions.onUnlock}
          onRestore={actions.onRestore}
          onContinueFree={dismiss}
          onDismiss={dismiss}
        />
      </Modal>
    </PaywallContext.Provider>
  );
}
