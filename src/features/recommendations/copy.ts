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
  plan_for_obstacle: {
    body: "You already noticed what got in the way. Pick one small change that makes that obstacle less likely next week.",
    reason: "You wrote about something that made the habit hard this week.",
    title: "Plan around the hard part",
    type: "plan_for_obstacle",
  },
  reduce_friction: {
    body: "This habit may need an easier setup. Try preparing the environment ahead of time so starting takes less effort.",
    reason: "An easier setup may help with your recent consistency or skip pattern.",
    title: "Reduce the friction",
    type: "reduce_friction",
  },
};
