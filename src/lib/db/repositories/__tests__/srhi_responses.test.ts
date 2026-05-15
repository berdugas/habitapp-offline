import type { SQLiteDatabase } from "expo-sqlite";

import { getDb } from "@/lib/db/client";
import { createTestDb } from "@/tests/setup/createTestDb";
import {
  createSRHIResponse,
  getLatestSRHIResponse,
  getSRHIResponsesForHabit,
  getSRHIResponsesForUser,
} from "@/lib/db/repositories/srhi_responses";
import { createHabit, type CreateHabitInput } from "@/lib/db/repositories/habits";

jest.mock("@/lib/db/client");
const mockGetDb = getDb as jest.Mock;

function makeHabitInput(
  overrides: Partial<CreateHabitInput> = {},
): CreateHabitInput {
  return {
    user_id: "user-1",
    title: "Meditate",
    cue: "After coffee",
    tiny_action: "2 minutes of breathing",
    start_date: "2026-04-29",
    identity_phrase: null,
    minimum_viable_action: null,
    preferred_time_window: null,
    ...overrides,
  };
}

describe("srhi_responses repository", () => {
  let db: SQLiteDatabase;

  beforeEach(async () => {
    db = await createTestDb();
    mockGetDb.mockReturnValue(db);
  });

  afterEach(async () => {
    await db.closeAsync();
  });

  it("createSRHIResponse with passing scores computes average 4.33 and graduated=true", async () => {
    const habit = await createHabit(makeHabitInput());
    const response = await createSRHIResponse({
      habit_id: habit.id,
      user_id: "user-1",
      q1_score: 4,
      q2_score: 5,
      q3_score: 4,
    });

    expect(response.average_score).toBe(4.33);
    expect(response.graduated).toBe(true);
  });

  it("createSRHIResponse with failing scores computes average 3.33 and graduated=false", async () => {
    const habit = await createHabit(makeHabitInput());
    const response = await createSRHIResponse({
      habit_id: habit.id,
      user_id: "user-1",
      q1_score: 3,
      q2_score: 4,
      q3_score: 3,
    });

    expect(response.average_score).toBe(3.33);
    expect(response.graduated).toBe(false);
  });

  it("createSRHIResponse at exactly 4.0 passes (graduated=true)", async () => {
    const habit = await createHabit(makeHabitInput());
    const response = await createSRHIResponse({
      habit_id: habit.id,
      user_id: "user-1",
      q1_score: 4,
      q2_score: 4,
      q3_score: 4,
    });

    expect(response.average_score).toBe(4);
    expect(response.graduated).toBe(true);
  });

  it("createSRHIResponse just below 4.0 fails (average 3.67, graduated=false)", async () => {
    const habit = await createHabit(makeHabitInput());
    const response = await createSRHIResponse({
      habit_id: habit.id,
      user_id: "user-1",
      q1_score: 4,
      q2_score: 4,
      q3_score: 3,
    });

    expect(response.average_score).toBe(3.67);
    expect(response.graduated).toBe(false);
  });

  // Schema-level CHECK and FK enforcement is verified by the migration
  // test in src/lib/db/migrations/__tests__/007_srhi_responses.test.ts.
  // Duplicating those assertions through the mocked-getDb repository path
  // triggered a non-deterministic better-sqlite3 / Jest module-cache
  // interaction where constraint violations would not propagate as
  // exceptions when the two test files ran in the same Jest process.

  it("getLatestSRHIResponse returns the most recent response by created_at", async () => {
    const habit = await createHabit(makeHabitInput());

    const first = await createSRHIResponse({
      habit_id: habit.id,
      user_id: "user-1",
      q1_score: 3,
      q2_score: 3,
      q3_score: 3,
    });
    await new Promise((r) => setTimeout(r, 5));
    const second = await createSRHIResponse({
      habit_id: habit.id,
      user_id: "user-1",
      q1_score: 5,
      q2_score: 5,
      q3_score: 5,
    });

    const latest = await getLatestSRHIResponse(habit.id);
    expect(latest?.id).toBe(second.id);
    expect(latest?.id).not.toBe(first.id);
  });

  it("getLatestSRHIResponse returns null when the habit has no responses", async () => {
    const habit = await createHabit(makeHabitInput());
    expect(await getLatestSRHIResponse(habit.id)).toBeNull();
  });

  it("getSRHIResponsesForHabit returns all responses in DESC order", async () => {
    const habit = await createHabit(makeHabitInput());

    const a = await createSRHIResponse({
      habit_id: habit.id,
      user_id: "user-1",
      q1_score: 2,
      q2_score: 2,
      q3_score: 2,
    });
    await new Promise((r) => setTimeout(r, 5));
    const b = await createSRHIResponse({
      habit_id: habit.id,
      user_id: "user-1",
      q1_score: 3,
      q2_score: 3,
      q3_score: 3,
    });
    await new Promise((r) => setTimeout(r, 5));
    const c = await createSRHIResponse({
      habit_id: habit.id,
      user_id: "user-1",
      q1_score: 4,
      q2_score: 4,
      q3_score: 4,
    });

    const all = await getSRHIResponsesForHabit(habit.id);
    expect(all.map((r) => r.id)).toEqual([c.id, b.id, a.id]);
  });

  it("getSRHIResponsesForUser returns responses across multiple habits", async () => {
    const habitA = await createHabit(makeHabitInput({ title: "A" }));
    const habitB = await createHabit(makeHabitInput({ title: "B" }));

    await createSRHIResponse({
      habit_id: habitA.id,
      user_id: "user-1",
      q1_score: 3,
      q2_score: 3,
      q3_score: 3,
    });
    await new Promise((r) => setTimeout(r, 5));
    await createSRHIResponse({
      habit_id: habitB.id,
      user_id: "user-1",
      q1_score: 4,
      q2_score: 4,
      q3_score: 4,
    });

    const all = await getSRHIResponsesForUser("user-1");
    expect(all).toHaveLength(2);
    const habitIds = all.map((r) => r.habit_id).sort();
    expect(habitIds).toEqual([habitA.id, habitB.id].sort());
  });

});
