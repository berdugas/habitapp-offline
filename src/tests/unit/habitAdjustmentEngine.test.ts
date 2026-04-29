import { getHabitAdjustmentSuggestion } from "@/features/recommendations/habitAdjustmentEngine";

import type { HabitRecord } from "@/features/habits/types";
import type { WeeklyReviewRecord } from "@/features/reviews/types";

const baseHabit: HabitRecord = {
  archived_at: null,
  automated_at: null,
  backlog_at: null,
  created_at: "2026-04-01T00:00:00.000Z",
  cue: "After breakfast",
  habit_state: "focus",
  id: "habit-1",
  identity_phrase: null,
  minimum_viable_action: null,
  preferred_time_window: null,
  start_date: "2026-04-20",
  status: "active",
  tiny_action: "Read 1 page",
  title: "Reading",
  updated_at: "2026-04-01T00:00:00.000Z",
  user_id: "user-1",
};

const baseReview: WeeklyReviewRecord = {
  adjustment_note: null,
  created_at: "2026-04-24T00:00:00.000Z",
  habit_id: "habit-1",
  id: "review-1",
  tiny_action_too_hard: null,
  trigger_worked: true,
  updated_at: "2026-04-24T00:00:00.000Z",
  user_id: "user-1",
  was_hard: null,
  week_start: "2026-04-20",
  went_well: "Breakfast cue worked",
};

const stableProgress = {
  consistencyRate: 1,
  skipCount: 0,
  streak: 4,
};

function getSuggestion({
  progress = stableProgress,
  review = baseReview,
}: {
  progress?: {
    consistencyRate: number;
    skipCount: number;
    streak: number;
  };
  review?: WeeklyReviewRecord;
} = {}) {
  return getHabitAdjustmentSuggestion({
    habit: baseHabit,
    latestReview: review,
    progress,
  });
}

describe("getHabitAdjustmentSuggestion", () => {
  it("suggests making the tiny action smaller when it was too hard", () => {
    const suggestion = getSuggestion({
      review: {
        ...baseReview,
        tiny_action_too_hard: true,
      },
    });

    expect(suggestion).toEqual({
      body: "Your tiny action may still be too hard. Try making it so small that it feels almost effortless for one week.",
      reason: "You answered that the tiny action was too hard.",
      title: "Make it smaller next week",
      type: "make_tiny_action_smaller",
    });
  });

  it("suggests adjusting both fields when the trigger failed and the tiny action was too hard", () => {
    const suggestion = getSuggestion({
      review: {
        ...baseReview,
        tiny_action_too_hard: true,
        trigger_worked: false,
      },
    });

    expect(suggestion).toEqual({
      body: "Your trigger did not work, and the tiny action felt too hard. Try making both parts easier for next week.",
      reason:
        "You answered that the trigger did not work and the tiny action was too hard.",
      title: "Adjust trigger and action",
      type: "fix_trigger_and_tiny_action",
    });
  });

  it("suggests changing the trigger when the trigger did not work", () => {
    const suggestion = getSuggestion({
      review: {
        ...baseReview,
        trigger_worked: false,
      },
    });

    expect(suggestion.type).toBe("change_trigger");
    expect(suggestion.title).toBe("Adjust your trigger");
    expect(suggestion.reason).toBe("You answered that the trigger did not work.");
  });

  it("suggests reducing friction when consistency is low", () => {
    const suggestion = getSuggestion({
      progress: {
        consistencyRate: 0.49,
        skipCount: 0,
        streak: 0,
      },
    });

    expect(suggestion.type).toBe("reduce_friction");
    expect(suggestion.title).toBe("Reduce the friction");
    expect(suggestion.reason).toBe(
      "An easier setup may help with your recent consistency or skip pattern.",
    );
  });

  it("suggests reducing friction when skip count is high", () => {
    const suggestion = getSuggestion({
      progress: {
        consistencyRate: 1,
        skipCount: 3,
        streak: 0,
      },
    });

    expect(suggestion.type).toBe("reduce_friction");
    expect(suggestion.reason).toBe(
      "An easier setup may help with your recent consistency or skip pattern.",
    );
  });

  it("suggests planning around the hard part when the review names an obstacle", () => {
    const suggestion = getSuggestion({
      review: {
        ...baseReview,
        was_hard: "   I kept forgetting after breakfast   ",
      },
    });

    expect(suggestion.type).toBe("plan_for_obstacle");
    expect(suggestion.title).toBe("Plan around the hard part");
    expect(suggestion.reason).toBe(
      "You wrote about something that made the habit hard this week.",
    );
  });

  it("suggests keeping the habit stable when no issue rule matches", () => {
    const suggestion = getSuggestion();

    expect(suggestion).toEqual({
      body: "This habit seems workable. Keep the same trigger and tiny action for another week before making changes.",
      reason: "Your review does not point to a major change yet.",
      title: "Keep it stable",
      type: "keep_going",
    });
  });

  it("respects rule priority when multiple signals match", () => {
    const suggestion = getSuggestion({
      progress: {
        consistencyRate: 0.1,
        skipCount: 5,
        streak: 0,
      },
      review: {
        ...baseReview,
        tiny_action_too_hard: true,
        trigger_worked: false,
        was_hard: "I was too tired",
      },
    });

    expect(suggestion.type).toBe("fix_trigger_and_tiny_action");
  });
});
