import { getHabitAdjustmentSuggestions } from "@/features/recommendations/habitAdjustmentEngine";

import type { HabitRecord } from "@/features/habits/types";
import type { WeeklyReviewRecord } from "@/features/reviews/types";

const baseHabit: HabitRecord = {
  active_days: "[1,2,3,4,5,6,7]",
  archived_at: null,
  automated_at: null,
  backlog_at: null,
  created_at: "2026-04-01T00:00:00.000Z",
  cue: "After breakfast",
  habit_state: "active",
  icon: null,
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

function getSuggestions({
  progress = stableProgress,
  review = baseReview,
}: {
  progress?: { consistencyRate: number; skipCount: number; streak: number };
  review?: WeeklyReviewRecord;
} = {}) {
  return getHabitAdjustmentSuggestions({
    habit: baseHabit,
    latestReview: review,
    progress,
  });
}

describe("getHabitAdjustmentSuggestions", () => {
  it("returns [make_tiny_action_smaller] when tiny action is too hard", () => {
    const suggestions = getSuggestions({
      review: { ...baseReview, tiny_action_too_hard: true },
    });

    expect(suggestions).toHaveLength(1);
    expect(suggestions[0].type).toBe("make_tiny_action_smaller");
  });

  it("returns [change_trigger] when trigger did not work", () => {
    const suggestions = getSuggestions({
      review: { ...baseReview, trigger_worked: false },
    });

    expect(suggestions).toHaveLength(1);
    expect(suggestions[0].type).toBe("change_trigger");
  });

  it("returns [make_tiny_action_smaller, change_trigger] when both flags fire (action-fix first)", () => {
    const suggestions = getSuggestions({
      review: { ...baseReview, tiny_action_too_hard: true, trigger_worked: false },
    });

    expect(suggestions).toHaveLength(2);
    expect(suggestions[0].type).toBe("make_tiny_action_smaller");
    expect(suggestions[1].type).toBe("change_trigger");
  });

  it("returns [reduce_friction] when consistency is low", () => {
    const suggestions = getSuggestions({
      progress: { consistencyRate: 0.49, skipCount: 0, streak: 0 },
    });

    expect(suggestions).toHaveLength(1);
    expect(suggestions[0].type).toBe("reduce_friction");
  });

  it("returns [reduce_friction] when skip count is high", () => {
    const suggestions = getSuggestions({
      progress: { consistencyRate: 1, skipCount: 3, streak: 0 },
    });

    expect(suggestions).toHaveLength(1);
    expect(suggestions[0].type).toBe("reduce_friction");
  });

  it("returns [plan_for_obstacle] when review names a hard obstacle", () => {
    const suggestions = getSuggestions({
      review: { ...baseReview, was_hard: "   I kept forgetting after breakfast   " },
    });

    expect(suggestions).toHaveLength(1);
    expect(suggestions[0].type).toBe("plan_for_obstacle");
  });

  it("returns [keep_going] when no issue rule matches", () => {
    const suggestions = getSuggestions();

    expect(suggestions).toHaveLength(1);
    expect(suggestions[0]).toEqual({
      body: "This habit seems workable. Keep the same trigger and tiny action for another week before making changes.",
      reason: "Your review does not point to a major change yet.",
      title: "Keep it stable",
      type: "keep_going",
    });
  });

  it("never returns an empty array (keep_going is always the fallback)", () => {
    // Base review with no flags set should still return at least one suggestion.
    const suggestions = getSuggestions();
    expect(suggestions.length).toBeGreaterThanOrEqual(1);
  });

  it("never returns more than 2 suggestions", () => {
    const allCombinations = [
      { review: baseReview, progress: stableProgress },
      { review: { ...baseReview, tiny_action_too_hard: true }, progress: stableProgress },
      { review: { ...baseReview, trigger_worked: false }, progress: stableProgress },
      {
        review: { ...baseReview, tiny_action_too_hard: true, trigger_worked: false },
        progress: stableProgress,
      },
      {
        review: { ...baseReview, was_hard: "tired" },
        progress: { consistencyRate: 0.1, skipCount: 5, streak: 0 },
      },
    ];

    for (const input of allCombinations) {
      const suggestions = getSuggestions(input);
      expect(suggestions.length).toBeLessThanOrEqual(2);
    }
  });

  it("never returns the removed fix_trigger_and_tiny_action type", () => {
    const suggestions = getSuggestions({
      review: { ...baseReview, tiny_action_too_hard: true, trigger_worked: false },
    });

    for (const s of suggestions) {
      expect(s.type).not.toBe("fix_trigger_and_tiny_action");
    }
  });
});
