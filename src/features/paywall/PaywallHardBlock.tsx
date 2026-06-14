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

type PickerHabit = { id: string; title: string; identity_phrase: string | null; status: string };

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

  // Auto-resolve: archive leftover backlog so a <=1-active free-tier
  // user's queued habits restore on upgrade. Idempotent + once per mount.
  useEffect(() => {
    if (gate.status !== "free_tier" || !gate.needsCleanup || !user?.id) return;
    if (cleanupRanRef.current) return;
    cleanupRanRef.current = true;
    void archiveHabitsForPaywallKeepOne(user.id, gate.soleActiveHabitId).then(() =>
      queryClient.invalidateQueries({ queryKey: ["habits"] }),
    );
  }, [gate.status, gate.needsCleanup, gate.soleActiveHabitId, user?.id, queryClient]);

  if (gate.status !== "hard_block") return null;

  async function openPicker() {
    if (!user?.id) return;
    const [actives, backlog] = await Promise.all([
      listActiveHabits(user.id),
      listBacklogHabits(user.id),
    ]);
    setPickerHabits(
      [...actives, ...backlog].map((h) => ({
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
          showRefundedBanner={entitlementStatus === "cancelled"}
          onUnlock={actions.onUnlock}
          onRestore={actions.onRestore}
          onContinueFree={() => void openPicker()}
          onDismiss={() => {}}
        />
      )}
    </View>
  );
}
