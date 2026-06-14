import { useEffect, useRef, useState } from "react";
import { StyleSheet, View } from "react-native";
import { useQueryClient } from "@tanstack/react-query";

import { useAuthSession } from "@/features/auth/hooks";
import { useTrialValidation } from "@/features/trial/hooks";
import {
  archiveHabitsForPaywallKeepOne,
  listActiveHabits,
  listBacklogHabits,
} from "@/features/habits/api";
import { usePaywallGate } from "@/features/paywall/usePaywallGate";
import { usePaywallActions } from "@/features/paywall/PaywallController";
import { PaywallScreen } from "@/features/paywall/PaywallScreen";
import { KeepOnePicker } from "@/features/paywall/KeepOnePicker";
import { paywallCopy } from "@/features/paywall/copy";
import { logger } from "@/services/logger";

type PickerHabit = { id: string; title: string; identity_phrase: string | null; status: string };

// Bound auto-cleanup retries so a persistently-failing archive can't loop
// forever, while a transient failure still gets a few more shots via a timer.
const MAX_CLEANUP_ATTEMPTS = 3;
const CLEANUP_RETRY_MS = 3000;

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
    setPickerError(null);
    setIsSubmitting(true);
    try {
      await archiveHabitsForPaywallKeepOne(user.id, keptHabitId);
      await queryClient.invalidateQueries({ queryKey: ["habits"] });
    } catch (error) {
      // Surface a retryable error and keep the picker open; the gate stays
      // hard_block (nothing archived), so the user can try again.
      logger.error("Failed to archive habits for keep-one", { error });
      setPickerError(paywallCopy.keepOneError);
    } finally {
      setIsSubmitting(false);
    }
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
