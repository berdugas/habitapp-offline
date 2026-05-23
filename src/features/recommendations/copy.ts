import type {
  HabitAdjustmentSuggestion,
  HabitAdjustmentSuggestionType,
} from "@/features/recommendations/types";

export const HABIT_ADJUSTMENT_SUGGESTIONS: Record<
  HabitAdjustmentSuggestionType,
  HabitAdjustmentSuggestion
> = {
  change_trigger: {
    body: "Your trigger may not be reliable yet. Try attaching this habit to a clearer moment that already happens every day.",
    reason: "You answered that the trigger did not work.",
    title: "Adjust your trigger",
    type: "change_trigger",
  },
  keep_going: {
    body: "This habit seems workable. Keep the same trigger and tiny action for another week before making changes.",
    reason: "Your review does not point to a major change yet.",
    title: "Keep it stable",
    type: "keep_going",
  },
  make_tiny_action_smaller: {
    body: "Your tiny action may still be too hard. Try making it so small that it feels almost effortless for one week.",
    reason: "You answered that the tiny action was too hard.",
    title: "Make it smaller next week",
    type: "make_tiny_action_smaller",
  },
  reduce_friction: {
    // Static fallback. The TuneUpStep renders a dynamic version that
    // includes the actual "X of Y days" count for the habit being
    // reviewed — see `bodyForSuggestion` in TuneUpStep.tsx. This static
    // body is used by EditHabitScreen (no per-habit context) and by
    // anywhere else that consumes the suggestion's `body` directly.
    //
    // Framing note: `reduce_friction` only fires when the user said
    // BOTH trigger worked AND the tiny action wasn't too hard (per
    // habitAdjustmentEngine.ts:44). The old copy "make the setup
    // easier" contradicted the user's own answers. The new copy
    // acknowledges the gap: setup's fine, something else is in play.
    body: "Your trigger held and the action isn't too hard — but the habit missed most days. Something between intention and action is failing. Name what it is, and pick one small change to make it less likely next week.",
    reason: "Your trigger and tiny action both held up, but the habit missed most days.",
    title: "Something else is in the way",
    type: "reduce_friction",
  },
};
