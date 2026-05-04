import {
  isWeeklyReviewDue,
  MINIMUM_DAYS_BEFORE_REVIEW,
} from "@/features/reviews/due";

// Fixture: habit started on a Monday so week boundaries are clean
const BASE_START = "2026-04-20"; // Monday
const WEEK_1_START = "2026-04-27"; // Monday +7 days
const WEEK_2_START = "2026-05-04"; // Monday +14 days

function makeHabit(
  overrides: Partial<{ start_date: string; status: string }> = {},
) {
  return {
    id: "h1",
    start_date: BASE_START,
    status: "active",
    ...overrides,
  } as any;
}

describe("isWeeklyReviewDue", () => {
  it("exports MINIMUM_DAYS_BEFORE_REVIEW as 7", () => {
    expect(MINIMUM_DAYS_BEFORE_REVIEW).toBe(7);
  });

  it("returns false when habit was created today (day 0)", () => {
    expect(
      isWeeklyReviewDue({
        currentWeekStart: BASE_START,
        habit: makeHabit({ start_date: BASE_START }),
        latestReview: null,
        todayDate: BASE_START,
      }),
    ).toBe(false);
  });

  it("returns false when habit is 3 days old", () => {
    expect(
      isWeeklyReviewDue({
        currentWeekStart: "2026-04-23",
        habit: makeHabit(),
        latestReview: null,
        todayDate: "2026-04-23",
      }),
    ).toBe(false);
  });

  it("returns false when habit is 6 days old (one day short of threshold)", () => {
    expect(
      isWeeklyReviewDue({
        currentWeekStart: "2026-04-26",
        habit: makeHabit(),
        latestReview: null,
        todayDate: "2026-04-26",
      }),
    ).toBe(false);
  });

  it("returns true when habit is exactly 7 days old and current week is unreviewed", () => {
    expect(
      isWeeklyReviewDue({
        currentWeekStart: WEEK_1_START,
        habit: makeHabit(),
        latestReview: null,
        todayDate: WEEK_1_START,
      }),
    ).toBe(true);
  });

  it("returns false when habit is 7 days old but current week already reviewed", () => {
    expect(
      isWeeklyReviewDue({
        currentWeekStart: WEEK_1_START,
        habit: makeHabit(),
        latestReview: { week_start: WEEK_1_START } as any,
        todayDate: WEEK_1_START,
      }),
    ).toBe(false);
  });

  it("returns true when habit is 14 days old and only last week was reviewed", () => {
    expect(
      isWeeklyReviewDue({
        currentWeekStart: WEEK_2_START,
        habit: makeHabit(),
        latestReview: { week_start: WEEK_1_START } as any,
        todayDate: WEEK_2_START,
      }),
    ).toBe(true);
  });

  it("returns false when habit is 14 days old and current week is reviewed", () => {
    expect(
      isWeeklyReviewDue({
        currentWeekStart: WEEK_2_START,
        habit: makeHabit(),
        latestReview: { week_start: WEEK_2_START } as any,
        todayDate: WEEK_2_START,
      }),
    ).toBe(false);
  });

  it("returns false for an inactive habit even if 10 days old", () => {
    expect(
      isWeeklyReviewDue({
        currentWeekStart: "2026-04-30",
        habit: makeHabit({ status: "archived" }),
        latestReview: null,
        todayDate: "2026-04-30",
      }),
    ).toBe(false);
  });

  it("returns false when habit has a future start_date", () => {
    expect(
      isWeeklyReviewDue({
        currentWeekStart: WEEK_1_START,
        habit: makeHabit({ start_date: "2026-05-10" }),
        latestReview: null,
        todayDate: WEEK_1_START,
      }),
    ).toBe(false);
  });

  it("returns true for a 30-day-old habit with no reviews ever", () => {
    expect(
      isWeeklyReviewDue({
        currentWeekStart: WEEK_2_START,
        habit: makeHabit({ start_date: "2026-04-04" }),
        latestReview: null,
        todayDate: WEEK_2_START,
      }),
    ).toBe(true);
  });
});
