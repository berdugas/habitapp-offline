const mockGetHabitById = jest.fn();
const mockDbGetLatest = jest.fn();
const mockDbGetForWeek = jest.fn();
const mockDbUpsert = jest.fn();
const mockDbApplyTuneUp = jest.fn();

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
  applyTuneUp: (input: unknown) => mockDbApplyTuneUp(input),
}));

import {
  applyTuneUpForHabit,
  ApplyTuneUpValidationError,
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
      weekStart: "2026-04-20",
    });

    expect(mockGetHabitById).toHaveBeenCalledWith("user-1", "habit-1");
    expect(mockDbUpsert).toHaveBeenCalledWith({
      adjustmentNote: " Move the book ",
      habitId: "habit-1",
      tinyActionTooHard: false,
      triggerWorked: true,
      userId: "user-1",
      weekStart: "2026-04-20",
    });
    expect(result).toBe(saved);
  });

  it("upserts with null boolean fields and empty adjustment note", async () => {
    mockGetHabitById.mockResolvedValue({ id: "habit-1" });
    mockDbUpsert.mockResolvedValue({ id: "review-2" });

    await upsertWeeklyReview("user-1", {
      adjustmentNote: "",
      habitId: "habit-1",
      tinyActionTooHard: null,
      triggerWorked: null,
      weekStart: "2026-04-27",
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
        weekStart: "2026-04-20",
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
        weekStart: "2026-04-20",
      }),
    ).rejects.toThrow("db write failed");
  });

  describe("applyTuneUpForHabit — validation", () => {
    beforeEach(() => {
      mockGetHabitById.mockResolvedValue({ id: "habit-1" });
      mockDbApplyTuneUp.mockResolvedValue({
        review: { id: "review-1" },
        habit: { id: "habit-1" },
      });
    });

    it("rejects a habitPatch with a blank cue (whitespace-only)", async () => {
      await expect(
        applyTuneUpForHabit("user-1", {
          adjustmentNote: "",
          habitId: "habit-1",
          habitPatch: { cue: "   " },
          tinyActionTooHard: false,
          triggerWorked: false,
          weekStart: "2026-04-20",
        }),
      ).rejects.toBeInstanceOf(ApplyTuneUpValidationError);
      expect(mockDbApplyTuneUp).not.toHaveBeenCalled();
    });

    it("rejects a habitPatch with a blank tinyAction (whitespace-only)", async () => {
      await expect(
        applyTuneUpForHabit("user-1", {
          adjustmentNote: "",
          habitId: "habit-1",
          habitPatch: { tinyAction: "  " },
          tinyActionTooHard: true,
          triggerWorked: true,
          weekStart: "2026-04-20",
        }),
      ).rejects.toBeInstanceOf(ApplyTuneUpValidationError);
      expect(mockDbApplyTuneUp).not.toHaveBeenCalled();
    });

    it("accepts a habitPatch with a non-blank cue", async () => {
      await applyTuneUpForHabit("user-1", {
        adjustmentNote: "",
        habitId: "habit-1",
        habitPatch: { cue: "After breakfast" },
        tinyActionTooHard: false,
        triggerWorked: false,
        weekStart: "2026-04-20",
      });
      expect(mockDbApplyTuneUp).toHaveBeenCalledTimes(1);
    });

    it("accepts a payload with no habitPatch (non-mutable suggestion path)", async () => {
      await applyTuneUpForHabit("user-1", {
        adjustmentNote: "Try preparing the night before",
        habitId: "habit-1",
        tinyActionTooHard: false,
        triggerWorked: true,
        weekStart: "2026-04-20",
      });
      expect(mockDbApplyTuneUp).toHaveBeenCalledTimes(1);
      const call = mockDbApplyTuneUp.mock.calls[0][0];
      expect(call.habitPatch).toBeUndefined();
    });

    it("rejects a habitPatch with a cue exceeding 240 characters", async () => {
      const longCue = "a".repeat(241);
      await expect(
        applyTuneUpForHabit("user-1", {
          adjustmentNote: "",
          habitId: "habit-1",
          habitPatch: { cue: longCue },
          tinyActionTooHard: false,
          triggerWorked: false,
          weekStart: "2026-04-20",
        }),
      ).rejects.toBeInstanceOf(ApplyTuneUpValidationError);
      expect(mockDbApplyTuneUp).not.toHaveBeenCalled();
    });

    it("rejects a habitPatch with a tinyAction exceeding 240 characters", async () => {
      const longTinyAction = "x".repeat(300);
      await expect(
        applyTuneUpForHabit("user-1", {
          adjustmentNote: "",
          habitId: "habit-1",
          habitPatch: { tinyAction: longTinyAction },
          tinyActionTooHard: true,
          triggerWorked: false,
          weekStart: "2026-04-20",
        }),
      ).rejects.toBeInstanceOf(ApplyTuneUpValidationError);
      expect(mockDbApplyTuneUp).not.toHaveBeenCalled();
    });

    it("accepts a 240-character cue (boundary case)", async () => {
      const exactCue = "a".repeat(240);
      await applyTuneUpForHabit("user-1", {
        adjustmentNote: "",
        habitId: "habit-1",
        habitPatch: { cue: exactCue },
        tinyActionTooHard: false,
        triggerWorked: false,
        weekStart: "2026-04-20",
      });
      expect(mockDbApplyTuneUp).toHaveBeenCalledTimes(1);
    });

    it("rejects non-owned habits before validating the patch", async () => {
      mockGetHabitById.mockRejectedValueOnce(new Error("not found"));
      await expect(
        applyTuneUpForHabit("user-1", {
          adjustmentNote: "",
          habitId: "other",
          habitPatch: { cue: "   " },
          tinyActionTooHard: false,
          triggerWorked: false,
          weekStart: "2026-04-20",
        }),
      ).rejects.toThrow("not found");
      expect(mockDbApplyTuneUp).not.toHaveBeenCalled();
    });
  });
});
