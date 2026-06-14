import { useTrialValidation } from "@/features/trial/hooks";
import { useActiveHabitCountQuery } from "@/features/habits/hooks";

export type PaywallGate = {
  status: "inactive" | "hard_block" | "free_tier";
  needsCleanup: boolean;
  soleActiveHabitId: string | null;
};

/**
 * Single source of truth for the paywall state machine. `inactive` while the
 * count query loads so we never flash a paywall before we know the habit count
 * (avoids briefly blocking a paid user mid-refresh).
 */
export function usePaywallGate(): PaywallGate {
  const { accessMode } = useTrialValidation();
  const count = useActiveHabitCountQuery();

  if (accessMode !== "expired_no_purchase" || !count.data) {
    return { status: "inactive", needsCleanup: false, soleActiveHabitId: null };
  }

  const { activeCount, manageable, soleActiveHabitId } = count.data;
  if (activeCount >= 2) {
    return { status: "hard_block", needsCleanup: false, soleActiveHabitId };
  }
  return { status: "free_tier", needsCleanup: manageable > 1, soleActiveHabitId };
}
