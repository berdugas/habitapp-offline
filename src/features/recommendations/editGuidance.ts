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
  reduce_friction: {
    // Matches the reframe in `copy.ts` — when both diagnostic flags
    // say the setup is fine but consistency is still low, the friction
    // isn't the setup itself; it's somewhere else in the moment around
    // the habit. EditHabitScreen surfaces this guidance when the user
    // navigates in with `suggestionType=reduce_friction`.
    body: "Setup's fine — something else got in the way. Look at the moment around the habit: energy, time of day, location, what comes right before. Pick one to change.",
    draftBody: "The trigger and tiny action both held up, so the friction isn't in the habit itself — it's in the moment around it. Look for one small change to that context: energy level, time of day, location, or what immediately precedes the habit.",
    draftTitle: "Suggested draft",
    title: "Look beyond the setup",
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
