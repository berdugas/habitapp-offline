import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
} from "react";
import { Modal } from "react-native";

import {
  purchaseLifetimeUnlock,
  restorePurchases,
  type RestoreResult,
} from "@/services/revenuecat";
import { useTrialValidation } from "@/features/trial/hooks";
import { isPaidStatus } from "@/features/trial/entitlement";
import { logger } from "@/services/logger";
import { PaywallScreen } from "@/features/paywall/PaywallScreen";
import { paywallCopy } from "@/features/paywall/copy";
import { waitForServerPaid } from "@/features/paywall/waitForServerPaid";

// Store operations are globally serialized (one Play billing session), so this
// in-flight lock lives at MODULE scope — shared by EVERY usePaywallActions
// instance (the cap-block modal AND the Settings rows), not per-hook. Without
// this, a Restore started in Settings and an Upgrade opened in the modal would
// run through two independent locks and overlap.
let storeOpInFlight = false;

/** Test-only: reset the module-level store-op lock between tests. */
export function __resetStoreOpLockForTests() {
  storeOpInFlight = false;
}

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

export type PaywallActionStatus =
  | { kind: "idle" }
  | { kind: "processing" } // store confirmed; server (webhook) not yet — Check again
  | { kind: "error"; message: string };

export type UsePaywallActionsOptions = {
  pollAttempts?: number;
  pollIntervalMs?: number;
  sleep?: (ms: number) => Promise<void>;
};

/**
 * Shared purchase + restore orchestration reused by the cap-block modal and
 * the app-shell hard-block.
 *
 * Verify-before-resolve: a completed Play purchase / RevenueCat restore only
 * means the STORE is satisfied. The app's source of truth is the Supabase
 * entitlement, which the RevenueCat webhook updates asynchronously — so after a
 * store-confirmed op we poll the server (waitForServerPaid) and only call
 * onResolved once paid/active is actually observed. If the webhook hasn't
 * landed in time we surface a "processing" state with Check again rather than
 * dismissing as if unlocked. RevenueCat's CustomerInfo is used ONLY to pick
 * honest restore messaging (no purchase vs failure), never to grant access.
 */
