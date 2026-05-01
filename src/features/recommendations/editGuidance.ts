import { HABIT_ADJUSTMENT_SUGGESTIONS } from "@/features/recommendations/copy";
import { normalizeHabitAdjustmentSuggestionType } from "@/features/recommendations/types";

import type { HabitAdjustmentSuggestionType } from "@/features/recommendations/types";

export type HabitSuggestionEditGuidance = {
  body: string;
  draftBody: string;
  draftTitle: string;
  reason: string;
  title: string;
};

const HABIT_SUGGESTION_EDIT_GUIDANCE_COPY: Record<
  HabitAdjustmentSuggestionType,
  Omit<HabitSuggestionEditGuidance, "reason">
> = {
  change_trigger: {
    body: "Try attaching this habit to a specific moment that already happens every day.",
    draftBody: "Look at your Stack trigger field and make it more specific. Try a clear moment like after breakfast or after brushing your teeth.",
    draftTitle: "Suggested draft",
    title: "Choose a clearer trigger",
  },
  keep_going: {
    body: "This habit seems workable. You may not need to change anything yet.",
    draftBody: "No change may be needed right now. Keep the same trigger and tiny action for another week unless you personally want to adjust something.",
    draftTitle: "Suggested draft",
    title: "Keep it stable",
  },
  make_tiny_action_smaller: {
    body: "Try choosing a tiny action that feels almost effortless for one week.",
    draftBody: "Look at your Tiny action field and make it smaller. For example, change a big action into one small step you can do in under two minutes.",
    draftTitle: "Suggested draft",
    title: "Make the action smaller",
  },
  plan_for_obstacle: {
    body: "Use what got in the way last week to make one small adjustment.",
    draftBody: "Use the hard part from your review to choose one practical adjustment. For example, change the time, place, or setup so the same obstacle is less likely.",
    draftTitle: "Suggested draft",
    title: "Plan around the hard part",
  },
  reduce_friction: {
    body: "Try changing the setup so starting this habit takes less effort.",
    draftBody: "Look for one setup change that makes the habit easier to start. For example, prepare the item you need ahead of time or move it somewhere visible.",
    draftTitle: "Suggested draft",
    title: "Reduce the friction",
  },
};

export const HABIT_SUGGESTION_EDIT_GUIDANCE: Record<
  HabitAdjustmentSuggestionType,
  HabitSuggestionEditGuidance
> = {
  change_trigger: {
    ...HABIT_SUGGESTION_EDIT_GUIDANCE_COPY.change_trigger,
    reason: HABIT_ADJUSTMENT_SUGGESTIONS.change_trigger.reason,
  },
  keep_going: {
    ...HABIT_SUGGESTION_EDIT_GUIDANCE_COPY.keep_going,
    reason: HABIT_ADJUSTMENT_SUGGESTIONS.keep_going.reason,
  },
  make_tiny_action_smaller: {
    ...HABIT_SUGGESTION_EDIT_GUIDANCE_COPY.make_tiny_action_smaller,
    reason: HABIT_ADJUSTMENT_SUGGESTIONS.make_tiny_action_smaller.reason,
  },
  plan_for_obstacle: {
    ...HABIT_SUGGESTION_EDIT_GUIDANCE_COPY.plan_for_obstacle,
    reason: HABIT_ADJUSTMENT_SUGGESTIONS.plan_for_obstacle.reason,
  },
  reduce_friction: {
    ...HABIT_SUGGESTION_EDIT_GUIDANCE_COPY.reduce_friction,
    reason: HABIT_ADJUSTMENT_SUGGESTIONS.reduce_friction.reason,
  },
};

export function getHabitSuggestionEditGuidance(
  suggestionType: string | string[] | undefined,
): HabitSuggestionEditGuidance | null {
  const normalized = normalizeHabitAdjustmentSuggestionType(suggestionType);

  return normalized ? HABIT_SUGGESTION_EDIT_GUIDANCE[normalized] : null;
}
