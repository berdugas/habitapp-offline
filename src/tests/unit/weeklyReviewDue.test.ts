import { isWeeklyReviewDue } from "@/features/reviews/due";
import type { Habit } from "@/features/habits/types";

const baseHabit: Habit = {
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

const baseReview = {
  adjustment_note: null,
  created_at: "2026-04-24T00:00:00.000Z",
  habit_id: "habit-1",
  id: "review-1",
  tiny_action_too_hard: null,
  trigger_worked: null,
  updated_at: "2026-04-24T00:00:00.000Z",
  user_id: "user-1",
  was_hard: null,
  week_start: "2026-04-20",
  went_well: null,
};

describe("weekly review due logic", () => {
  it("marks active started habits with no current-week review as due", () => {
    expect(
      isWeeklyReviewDue({
        currentWeekStart: "2026-04-20",
        habit: baseHabit,
        latestReview: null,
        todayDate: "2026-04-24",
      }),
    ).toBe(true);
  });

  it("does not mark current-week reviews as due", () => {
    expect(
      isWeeklyReviewDue({
        currentWeekStart: "2026-04-20",
        habit: baseHabit,
        latestReview: baseReview,
        todayDate: "2026-04-24",
      }),
    ).toBe(false);
  });

  it("marks previous-week reviews as due", () => {
    expect(
      isWeeklyReviewDue({
        currentWeekStart: "2026-04-27",
        habit: baseHabit,
        latestReview: baseReview,
        todayDate: "2026-04-29",
      }),
    ).toBe(true);
  });

  it("does not mark archived habits as due", () => {
    expect(
      isWeeklyReviewDue({
        currentWeekStart: "2026-04-20",
        habit: { ...baseHabit, status: "archived" },
        latestReview: null,
        todayDate: "2026-04-24",
      }),
    ).toBe(false);
  });

  it("does not mark future-start habits as due", () => {
    expect(
      isWeeklyReviewDue({
        currentWeekStart: "2026-04-20",
        habit: { ...baseHabit, start_date: "2026-04-30" },
        latestReview: null,
        todayDate: "2026-04-24",
      }),
    ).toBe(false);
  });
});
