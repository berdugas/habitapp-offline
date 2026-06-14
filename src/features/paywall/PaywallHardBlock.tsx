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
import { logger } from "@/services/logger";

type PickerHabit = { id: string; title: string; identity_phrase: string | null; status: string };

// Bound auto-cleanup retries so a persistently-failing archive can't loop the
// effect every render, while a transient failure still gets a few more shots.
const MAX_CLEANUP_ATTEMPTS = 3;

export function PaywallHardBlock() {
  const gate = usePaywallGate();
  const { user } = useAuthSession();
  const { entitlementStatus } = useTrialValidation();
  const queryClient = useQueryClient();
  const actions = usePaywallActions();
  const [showPicker, setShowPicker] = useState(false);
  const [pickerHabits, setPickerHabits] = useState<PickerHabit[]>([]);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const cleanupRanRef = useRef(false);
  const cleanupAttemptsRef = useRef(0);

  // Auto-resolve: archive leftover backlog so a <=1-active free-tier user's
  // queued habits restore on upgrade. Idempotent. The latch is set only AFTER
  // the archive succeeds, and a rejection is caught (not left as an unhandled
  // rejection) — so a transient SQLite failure can retry on a later render
  // instead of permanently stranding the backlog. Attempts are bounded.
  useEffect(() => {
    if (gate.status !== "free_tier" || !gate.needsCleanup || !user?.id) return;
    if (cleanupRanRef.current) return;
    if (cleanupAttemptsRef.current >= MAX_CLEANUP_ATTEMPTS) return;
    cleanupAttemptsRef.current += 1;
    const userId = user.id;
    void archiveHabitsForPaywallKeepOne(userId, gate.soleActiveHabitId)
      .then(() => {
        cleanupRanRef.current = true;
        return queryClient.invalidateQueries({ queryKey: ["habits"] });
      })
      .catch((error) => {
        // Latch stays open → a later render (e.g. after the gate refetches)
        // retries, up to MAX_CLEANUP_ATTEMPTS.
        logger.warn("Paywall backlog auto-cleanup failed; will retry", {
          error,
          attempt: cleanupAttemptsRef.current,
        });
      });
  }, [gate.status, gate.needsCleanup, gate.soleActiveHabitId, user?.id, queryClient]);

  if (gate.status !== "hard_block") return null;

  async function openPicker() {
    if (!user?.id) return;
    const [actives, backlog] = await Promise.all([
      listActiveHabits(user.id),
      listBacklogHabits(user.id),
    ]);
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
  }

  async function confirmKeepOne(keptHabitId: string | null) {
    if (!user?.id) return;
    setIsSubmitting(true);
    try {
      await archiveHabitsForPaywallKeepOne(user.id, keptHabitId);
      await queryClient.invalidateQueries({ queryKey: ["habits"] });
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
          onConfirm={confirmKeepOne}
          onCancel={() => setShowPicker(false)}
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
