import { getGoalReviewStatus } from "@/features/reviews/due";

import type { Habit } from "@/features/habits/types";
import type { WeeklyReviewRecord } from "@/features/reviews/types";

const WEEK_START = "2026-04-27"; // Monday
const TODAY = "2026-05-04"; // following Monday — all habits are ≥7 days old

function makeHabit(overrides: Partial<Habit> = {}): Habit {
  return {
    id: "h1",
    user_id: "u1",
    title: "Walk",
    identity_phrase: "stoic",
    cue: "after coffee",
    tiny_action: "put on shoes",
    minimum_viable_action: null,
    preferred_time_window: null,
    icon: null,
    habit_state: "active",
    status: "active",
    active_days: JSON.stringify([1, 2, 3, 4, 5, 6, 7]),
    start_date: "2026-04-01",
    created_at: "2026-04-01T00:00:00Z",
    updated_at: "2026-04-01T00:00:00Z",
    archived_at: null,
    automated_at: null,
    backlog_at: null,
    ...overrides,
  };
}

function makeReview(
  habitId: string,
  weekStart: string,
): WeeklyReviewRecord {
  return {
    id: `r-${habitId}-${weekStart}`,
    habit_id: habitId,
    user_id: "u1",
    week_start: weekStart,
    went_well: null,
    was_hard: null,
    adjustment_note: null,
    trigger_worked: null,
    tiny_action_too_hard: null,
    created_at: `${weekStart}T00:00:00Z`,
    updated_at: `${weekStart}T00:00:00Z`,
  };
}

describe("getGoalReviewStatus", () => {
  it("returns isDue when at least one habit has no review for current week", () => {
    const habits = [makeHabit({ id: "h1" }), makeHabit({ id: "h2" })];
    const latestReviews = new Map([
      ["h1", makeReview("h1", WEEK_START)],
      ["h2", null],
    ]);

    const status = getGoalReviewStatus({
      currentWeekStart: WEEK_START,
      habits,
      latestReviews,
      todayDate: TODAY,
    });

    expect(status.isDue).toBe(true);
    expect(status.habitsDue).toEqual(["h2"]);
    expect(status.habitsReviewed).toEqual(["h1"]);
    expect(status.allReviewed).toBe(false);
  });

  it("returns allReviewed when every reviewable habit has a current-week review", () => {
    const habits = [makeHabit({ id: "h1" }), makeHabit({ id: "h2" })];
    const latestReviews = new Map([
      ["h1", makeReview("h1", WEEK_START)],
      ["h2", makeReview("h2", WEEK_START)],
    ]);

    const status = getGoalReviewStatus({
      currentWeekStart: WEEK_START,
      habits,
      latestReviews,
      todayDate: TODAY,
    });

    expect(status.isDue).toBe(false);
    expect(status.allReviewed).toBe(true);
    expect(status.habitsDue).toEqual([]);
    expect(status.habitsReviewed).toEqual(["h1", "h2"]);
  });

  it("excludes future-start habits from the reviewable set", () => {
    const habits = [
      makeHabit({ id: "started", start_date: "2026-04-01" }),
      makeHabit({ id: "upcoming", start_date: "2026-06-01" }),
    ];
    const latestReviews = new Map<string, WeeklyReviewRecord | null>([
      ["started", makeReview("started", WEEK_START)],
      ["upcoming", null],
    ]);

    const status = getGoalReviewStatus({
      currentWeekStart: WEEK_START,
      habits,
      latestReviews,
      todayDate: TODAY,
    });

    expect(status.habitsDue).toEqual([]);
    expect(status.habitsReviewed).toEqual(["started"]);
    expect(status.allReviewed).toBe(true);
  });

  it("excludes habits younger than 7 days from the reviewable set", () => {
    const habits = [
      makeHabit({ id: "old", start_date: "2026-04-01" }),
      makeHabit({ id: "fresh", start_date: "2026-05-02" }), // only 2 days old
    ];
    const latestReviews = new Map<string, WeeklyReviewRecord | null>([
      ["old", null],
      ["fresh", null],
    ]);

    const status = getGoalReviewStatus({
      currentWeekStart: WEEK_START,
      habits,
      latestReviews,
      todayDate: TODAY,
    });

    expect(status.habitsDue).toEqual(["old"]);
    expect(status.habitsReviewed).toEqual([]);
    // "fresh" doesn't count as either due or reviewed
  });

  it("excludes archived habits from the reviewable set", () => {
    const habits = [
      makeHabit({ id: "active" }),
      makeHabit({ id: "archived", status: "archived" }),
    ];
    const latestReviews = new Map<string, WeeklyReviewRecord | null>([
      ["active", null],
      ["archived", null],
    ]);

    const status = getGoalReviewStatus({
      currentWeekStart: WEEK_START,
      habits,
      latestReviews,
      todayDate: TODAY,
    });

    expect(status.habitsDue).toEqual(["active"]);
    expect(status.habitsReviewed).toEqual([]);
  });

  it("returns allReviewed=false when no habits are reviewable yet", () => {
    const habits = [
      makeHabit({ id: "fresh", start_date: "2026-05-02" }),
    ];
    const latestReviews = new Map<string, WeeklyReviewRecord | null>([
      ["fresh", null],
    ]);

    const status = getGoalReviewStatus({
      currentWeekStart: WEEK_START,
      habits,
      latestReviews,
      todayDate: TODAY,
    });

    expect(status.isDue).toBe(false);
    expect(status.allReviewed).toBe(false);
    expect(status.habitsDue).toEqual([]);
    expect(status.habitsReviewed).toEqual([]);
  });

  it("treats a review with an older week_start as not-current", () => {
    const habits = [makeHabit({ id: "h1" })];
    const latestReviews = new Map([
      ["h1", makeReview("h1", "2026-04-20")], // previous week
    ]);

    const status = getGoalReviewStatus({
      currentWeekStart: WEEK_START,
      habits,
      latestReviews,
      todayDate: TODAY,
    });

    expect(status.isDue).toBe(true);
    expect(status.habitsDue).toEqual(["h1"]);
  });
});
