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

  if (accessMode !== "expired_no_purchase") {
    return { status: "inactive", needsCleanup: false, soleActiveHabitId: null };
  }

  // Expired user. If the count couldn't be established (terminal query error,
  // not loading) we must FAIL CLOSED — logging is intentionally
  // entitlement-agnostic, so an "inactive" gate here would let an expired user
  // keep using an unknown number of habits. hard_block is retryable: the count
  // query refetches (focus/reconnect/invalidation) and the gate recomputes, and
  // the expiry paywall offers Unlock/Restore. Loading is different — stay
  // inactive so we don't flash a paywall before we know the count.
  if (count.isError) {
    return { status: "hard_block", needsCleanup: false, soleActiveHabitId: null };
  }
  if (!count.data) {
    return { status: "inactive", needsCleanup: false, soleActiveHabitId: null };
  }

  const { activeCount, manageable, soleActiveHabitId } = count.data;
  if (activeCount >= 2) {
    return { status: "hard_block", needsCleanup: false, soleActiveHabitId };
  }
  return { status: "free_tier", needsCleanup: manageable > 1, soleActiveHabitId };
}
