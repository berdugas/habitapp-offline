import { useCallback, useEffect, useRef, useState } from "react";
import { StyleSheet, View } from "react-native";
import { useQueryClient } from "@tanstack/react-query";

import { useAuthSession } from "@/features/auth/hooks";
import { useTrialValidation } from "@/features/trial/hooks";
import { isPaidStatus } from "@/features/trial/entitlement";
import {
  archiveHabitsForPaywallKeepOne,
  listActiveHabits,
  listBacklogHabits,
  restorePaywallKeptHabits,
} from "@/features/habits/api";
import { usePaywallGate } from "@/features/paywall/usePaywallGate";
import { usePaywallActions } from "@/features/paywall/PaywallController";
import { PaywallScreen } from "@/features/paywall/PaywallScreen";
import { KeepOnePicker } from "@/features/paywall/KeepOnePicker";
import { paywallCopy } from "@/features/paywall/copy";
import { logger } from "@/services/logger";
import { trackEvent } from "@/services/analytics";

type PickerHabit = { id: string; title: string; identity_phrase: string | null; status: string };

// Bound auto-cleanup retries so a persistently-failing archive can't loop
// forever, while a transient failure still gets a few more shots via a timer.
const MAX_CLEANUP_ATTEMPTS = 3;
const CLEANUP_RETRY_MS = 3000;

// Bound retry for the paid-race reconcile (see reconcileIfPaidRaced): the
// archive has already committed and the session reconcile hook may be latched
// at zero rows, so a transient restore failure must retry a few times rather
// than strand the rows until restart.
const MAX_RECONCILE_ATTEMPTS = 3;
const RECONCILE_RETRY_MS = 3000;

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

