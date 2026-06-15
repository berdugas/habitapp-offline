import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  useSyncExternalStore,
} from "react";
import { Modal } from "react-native";

import {
  purchaseLifetimeUnlock,
  restorePurchases,
  type RestoreResult,
} from "@/services/revenuecat";
import { useAuthSession } from "@/features/auth/hooks";
import { useTrialValidation } from "@/features/trial/hooks";
import { isPaidStatus } from "@/features/trial/entitlement";
import { logger } from "@/services/logger";
import { trackEvent } from "@/services/analytics";
import { PaywallScreen } from "@/features/paywall/PaywallScreen";
import { paywallCopy } from "@/features/paywall/copy";
import { waitForServerPaid } from "@/features/paywall/waitForServerPaid";

// Store operations are globally serialized (one Play billing session), so this
// in-flight lock lives at MODULE scope — shared by EVERY usePaywallActions
// instance (the cap-block modal AND the Settings rows), not per-hook. Without
// this, a Restore started in Settings and an Upgrade opened in the modal would
// run through two independent locks and overlap.
//
// It's exposed as a tiny external store so EVERY instance re-renders (and its
// `isBusy` reflects the lock) when any instance starts/finishes an op — not
// just a non-reactive Boolean that would leave the other surface's buttons
// enabled (then silently no-op) while the lock is held elsewhere.
let storeOpInFlight = false;
const storeOpListeners = new Set<() => void>();

function setStoreOpInFlight(value: boolean) {
  if (storeOpInFlight === value) return;
  storeOpInFlight = value;
  storeOpListeners.forEach((listener) => listener());
}
function subscribeStoreOp(listener: () => void) {
  storeOpListeners.add(listener);
  return () => {
    storeOpListeners.delete(listener);
  };
}
function getStoreOpInFlight() {
  return storeOpInFlight;
}