export function usePaywallActions(
  onResolved?: () => void,
  options?: UsePaywallActionsOptions,
) {
  const { refresh, entitlementStatus } = useTrialValidation();
  const [isPurchasing, setIsPurchasing] = useState(false);
  const [isRestoring, setIsRestoring] = useState(false);
  const [isVerifying, setIsVerifying] = useState(false);
  const [status, setStatus] = useState<PaywallActionStatus>({ kind: "idle" });

  const isBusy = isPurchasing || isRestoring || isVerifying;

  const pollAttempts = options?.pollAttempts;
  const pollIntervalMs = options?.pollIntervalMs;
  const sleep = options?.sleep;

  // If the server reports paid through ANY path (our poll, AppState/network
  // lifecycle refresh, or another instance) while we're showing the processing
  // state, resolve it — don't leave the modal stuck on "Check again" / Settings
  // stuck on its processing branch when access is already confirmed.
  useEffect(() => {
    if (status.kind === "processing" && isPaidStatus(entitlementStatus)) {
      setStatus({ kind: "idle" });
      onResolved?.();
    }
  }, [status.kind, entitlementStatus, onResolved]);

  // After a store-confirmed op, wait for the server then resolve or surface a
  // processing state. timed_out (webhook lag) and failed (offline) both keep
  // the paywall up with Check again — the money/entitlement is already secured.
  const resolveWhenServerPaid = useCallback(async () => {
    setIsVerifying(true);
    let result;
    try {
      result = await waitForServerPaid(refresh, {
        attempts: pollAttempts,
        intervalMs: pollIntervalMs,
        sleep,
      });
    } finally {
      setIsVerifying(false);
    }
    if (result === "paid") {
      setStatus({ kind: "idle" });
      onResolved?.();
    } else {
      setStatus({ kind: "processing" });
    }
  }, [refresh, pollAttempts, pollIntervalMs, sleep, onResolved]);

  const onUnlock = useCallback(async () => {
    if (storeOpInFlight) return;
    storeOpInFlight = true;
    try {
      setStatus({ kind: "idle" });
      setIsPurchasing(true);
      let cancelled = false;
      try {
        ({ cancelled } = await purchaseLifetimeUnlock());
      } catch (err) {
        logger.error("Paywall purchase failed", { err: err as Error });
        setStatus({ kind: "error", message: paywallCopy.purchaseFailed });
        setIsPurchasing(false);
        return;
      }
      setIsPurchasing(false);
      if (cancelled) return; // user backed out — no message
      await resolveWhenServerPaid();
    } finally {
      storeOpInFlight = false;
    }
  }, [resolveWhenServerPaid]);

  const onRestore = useCallback(async () => {
    if (storeOpInFlight) return;
    storeOpInFlight = true;
    try {
      setStatus({ kind: "idle" });
      setIsRestoring(true);
      let result: RestoreResult;
      try {
        result = await restorePurchases();
      } catch (err) {
        logger.error("Paywall restore failed", { err: err as Error });
        setStatus({ kind: "error", message: paywallCopy.restoreFailed });
        setIsRestoring(false);
        return;
      }
      setIsRestoring(false);
      if (result.status === "failed") {
        setStatus({ kind: "error", message: paywallCopy.restoreFailed });
        return;
      }
      if (!result.hasLifetimeEntitlement) {
        // RC ran fine but this account never bought the unlock.
        setStatus({ kind: "error", message: paywallCopy.restoreNoneFound });
        return;
      }
      await resolveWhenServerPaid();
    } finally {
      storeOpInFlight = false;
    }
  }, [resolveWhenServerPaid]);

  // "Check again" from the processing state: the store op already succeeded, so
  // just re-poll the server for the webhook to have landed.
  const onRecheck = useCallback(async () => {
    if (storeOpInFlight) return;
    storeOpInFlight = true;
    try {
      await resolveWhenServerPaid();
    } finally {
      storeOpInFlight = false;
    }
  }, [resolveWhenServerPaid]);

  const clearStatus = useCallback(() => setStatus({ kind: "idle" }), []);

  return {
    isPurchasing,
    isRestoring,
    isVerifying,
    isBusy,
    status,
    onUnlock,
    onRestore,
    onRecheck,
    clearStatus,
  };
}

export function PaywallController({ children }: { children: React.ReactNode }) {
  const [visible, setVisible] = useState(false);
  const { entitlementStatus } = useTrialValidation();
  const dismiss = useCallback(() => setVisible(false), []);
  const actions = usePaywallActions(dismiss);
  const { clearStatus } = actions; // stable (useCallback []) — safe as a dep

  const showCapBlockPaywall = useCallback(
    (_trigger: PaywallTrigger) => {
      // _trigger is consumed by telemetry in a later sub-plan.
      clearStatus(); // drop any lingering error/processing from a prior open
      setVisible(true);
    },
    [clearStatus],
  );

  const value = useMemo(() => ({ showCapBlockPaywall }), [showCapBlockPaywall]);

  return (
    <PaywallContext.Provider value={value}>
      {children}
      <Modal
        visible={visible}
        animationType="slide"
        onRequestClose={() => {
          // Don't let Android hardware Back false-dismiss while a store op is
          // in flight or the server hasn't confirmed yet — the visible exit
          // controls are hidden in that state, so Back must be inert too.
          if (actions.isBusy || actions.status.kind === "processing") return;
          dismiss();
        }}
      >
        <PaywallScreen
          variant="cap_block"
          isPurchasing={actions.isPurchasing}
          isRestoring={actions.isRestoring}
          isVerifying={actions.isVerifying}
          status={actions.status}
          showRefundedBanner={entitlementStatus === "cancelled"}
          onUnlock={actions.onUnlock}
          onRestore={actions.onRestore}
          onRecheck={actions.onRecheck}
          onContinueFree={dismiss}
          onDismiss={dismiss}
        />
      </Modal>
    </PaywallContext.Provider>
  );
}
