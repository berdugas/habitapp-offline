import type { SQLiteDatabase } from "expo-sqlite";

import { getDb } from "@/lib/db/client";
import { createTestDb } from "@/tests/setup/createTestDb";
import {
  applyTuneUp,
  getLatestWeeklyReview,
  getWeeklyReviewForWeek,
  listReviewsForUser,
  upsertWeeklyReview,
  type UpsertWeeklyReviewInput,
} from "@/lib/db/repositories/weekly_reviews";

jest.mock("@/lib/db/client");
const mockGetDb = getDb as jest.Mock;

async function seedHabit(db: SQLiteDatabase, userId = "user-1"): Promise<string> {
  const id = crypto.randomUUID();
  const now = new Date().toISOString();
  await db.runAsync(
    `INSERT INTO local_habits
       (id, user_id, title, cue, tiny_action, habit_state, status, start_date, created_at, updated_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    id,
    userId,
    "Read",
    "After lunch",
    "1 page",
    "active",
    "active",
    "2026-04-01",
    now,
    now,
  );
  return id;
}

function makeInput(
  habitId: string,
  overrides: Partial<UpsertWeeklyReviewInput> = {},
): UpsertWeeklyReviewInput {
  return {
    habitId,
    userId: "user-1",
    weekStart: "2026-04-28",
    adjustmentNote: "",
    triggerWorked: null,
    tinyActionTooHard: null,
    ...overrides,
  };
}

describe("weekly_reviews repository", () => {
  let db: SQLiteDatabase;
  let habitId: string;

  beforeEach(async () => {
    db = await createTestDb();
    mockGetDb.mockReturnValue(db);
    habitId = await seedHabit(db);
  });

  afterEach(async () => {
    await db.closeAsync();
  });

  it("upsertWeeklyReview inserts a new review and all fields round-trip", async () => {
    const review = await upsertWeeklyReview(
      makeInput(habitId, { triggerWorked: true, tinyActionTooHard: false }),
    );

    expect(review.id).toBeTruthy();
    expect(review.habit_id).toBe(habitId);
    expect(review.user_id).toBe("user-1");
    expect(review.week_start).toBe("2026-04-28");
    expect(review.adjustment_note).toBeNull();
    expect(review.trigger_worked).toBe(true);
    expect(review.tiny_action_too_hard).toBe(false);
    expect(review.created_at).toBeTruthy();
    expect(review.updated_at).toBeTruthy();
  });

  it("upsertWeeklyReview on conflict updates fields and updated_at but preserves id and created_at", async () => {
    const first = await upsertWeeklyReview(
      makeInput(habitId, { adjustmentNote: "Try a clearer trigger" }),
    );

    await new Promise((r) => setTimeout(r, 5));
    const second = await upsertWeeklyReview(
      makeInput(habitId, {
        adjustmentNote: "Try an even clearer trigger",
        triggerWorked: true,
      }),
    );

    expect(second.id).toBe(first.id);
    expect(second.created_at).toBe(first.created_at);
    expect(second.adjustment_note).toBe("Try an even clearer trigger");
    expect(second.trigger_worked).toBe(true);
    expect(second.updated_at > first.updated_at).toBe(true);
  });

  it("getLatestWeeklyReview returns the most recent review by week_start DESC", async () => {
    await upsertWeeklyReview(makeInput(habitId, { weekStart: "2026-04-14" }));
    await upsertWeeklyReview(makeInput(habitId, { weekStart: "2026-04-28" }));
    await upsertWeeklyReview(makeInput(habitId, { weekStart: "2026-04-21" }));

    const latest = await getLatestWeeklyReview("user-1", habitId);
    expect(latest?.week_start).toBe("2026-04-28");
  });

  it("getLatestWeeklyReview returns null when no reviews exist for the habit", async () => {
    const result = await getLatestWeeklyReview("user-1", habitId);
    expect(result).toBeNull();
  });

  it("getWeeklyReviewForWeek returns the review for an exact week_start match", async () => {
    await upsertWeeklyReview(makeInput(habitId, { weekStart: "2026-04-21" }));
    await upsertWeeklyReview(makeInput(habitId, { weekStart: "2026-04-28" }));

    const review = await getWeeklyReviewForWeek("user-1", habitId, "2026-04-21");
    expect(review?.week_start).toBe("2026-04-21");
  });

  it("getWeeklyReviewForWeek returns null for a week with no review", async () => {
    const result = await getWeeklyReviewForWeek("user-1", habitId, "2026-01-01");
    expect(result).toBeNull();
  });

  it("boolean conversion: trigger_worked and tiny_action_too_hard round-trip as null", async () => {
    const review = await upsertWeeklyReview(
      makeInput(habitId, { triggerWorked: null, tinyActionTooHard: null }),
    );

    expect(review.trigger_worked).toBeNull();
    expect(review.tiny_action_too_hard).toBeNull();
  });

  it("boolean conversion: true values round-trip correctly", async () => {
    const review = await upsertWeeklyReview(
      makeInput(habitId, { triggerWorked: true, tinyActionTooHard: true }),
    );

    expect(review.trigger_worked).toBe(true);
    expect(review.tiny_action_too_hard).toBe(true);
  });

  it("boolean conversion: false values round-trip as false, not null or 0", async () => {
    const review = await upsertWeeklyReview(
      makeInput(habitId, { triggerWorked: false, tinyActionTooHard: false }),
    );

    expect(review.trigger_worked).toBe(false);
    expect(review.trigger_worked).not.toBeNull();
    expect(review.tiny_action_too_hard).toBe(false);
    expect(review.tiny_action_too_hard).not.toBeNull();
  });

  it("upsertWeeklyReview rejects a habit_id that does not exist in local_habits", async () => {
    await expect(
      upsertWeeklyReview(makeInput("non-existent-habit-id")),
    ).rejects.toThrow();
  });

  it("listReviewsForUser returns all reviews for a user ordered by week_start DESC", async () => {
    await upsertWeeklyReview(makeInput(habitId, { weekStart: "2026-04-14" }));
    await upsertWeeklyReview(makeInput(habitId, { weekStart: "2026-04-28" }));
    await upsertWeeklyReview(makeInput(habitId, { weekStart: "2026-04-21" }));

    const reviews = await listReviewsForUser("user-1");

    expect(reviews).toHaveLength(3);
    expect(reviews.map((r) => r.week_start)).toEqual([
      "2026-04-28",
      "2026-04-21",
      "2026-04-14",
    ]);
  });

  it("listReviewsForUser maps boolean fields (not 0/1) and excludes other users", async () => {
    await upsertWeeklyReview(
      makeInput(habitId, { triggerWorked: true, tinyActionTooHard: false }),
    );

    const otherHabitId = await seedHabit(db, "user-2");
    await upsertWeeklyReview(
      makeInput(otherHabitId, { userId: "user-2", triggerWorked: false }),
    );

    const reviews = await listReviewsForUser("user-1");

    expect(reviews).toHaveLength(1);
    expect(reviews[0].user_id).toBe("user-1");
    expect(reviews[0].trigger_worked).toBe(true);
    expect(reviews[0].tiny_action_too_hard).toBe(false);
  });

  it("listReviewsForUser returns [] for users with no reviews", async () => {
    const reviews = await listReviewsForUser("user-with-nothing");
    expect(reviews).toEqual([]);
  });

  it("deleting a habit cascades and removes its weekly reviews", async () => {
    await upsertWeeklyReview(makeInput(habitId));
    const before = await getLatestWeeklyReview("user-1", habitId);
    expect(before).not.toBeNull();

    await db.runAsync("DELETE FROM local_habits WHERE id = ?", habitId);

    const after = await getLatestWeeklyReview("user-1", habitId);
    expect(after).toBeNull();
  });

  describe("applyTuneUp — transactional habit + review write", () => {
    async function readHabit(id: string) {
      return db.getFirstAsync<{ cue: string; tiny_action: string }>(
        "SELECT cue, tiny_action FROM local_habits WHERE id = ?",
        id,
      );
    }

    it("writes only the review row when habitPatch is omitted (reduce_friction / keep_going path)", async () => {
      const before = await readHabit(habitId);
      const { review, habit } = await applyTuneUp({
        reviewInput: makeInput(habitId, {
          adjustmentNote: "Try preparing the night before",
        }),
      });

      expect(habit).toBeNull();
      expect(review.adjustment_note).toBe("Try preparing the night before");
      const after = await readHabit(habitId);
      expect(after).toEqual(before); // habit row untouched
    });

    it("patches only the cue when change_trigger is the fix", async () => {
      const { review, habit } = await applyTuneUp({
        habitPatch: { cue: "After morning coffee" },
        reviewInput: makeInput(habitId, { triggerWorked: false }),
      });

      expect(habit).not.toBeNull();
      expect(habit?.cue).toBe("After morning coffee");
      expect(habit?.tiny_action).toBe("1 page"); // unchanged
      expect(review.trigger_worked).toBe(false);
    });

    it("patches only the tiny_action when make_tiny_action_smaller is the fix", async () => {
      const { habit } = await applyTuneUp({
        habitPatch: { tinyAction: "Read one sentence" },
        reviewInput: makeInput(habitId, { tinyActionTooHard: true }),
      });

      expect(habit?.cue).toBe("After lunch"); // unchanged
      expect(habit?.tiny_action).toBe("Read one sentence");
    });

    it("patches both fields when dual-fire ([make_tiny_action_smaller, change_trigger]) is the fix", async () => {
      const { habit, review } = await applyTuneUp({
        habitPatch: { cue: "After dinner", tinyAction: "Read one paragraph" },
        reviewInput: makeInput(habitId, {
          triggerWorked: false,
          tinyActionTooHard: true,
        }),
      });

      expect(habit?.cue).toBe("After dinner");
      expect(habit?.tiny_action).toBe("Read one paragraph");
      expect(review.trigger_worked).toBe(false);
      expect(review.tiny_action_too_hard).toBe(true);
    });

    it("rolls back the habit mutation when the review write fails (FK violation)", async () => {
      const before = await readHabit(habitId);

      await expect(
        applyTuneUp({
          habitPatch: { cue: "After dinner" },
          reviewInput: makeInput("non-existent-habit-id", {
            triggerWorked: false,
          }),
        }),
      ).rejects.toThrow();

      // The habit we DID patch (habitId) shouldn't have been touched —
      // the transaction wrapped both writes, and the review write failed.
      // (The patch targets the same habitId; the FK violation comes from
      // the review row referencing a missing habit, which throws inside
      // the transaction and rolls back the whole batch.)
      const after = await readHabit(habitId);
      expect(after).toEqual(before);
    });

    it("trims whitespace on patched cue and tiny_action", async () => {
      const { habit } = await applyTuneUp({
        habitPatch: { cue: "  After lunch  ", tinyAction: "  1 page  " },
        reviewInput: makeInput(habitId),
      });

      expect(habit?.cue).toBe("After lunch");
      expect(habit?.tiny_action).toBe("1 page");
    });

    // The repo function trims but does not validate non-blank — the api-
    // layer wrapper (applyTuneUpForHabit) enforces non-blankness, which
    // is tested in src/tests/unit/weeklyReviewApi.test.ts. Calling the
    // repo directly with a whitespace-only patch trims to "" which is
    // accepted at this layer.
  });
});