export function PaywallHardBlock() {
  const gate = usePaywallGate();
  const { user } = useAuthSession();
  const { entitlementStatus } = useTrialValidation();
  const queryClient = useQueryClient();
  const actions = usePaywallActions();
  const [showPicker, setShowPicker] = useState(false);
  const [pickerHabits, setPickerHabits] = useState<PickerHabit[]>([]);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [pickerError, setPickerError] = useState<string | null>(null);
  const cleanupRanRef = useRef(false);
  const cleanupAttemptsRef = useRef(0);
  const cleanupUserRef = useRef<string | null>(user?.id ?? null);
  const prevPickerUserRef = useRef<string | null>(user?.id ?? null);
  const [cleanupRetryTick, setCleanupRetryTick] = useState(0);
  // Bumped whenever we leave hard_block; an in-flight openPicker load captures
  // it and discards its result if the episode changed, so a late list response
  // can't restore a stale picker after the reset.
  const episodeRef = useRef(0);
  // Per-load sequence within an episode: a later Retry supersedes an earlier
  // in-flight load, so an older (e.g. failed) request can't overwrite a newer
  // successful one.
  const pickerReqRef = useRef(0);
  // Latest (user, entitlement status) pair, BOUND TOGETHER and updated DURING
  // RENDER. An async archive completion reads this to decide whether to
  // reconcile; a passive effect could lag a fast account switch, and the status
  // alone is not enough — user-1's in-flight archive must not restore based on
  // user-2's paid status after a switch. Gate on BOTH paid AND userId match.
  const entitlementUserRef = useRef({ userId: user?.id ?? null, status: entitlementStatus });
  entitlementUserRef.current = { userId: user?.id ?? null, status: entitlementStatus };

  // If paid arrived (e.g. a purchase on another device) WHILE we were archiving,
  // the session-latched reconcile hook may have run its one-shot scan BEFORE our
  // rows were tagged paywall_keep_one — and won't re-run while status stays
  // paid. Re-run the idempotent restore here so those rows aren't stranded.
  const reconcileIfPaidRaced = useCallback(
    async (uid: string) => {
      const stillPaidForUser = () => {
        const snap = entitlementUserRef.current;
        return snap.userId === uid && isPaidStatus(snap.status);
      };
      if (!stillPaidForUser()) return;
      // Bounded retry: the archive has already committed, and the session
      // reconcile hook may already be latched at zero rows (it scanned before
      // these rows were tagged), so a transient restore failure here would
      // otherwise strand the rows until app restart.
      for (let attempt = 1; attempt <= MAX_RECONCILE_ATTEMPTS; attempt++) {
        // Re-check before each attempt: an account switch mid-retry must abort
        // so we never restore the wrong user's habits.
        if (!stillPaidForUser()) return;
        try {
          await restorePaywallKeptHabits(uid);
          await queryClient.invalidateQueries({ queryKey: ["habits"] });
          return;
        } catch (error) {
          logger.warn("Paid-race keep-one reconcile failed; will retry", {
            error,
            attempt,
          });
          if (attempt < MAX_RECONCILE_ATTEMPTS) await sleep(RECONCILE_RETRY_MS);
        }
      }
    },
    [queryClient],
  );

  // This component stays mounted under the (app) layout, so its picker state
  // must NOT leak into a future episode — either the gate leaving hard_block
  // (keep-one → upgrade → refund → hard-block again) OR a direct ACCOUNT SWITCH
  // that stays hard_block. A stale habit id from a different user/episode would
  // make the archive keep NOTHING and wipe every current habit. Reset on both.
  useEffect(() => {
    const userId = user?.id ?? null;
    const userChanged = prevPickerUserRef.current !== userId;
    prevPickerUserRef.current = userId;
    if (userChanged || gate.status !== "hard_block") {
      episodeRef.current += 1; // invalidate any in-flight openPicker load
      setShowPicker(false);
      setPickerHabits([]);
      setPickerError(null);
    }
  }, [gate.status, user?.id]);

  // Fire paywall_shown once per hard_block episode (reset when we leave it, so a
  // later episode — refund back to hard-block — re-fires).
  const shownRef = useRef(false);
  useEffect(() => {
    if (gate.status === "hard_block") {
      if (!shownRef.current) {
        shownRef.current = true;
        trackEvent("paywall_shown", { trigger: "expiry" });
      }
    } else {
      shownRef.current = false;
    }
  }, [gate.status]);

  // Auto-resolve: archive leftover backlog so a <=1-active free-tier user's
  // queued habits restore on upgrade. Idempotent. A rejection is caught (not
  // left as an unhandled rejection); on failure it clears the latch and
  // schedules a BOUNDED timer retry — clearing the latch alone wouldn't re-run
  // the effect while the gate is stable, so the retry is driven through state.
  useEffect(() => {
    const userId = user?.id ?? null;
    // Account switch: the latch/budget belong to the previous user, so reset
    // them — otherwise a free_tier → free_tier switch would skip the new user's
    // cleanup (or, worse, attribute it to the old episode).
    if (cleanupUserRef.current !== userId) {
      cleanupUserRef.current = userId;
      cleanupRanRef.current = false;
      cleanupAttemptsRef.current = 0;
    }
    if (gate.status !== "free_tier" || !gate.needsCleanup || !userId) {
      // Left the cleanup state — reset the latch + budget so a FUTURE cleanup
      // episode (e.g. refund back to free tier after an upgrade restored the
      // backlog) runs again. The latch must not outlive the episode for the
      // life of this always-mounted component.
      cleanupRanRef.current = false;
      cleanupAttemptsRef.current = 0;
      return;
    }
    if (cleanupRanRef.current) return;
    if (cleanupAttemptsRef.current >= MAX_CLEANUP_ATTEMPTS) return;
    cleanupAttemptsRef.current += 1;
    cleanupRanRef.current = true; // optimistic — blocks concurrent re-entry
    let cancelled = false;
    let timer: ReturnType<typeof setTimeout> | undefined;
    void archiveHabitsForPaywallKeepOne(userId, gate.soleActiveHabitId)
      .then(() => queryClient.invalidateQueries({ queryKey: ["habits"] }))
      .then(() => reconcileIfPaidRaced(userId))
      .catch((error) => {
        if (cancelled) return;
        logger.warn("Paywall backlog auto-cleanup failed; will retry", {
          error,
          attempt: cleanupAttemptsRef.current,
        });
        cleanupRanRef.current = false; // clear latch so the scheduled retry runs
        if (cleanupAttemptsRef.current < MAX_CLEANUP_ATTEMPTS) {
          timer = setTimeout(
            () => setCleanupRetryTick((tick) => tick + 1),
            CLEANUP_RETRY_MS,
          );
        }
      });
    return () => {
      cancelled = true;
      if (timer) clearTimeout(timer);
    };
  }, [
    gate.status,
    gate.needsCleanup,
    gate.soleActiveHabitId,
    user?.id,
    queryClient,
    cleanupRetryTick,
    reconcileIfPaidRaced,
  ]);

  if (gate.status !== "hard_block") return null;

  async function openPicker() {
    if (!user?.id) return;
    const episode = episodeRef.current;
    const reqId = (pickerReqRef.current += 1);
    const userId = user.id;
    const isStale = () =>
      episodeRef.current !== episode || pickerReqRef.current !== reqId;
    setPickerError(null);
    try {
      const [actives, backlog] = await Promise.all([
        listActiveHabits(userId),
        listBacklogHabits(userId),
      ]);
      // Drop the result if the episode changed (gate left hard_block) OR a newer
      // load (Retry) superseded this one.
      if (isStale()) return;
      setPickerHabits(
        // Only manageable (habit_state='active') habits are keep-one options —
        // graduated/automatic habits consume no free-tier slot and are never
        // archived (mirrors archiveHabitsForPaywallKeepOne + the gate's count).
        [...actives, ...backlog]
          .filter((h) => h.habit_state === "active")
          .map((h) => ({
            id: h.id,
            title: h.title,
            identity_phrase: h.identity_phrase,
            status: h.status,
          })),
      );
      setShowPicker(true);
    } catch (error) {
      if (isStale()) return;
      // Don't let the rejection escape a void callback. Open the picker in its
      // load-error state (no choices, no destructive confirm) so the user gets
      // a retryable error rather than silently archiving everything.
      logger.error("Failed to load keep-one habit list", { error });
      setPickerHabits([]);
      setPickerError(paywallCopy.keepOneError);
      setShowPicker(true);
    }
  }

  async function confirmKeepOne(keptHabitId: string | null) {
    if (!user?.id) return;
    const uid = user.id;
    setPickerError(null);
    setIsSubmitting(true);
    try {
      await archiveHabitsForPaywallKeepOne(uid, keptHabitId);
      await queryClient.invalidateQueries({ queryKey: ["habits"] });
    } catch (error) {
      // Surface a retryable error and keep the picker open; the gate stays
      // hard_block (nothing archived), so the user can try again.
      logger.error("Failed to archive habits for keep-one", { error });
      setPickerError(paywallCopy.keepOneError);
      setIsSubmitting(false);
      return;
    }
    setIsSubmitting(false);
    // The archive COMMITTED. Reconcile is a separate, best-effort concern: if
    // paid raced this keep-one, the session-latched reconcile hook may have
    // scanned zero rows before these were tagged, so it won't pick them up.
    // reconcileIfPaidRaced restores them with its own bounded retry — a failure
    // here must NOT surface as an archive error (the archive succeeded).
    await reconcileIfPaidRaced(uid);
  }

  return (
    <View style={StyleSheet.absoluteFill}>
      {showPicker ? (
        <KeepOnePicker
          habits={pickerHabits}
          isSubmitting={isSubmitting}
          errorMessage={pickerError}
          onConfirm={confirmKeepOne}
          onCancel={() => setShowPicker(false)}
          onRetry={() => void openPicker()}
        />
      ) : (
        <PaywallScreen
          variant="expiry"
          isPurchasing={actions.isPurchasing}
          isRestoring={actions.isRestoring}
          isVerifying={actions.isVerifying}
          isBusy={actions.isBusy}
          status={actions.status}
          showRefundedBanner={entitlementStatus === "cancelled"}
          onUnlock={actions.onUnlock}
          onRestore={actions.onRestore}
          onRecheck={actions.onRecheck}
          onContinueFree={() => void openPicker()}
          onDismiss={() => {}}
        />
      )}
    </View>
  );
}