/** Test-only: reset the module-level store-op lock between tests. */
export function __resetStoreOpLockForTests() {
  setStoreOpInFlight(false);
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
  // Store ops are bound to the authenticated user — purchase/restore establish
  // this RC identity before running so they can't charge/read the wrong (e.g.
  // anonymous) RevenueCat customer.
  const { user } = useAuthSession();
  const userId = user?.id ?? null;
  // Latest authenticated userId, readable AFTER an await (a closure's value
  // would be stale). Lets an in-flight verification detect that auth changed.
  const latestUserIdRef = useRef(userId);
  latestUserIdRef.current = userId;
  const [isPurchasing, setIsPurchasing] = useState(false);
  const [isRestoring, setIsRestoring] = useState(false);
  const [isVerifying, setIsVerifying] = useState(false);
  const [status, setStatus] = useState<PaywallActionStatus>({ kind: "idle" });
  // Shared (cross-instance) lock state — reactive, so this instance's isBusy
  // turns true when ANOTHER instance holds the lock too.
  const sharedBusy = useSyncExternalStore(
    subscribeStoreOp,
    getStoreOpInFlight,
    getStoreOpInFlight,
  );

  const isBusy = isPurchasing || isRestoring || isVerifying || sharedBusy;

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

  // Auth changed mid-flight (sign-out / account switch): any pending
  // verification was bound to the PREVIOUS user. Drop the processing/error
  // state so it can't trap the post-sign-out UI — `processing` hides every exit
  // and blocks Android Back. The in-flight op (if any) re-checks the user after
  // its poll and also bails (so it can't re-set processing after this reset).
  const prevUserIdRef = useRef(userId);
  useEffect(() => {
    if (prevUserIdRef.current === userId) return;
    prevUserIdRef.current = userId;
    setStatus({ kind: "idle" });
  }, [userId]);

  // After a store-confirmed op, wait for the server then resolve or surface a
  // processing state. timed_out (webhook lag) and failed (offline) both keep
  // the paywall up with Check again — the money/entitlement is already secured.
  // Bound to opUserId: if auth changed during the poll, refresh() read a
  // DIFFERENT user's entitlement, so the result is meaningless here — abort to
  // idle rather than (re-)enter `processing` and trap the post-sign-out UI.
  const resolveWhenServerPaid = useCallback(async (opUserId: string) => {
    // Auth already changed before we even start polling — don't poll the new
    // account or hold the lock for a stale op.
    if (latestUserIdRef.current !== opUserId) {
      setStatus({ kind: "idle" });
      return;
    }
    setIsVerifying(true);
    let result;
    try {
      result = await waitForServerPaid(refresh, {
        attempts: pollAttempts,
        intervalMs: pollIntervalMs,
        sleep,
        // Stop polling (and release the lock sooner) if auth changes mid-poll.
        isAborted: () => latestUserIdRef.current !== opUserId,
      });
    } finally {
      setIsVerifying(false);
    }
    if (latestUserIdRef.current !== opUserId) {
      setStatus({ kind: "idle" });
      return;
    }
    if (result === "paid") {
      setStatus({ kind: "idle" });
      onResolved?.();
    } else {
      setStatus({ kind: "processing" });
    }
  }, [refresh, pollAttempts, pollIntervalMs, sleep, onResolved]);

  // Set an error only if this op is still the CURRENT user's. An auth change
  // during a store op would otherwise let a stale error repopulate over the
  // auth-reset effect's idle.
  const setErrorIfCurrent = useCallback((opUserId: string, message: string) => {
    setStatus(
      latestUserIdRef.current === opUserId
        ? { kind: "error", message }
        : { kind: "idle" },
    );
  }, []);

  const onUnlock = useCallback(async () => {
    if (storeOpInFlight) return;
    if (!userId) {
      // No authenticated user to bind the purchase to — never charge against an
      // anonymous RC customer the webhook can't map back to a Supabase user.
      setStatus({ kind: "error", message: paywallCopy.purchaseFailed });
      return;
    }
    setStoreOpInFlight(true);
    try {
      setStatus({ kind: "idle" });
      setIsPurchasing(true);
      let cancelled = false;
      try {
        ({ cancelled } = await purchaseLifetimeUnlock(userId));
      } catch (err) {
        logger.error("Paywall purchase failed", { err: err as Error });
        setIsPurchasing(false);
        setErrorIfCurrent(userId, paywallCopy.purchaseFailed);
        return;
      }
      setIsPurchasing(false);
      if (cancelled) return; // user backed out — no message
      await resolveWhenServerPaid(userId);
    } finally {
      setStoreOpInFlight(false);
    }
  }, [resolveWhenServerPaid, userId, setErrorIfCurrent]);

  const onRestore = useCallback(async () => {
    if (storeOpInFlight) return;
    if (!userId) {
      setStatus({ kind: "error", message: paywallCopy.restoreFailed });
      return;
    }
    setStoreOpInFlight(true);
    try {
      setStatus({ kind: "idle" });
      setIsRestoring(true);
      let result: RestoreResult;
      try {
        result = await restorePurchases(userId);
      } catch (err) {
        logger.error("Paywall restore failed", { err: err as Error });
        setIsRestoring(false);
        setErrorIfCurrent(userId, paywallCopy.restoreFailed);
        return;
      }
      setIsRestoring(false);
      if (result.status === "failed") {
        setErrorIfCurrent(userId, paywallCopy.restoreFailed);
        return;
      }
      if (!result.hasLifetimeEntitlement) {
        // RC ran fine but this account never bought the unlock.
        setErrorIfCurrent(userId, paywallCopy.restoreNoneFound);
        return;
      }
      await resolveWhenServerPaid(userId);
    } finally {
      setStoreOpInFlight(false);
    }
  }, [resolveWhenServerPaid, userId, setErrorIfCurrent]);

  // "Check again" from the processing state: the store op already succeeded, so
  // just re-poll the server for the webhook to have landed.
  const onRecheck = useCallback(async () => {
    if (storeOpInFlight) return;
    if (!userId) {
      // Signed out while in the processing state — nothing to verify; drop it.
      setStatus({ kind: "idle" });
      return;
    }
    setStoreOpInFlight(true);
    try {
      await resolveWhenServerPaid(userId);
    } finally {
      setStoreOpInFlight(false);
    }
  }, [resolveWhenServerPaid, userId]);

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
  const { user } = useAuthSession();
  const userId = user?.id ?? null;
  const dismiss = useCallback(() => setVisible(false), []);
  const actions = usePaywallActions(dismiss);
  const { clearStatus } = actions; // stable (useCallback []) — safe as a dep

  const showCapBlockPaywall = useCallback(
    (trigger: PaywallTrigger) => {
      trackEvent("paywall_shown", { trigger });
      clearStatus(); // drop any lingering error/processing from a prior open
      setVisible(true);
    },
    [clearStatus],
  );

  // Dismiss a visible cap modal once the server confirms paid via ANY path
  // (this poll, a Settings restore, or a purchase on another device) — never
  // leave a paywall over a fully-unlocked app, even if our action status is idle.
  useEffect(() => {
    if (visible && isPaidStatus(entitlementStatus)) {
      setVisible(false);
    }
  }, [visible, entitlementStatus]);

  // Close a stale cap-block modal if the authenticated user changes (sign-out /
  // account switch): it was opened for the previous user, and leaving it up —
  // especially mid-verification — could trap the post-sign-out UI. (The actions
  // hook independently resets its own status on the same change.)
  const prevUserIdRef = useRef(userId);
  useEffect(() => {
    if (prevUserIdRef.current === userId) return;
    prevUserIdRef.current = userId;
    setVisible(false);
  }, [userId]);

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
          isBusy={actions.isBusy}
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
