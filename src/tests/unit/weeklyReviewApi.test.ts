const mockGetHabitById = jest.fn();
const mockDbGetLatest = jest.fn();
const mockDbGetForWeek = jest.fn();
const mockDbUpsert = jest.fn();

jest.mock("@/features/habits/api", () => ({
  getHabitById: (userId: string, habitId: string) =>
    mockGetHabitById(userId, habitId),
}));

jest.mock("@/lib/db/repositories/weekly_reviews", () => ({
  getLatestWeeklyReview: (userId: string, habitId: string) =>
    mockDbGetLatest(userId, habitId),
  getWeeklyReviewForWeek: (
    userId: string,
    habitId: string,
    weekStart: string,
  ) => mockDbGetForWeek(userId, habitId, weekStart),
  upsertWeeklyReview: (input: unknown) => mockDbUpsert(input),
}));

import {
  getLatestWeeklyReview,
  getWeeklyReviewForWeek,
  upsertWeeklyReview,
} from "@/features/reviews/api";

describe("weekly review api", () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it("delegates getLatestWeeklyReview to the repository", async () => {
    const record = { id: "review-1", week_start: "2026-04-20" };
    mockDbGetLatest.mockResolvedValue(record);

    const result = await getLatestWeeklyReview("user-1", "habit-1");

    expect(mockDbGetLatest).toHaveBeenCalledWith("user-1", "habit-1");
    expect(result).toBe(record);
  });

  it("returns null when no review exists", async () => {
    mockDbGetLatest.mockResolvedValue(null);

    const result = await getLatestWeeklyReview("user-1", "habit-1");

    expect(result).toBeNull();
  });

  it("delegates getWeeklyReviewForWeek to the repository", async () => {
    const record = { id: "review-2", week_start: "2026-04-27" };
    mockDbGetForWeek.mockResolvedValue(record);

    const result = await getWeeklyReviewForWeek("user-1", "habit-1", "2026-04-27");

    expect(mockDbGetForWeek).toHaveBeenCalledWith("user-1", "habit-1", "2026-04-27");
    expect(result).toBe(record);
  });

  it("verifies ownership then upserts with the correct payload", async () => {
    mockGetHabitById.mockResolvedValue({ id: "habit-1" });
    const saved = { id: "review-1" };
    mockDbUpsert.mockResolvedValue(saved);

    const result = await upsertWeeklyReview("user-1", {
      adjustmentNote: " Move the book ",
      habitId: "habit-1",
      tinyActionTooHard: false,
      triggerWorked: true,
      wasHard: " Busy mornings ",
      weekStart: "2026-04-20",
      wentWell: " Breakfast worked ",
    });

    expect(mockGetHabitById).toHaveBeenCalledWith("user-1", "habit-1");
    expect(mockDbUpsert).toHaveBeenCalledWith({
      adjustmentNote: " Move the book ",
      habitId: "habit-1",
      tinyActionTooHard: false,
      triggerWorked: true,
      userId: "user-1",
      wasHard: " Busy mornings ",
      weekStart: "2026-04-20",
      wentWell: " Breakfast worked ",
    });
    expect(result).toBe(saved);
  });

  it("upserts with null boolean fields and empty strings", async () => {
    mockGetHabitById.mockResolvedValue({ id: "habit-1" });
    mockDbUpsert.mockResolvedValue({ id: "review-2" });

    await upsertWeeklyReview("user-1", {
      adjustmentNote: "",
      habitId: "habit-1",
      tinyActionTooHard: null,
      triggerWorked: null,
      wasHard: "",
      weekStart: "2026-04-27",
      wentWell: "Still showed up",
    });

    expect(mockDbUpsert).toHaveBeenCalledWith(
      expect.objectContaining({ weekStart: "2026-04-27", triggerWorked: null }),
    );
  });

  it("rejects non-owned habits before attempting the upsert", async () => {
    mockGetHabitById.mockRejectedValueOnce(new Error("not found"));

    await expect(
      upsertWeeklyReview("user-1", {
        adjustmentNote: "",
        habitId: "other-user-habit",
        tinyActionTooHard: null,
        triggerWorked: null,
        wasHard: "",
        weekStart: "2026-04-20",
        wentWell: "Worked",
      }),
    ).rejects.toThrow("not found");

    expect(mockDbUpsert).not.toHaveBeenCalled();
  });

  it("propagates repository errors from upsert", async () => {
    mockGetHabitById.mockResolvedValue({ id: "habit-1" });
    mockDbUpsert.mockRejectedValueOnce(new Error("db write failed"));

    await expect(
      upsertWeeklyReview("user-1", {
        adjustmentNote: "",
        habitId: "habit-1",
        tinyActionTooHard: null,
        triggerWorked: null,
        wasHard: "",
        weekStart: "2026-04-20",
        wentWell: "Worked",
      }),
    ).rejects.toThrow("db write failed");
  });
});
