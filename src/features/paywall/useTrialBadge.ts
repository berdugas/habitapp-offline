import { useTrialValidation } from "@/features/trial/hooks";
import { now } from "@/utils/clock";

import type { TrialEntitlementStatus } from "@/features/trial/types";

const BADGE_WINDOW_DAYS = 7;
const MS_PER_DAY = 24 * 60 * 60 * 1000;

export type TrialBadgeState = { visible: boolean; daysLeft: number };

export function computeTrialBadge(
  status: TrialEntitlementStatus | null,
  trialEndsAt: string | null,
  current: Date,
): TrialBadgeState {
  if (status !== "trial" || !trialEndsAt) return { visible: false, daysLeft: 0 };
  const ends = new Date(trialEndsAt);
  if (Number.isNaN(ends.getTime())) return { visible: false, daysLeft: 0 };
  const msLeft = ends.getTime() - current.getTime();
  const daysLeft = Math.ceil(msLeft / MS_PER_DAY);
  return { visible: daysLeft >= 1 && daysLeft <= BADGE_WINDOW_DAYS, daysLeft };
}

export function useTrialBadge(): TrialBadgeState {
  const { entitlementStatus, trialEndsAt } = useTrialValidation();
  return computeTrialBadge(entitlementStatus, trialEndsAt, now());
}
