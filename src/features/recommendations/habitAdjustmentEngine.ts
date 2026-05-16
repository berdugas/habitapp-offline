import { HABIT_ADJUSTMENT_SUGGESTIONS } from "@/features/recommendations/copy";

import type {
  HabitAdjustmentInput,
  HabitAdjustmentSuggestion,
  HabitAdjustmentSuggestionType,
} from "@/features/recommendations/types";

function getSuggestion(
  type: HabitAdjustmentSuggestionType,
): HabitAdjustmentSuggestion {
  return HABIT_ADJUSTMENT_SUGGESTIONS[type];
}

export function getKeepGoingSuggestion(): HabitAdjustmentSuggestion {
  return getSuggestion("keep_going");
}

export function getHabitAdjustmentSuggestions({
  latestReview,
  progress,
}: HabitAdjustmentInput): HabitAdjustmentSuggestion[] {
  // When both flags fire, return action-fix first then trigger-fix (D9).
  // Returning two separate suggestions matches priority ordering already used
  // for the single-flag cases, and avoids the misleading "fix both" merged card.
  if (
    latestReview.tiny_action_too_hard === true &&
    latestReview.trigger_worked === false
  ) {
    return [
      getSuggestion("make_tiny_action_smaller"),
      getSuggestion("change_trigger"),
    ];
  }

  if (latestReview.tiny_action_too_hard === true) {
    return [getSuggestion("make_tiny_action_smaller")];
  }

  if (latestReview.trigger_worked === false) {
    return [getSuggestion("change_trigger")];
  }

  if (progress.consistencyRate < 0.5 || progress.skipCount >= 3) {
    return [getSuggestion("reduce_friction")];
  }

  if (Boolean(latestReview.was_hard?.trim())) {
    return [getSuggestion("plan_for_obstacle")];
  }

  return [getSuggestion("keep_going")];
}
