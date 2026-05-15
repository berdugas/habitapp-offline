import type { SQLiteDatabase } from "expo-sqlite";

import { getDb } from "@/lib/db/client";
import { createTestDb } from "@/tests/setup/createTestDb";
import {
  graduateHabit,
  isGoalGraduated,
  recordAndProcessGraduation,
  scoreGraduation,
} from "@/features/graduation/graduation";
import {
  createHabit,
  getHabit,
  type CreateHabitInput,
} from "@/lib/db/repositories/habits";

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

describe("scoreGraduation (pure)", () => {
  it("passing scores — average 4.33, graduated=true, passing message", () => {
    const result = scoreGraduation({ q1: 5, q2: 4, q3: 4 });
    expect(result.averageScore).toBe(4.33);
    expect(result.graduated).toBe(true);
    expect(result.message).toMatch(
      /part of who you are|happens naturally|yours now/,
    );
  });

  it("failing scores — average 3.33, graduated=false, failing message", () => {
    const result = scoreGraduation({ q1: 3, q2: 3, q3: 4 });
    expect(result.averageScore).toBe(3.33);
    expect(result.graduated).toBe(false);
    expect(result.message).toMatch(
      /Not automatic yet|Still forming|Not quite there/,
    );
  });

  it("boundary — exactly 4.0 passes (≥ not >)", () => {
    const result = scoreGraduation({ q1: 4, q2: 4, q3: 4 });
    expect(result.averageScore).toBe(4);
    expect(result.graduated).toBe(true);
  });

  it("highest failing integer-score average (3.67) — note: 3.99 is unreachable with 1–5 integers", () => {
    const result = scoreGraduation({ q1: 4, q2: 4, q3: 3 });
    expect(result.averageScore).toBe(3.67);
    expect(result.graduated).toBe(false);
  });

  it("messages are deterministic — same scores return same message", () => {
    const a = scoreGraduation({ q1: 4, q2: 5, q3: 4 });
    const b = scoreGraduation({ q1: 4, q2: 5, q3: 4 });
    expect(a.message).toBe(b.message);
  });
});

describe("isGoalGraduated (pure)", () => {
  it("returns true when every habit is automatic", () => {
    expect(
      isGoalGraduated([
        { habit_state: "automatic" },
        { habit_state: "automatic" },
      ]),
    ).toBe(true);
  });

  it("returns false when at least one habit is active", () => {
    expect(
      isGoalGraduated([
        { habit_state: "active" },
        { habit_state: "automatic" },
      ]),
    ).toBe(false);
  });

  it("returns false for an empty array", () => {
    expect(isGoalGraduated([])).toBe(false);
  });
});

describe("graduateHabit + recordAndProcessGraduation (DB)", () => {
  let db: SQLiteDatabase;

  beforeEach(async () => {
    db = await createTestDb();
    mockGetDb.mockReturnValue(db);
  });

  afterEach(async () => {
    await db.closeAsync();
  });

  it("graduateHabit sets habit_state='automatic' and automated_at", async () => {
    const habit = await createHabit(makeHabitInput());
    const updated = await graduateHabit(habit.id);

    expect(updated.habit_state).toBe("automatic");
    expect(updated.automated_at).toBeTruthy();
  });

  it("graduateHabit preserves status='active' (habit stays on Today)", async () => {
    const habit = await createHabit(makeHabitInput());
    const updated = await graduateHabit(habit.id);

    expect(updated.status).toBe("active");
  });

  it("graduateHabit is idempotent — second call preserves original automated_at", async () => {
    const habit = await createHabit(makeHabitInput());
    const first = await graduateHabit(habit.id);
    expect(first.habit_state).toBe("automatic");
    const originalTimestamp = first.automated_at;
    expect(originalTimestamp).toBeTruthy();

    await new Promise((r) => setTimeout(r, 10));
    const second = await graduateHabit(habit.id);

    expect(second.habit_state).toBe("automatic");
    expect(second.automated_at).toBe(originalTimestamp);
  });

  it("graduateHabit throws when the habit does not exist", async () => {
    await expect(graduateHabit("does-not-exist")).rejects.toThrow(
      "does-not-exist",
    );
  });

  it("recordAndProcessGraduation passing — creates SRHI response and transitions habit", async () => {
    const habit = await createHabit(makeHabitInput());
    const { response, habit: updated } = await recordAndProcessGraduation({
      habit_id: habit.id,
      user_id: "user-1",
      q1_score: 5,
      q2_score: 5,
      q3_score: 4,
    });

    expect(response.graduated).toBe(true);
    expect(response.average_score).toBeCloseTo(4.67, 2);
    expect(updated).not.toBeNull();
    expect(updated!.habit_state).toBe("automatic");
    expect(updated!.automated_at).toBeTruthy();

    const persisted = await getHabit(habit.id);
    expect(persisted!.habit_state).toBe("automatic");
  });

  it("recordAndProcessGraduation failing — creates SRHI response but does not transition habit", async () => {
    const habit = await createHabit(makeHabitInput());
    const { response, habit: updated } = await recordAndProcessGraduation({
      habit_id: habit.id,
      user_id: "user-1",
      q1_score: 3,
      q2_score: 3,
      q3_score: 4,
    });

    expect(response.graduated).toBe(false);
    expect(updated).toBeNull();

    const persisted = await getHabit(habit.id);
    expect(persisted!.habit_state).toBe("active");
    expect(persisted!.automated_at).toBeNull();
  });
});
