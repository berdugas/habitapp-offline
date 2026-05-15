import {
  GRADUATION_COOLDOWN_DAYS,
  GRADUATION_MIN_ACTIVE_DAYS,
  GRADUATION_MIN_CONSISTENCY,
  GRADUATION_PASSING_SCORE,
} from "@/lib/graduation/constants";
import type { HabitState, HabitStatus } from "@/lib/db/repositories/habits";
import type { SRHIResponse } from "@/lib/db/repositories/srhi_responses";
import { daysBetweenDates } from "@/utils/dates";

export {
  GRADUATION_COOLDOWN_DAYS,
  GRADUATION_MIN_ACTIVE_DAYS,
  GRADUATION_MIN_CONSISTENCY,
  GRADUATION_PASSING_SCORE,
};

export type EligibilityReason =
  | "eligible"
  | "already_graduated"
  | "not_active"
  | "too_young"
  | "consistency_too_low"
  | "cooldown";

export type EligibilityInput = {
  habit: {
    id: string;
    habit_state: HabitState;
    status: HabitStatus;
    start_date: string;
  };
  consistencyRate: number;
  activeDaysElapsed: number;
  latestSRHI: SRHIResponse | null;
  todayDate: string;
};

export type EligibilityResult = {
  eligible: boolean;
  reason: EligibilityReason;
};

export function checkGraduationEligibility(
  input: EligibilityInput,
): EligibilityResult {
  if (input.habit.status !== "active") {
    return { eligible: false, reason: "not_active" };
  }

  if (input.habit.habit_state === "automatic") {
    return { eligible: false, reason: "already_graduated" };
  }

  if (input.activeDaysElapsed < GRADUATION_MIN_ACTIVE_DAYS) {
    return { eligible: false, reason: "too_young" };
  }

  if (input.consistencyRate < GRADUATION_MIN_CONSISTENCY) {
    return { eligible: false, reason: "consistency_too_low" };
  }

  if (input.latestSRHI && input.latestSRHI.graduated === false) {
    const days = daysBetweenDates(
      input.latestSRHI.created_at,
      input.todayDate,
    );
    if (days < GRADUATION_COOLDOWN_DAYS) {
      return { eligible: false, reason: "cooldown" };
    }
  }

  return { eligible: true, reason: "eligible" };
}
