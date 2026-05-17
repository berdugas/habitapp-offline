import type { SQLiteDatabase } from "expo-sqlite";

import { getDb } from "@/lib/db/client";
import { createTestDb } from "@/tests/setup/createTestDb";
import {
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
    wentWell: "Stayed consistent",
    wasHard: "Mornings were tough",
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
    expect(review.went_well).toBe("Stayed consistent");
    expect(review.was_hard).toBe("Mornings were tough");
    expect(review.adjustment_note).toBeNull();
    expect(review.trigger_worked).toBe(true);
    expect(review.tiny_action_too_hard).toBe(false);
    expect(review.created_at).toBeTruthy();
    expect(review.updated_at).toBeTruthy();
  });

  it("upsertWeeklyReview on conflict updates fields and updated_at but preserves id and created_at", async () => {
    const first = await upsertWeeklyReview(makeInput(habitId, { wentWell: "Good week" }));

    await new Promise((r) => setTimeout(r, 5));
    const second = await upsertWeeklyReview(
      makeInput(habitId, { wentWell: "Even better week", triggerWorked: true }),
    );

    expect(second.id).toBe(first.id);
    expect(second.created_at).toBe(first.created_at);
    expect(second.went_well).toBe("Even better week");
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
});
