import type { SQLiteDatabase } from "expo-sqlite";

import { getDb } from "@/lib/db/client";
import { createTestDb } from "@/tests/setup/createTestDb";
import {
  archiveHabit,
  createHabit,
  deleteHabit,
  getHabit,
  listHabits,
  updateHabit,
  type CreateHabitInput,
} from "@/lib/db/repositories/habits";
import { upsertLog } from "@/lib/db/repositories/habit_logs";

jest.mock("@/lib/db/client");
const mockGetDb = getDb as jest.Mock;

function makeInput(overrides: Partial<CreateHabitInput> = {}): CreateHabitInput {
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

describe("habits repository", () => {
  let db: SQLiteDatabase;

  beforeEach(async () => {
    db = await createTestDb();
    mockGetDb.mockReturnValue(db);
  });

  afterEach(async () => {
    await db.closeAsync();
  });

  it("createHabit returns a habit with id, created_at, updated_at populated", async () => {
    const habit = await createHabit(makeInput());

    expect(habit.id).toBeTruthy();
    expect(habit.created_at).toBeTruthy();
    expect(habit.updated_at).toBeTruthy();
    expect(habit.title).toBe("Meditate");
  });

  it("createHabit defaults to habit_state=active and status=active when not specified", async () => {
    const habit = await createHabit(makeInput());

    expect(habit.habit_state).toBe("active");
    expect(habit.status).toBe("active");
  });

  it("createHabit respects provided habit_state and status overrides", async () => {
    const habit = await createHabit(
      makeInput({ habit_state: "automatic", status: "backlog" }),
    );

    expect(habit.habit_state).toBe("automatic");
    expect(habit.status).toBe("backlog");
  });

  it("updateHabit changes specified fields and bumps updated_at", async () => {
    const habit = await createHabit(makeInput());

    await new Promise((r) => setTimeout(r, 5));
    const updated = await updateHabit(habit.id, { title: "Read", cue: "Before bed" });

    expect(updated.title).toBe("Read");
    expect(updated.cue).toBe("Before bed");
    expect(updated.updated_at > habit.updated_at).toBe(true);
  });

  it("updateHabit throws when the id does not exist", async () => {
    await expect(
      updateHabit("nonexistent-id", { title: "Ghost" }),
    ).rejects.toThrow("nonexistent-id");
  });

  it("updateHabit ignores fields explicitly set to undefined", async () => {
    const habit = await createHabit(makeInput({ title: "Original" }));
    await updateHabit(habit.id, { title: undefined, cue: "New cue" });

    const after = await getHabit(habit.id);
    expect(after!.title).toBe("Original");
    expect(after!.cue).toBe("New cue");
  });

  it("updateHabit can explicitly clear nullable fields with null", async () => {
    const habit = await createHabit(makeInput({ identity_phrase: "a runner" }));
    await updateHabit(habit.id, { identity_phrase: null });

    const after = await getHabit(habit.id);
    expect(after!.identity_phrase).toBeNull();
  });

  it("archiveHabit sets status=archived and archived_at", async () => {
    const habit = await createHabit(makeInput());
    await archiveHabit(habit.id);

    const archived = await getHabit(habit.id);
    expect(archived!.status).toBe("archived");
    expect(archived!.archived_at).toBeTruthy();
  });

  it("archiveHabit is idempotent — re-archiving preserves the original archived_at", async () => {
    const habit = await createHabit(makeInput());
    await archiveHabit(habit.id);

    const afterFirst = await getHabit(habit.id);
    const firstArchivedAt = afterFirst!.archived_at;

    await new Promise((r) => setTimeout(r, 5));
    await archiveHabit(habit.id);

    const afterSecond = await getHabit(habit.id);
    expect(afterSecond!.archived_at).toBe(firstArchivedAt);
  });

  it("archiveHabit throws when the id does not exist", async () => {
    await expect(archiveHabit("does-not-exist")).rejects.toThrow("does-not-exist");
  });

  it("getHabit returns null for a missing id", async () => {
    expect(await getHabit("does-not-exist")).toBeNull();
  });

  it("listHabits filters by user_id — other users' habits are not returned", async () => {
    await createHabit(makeInput({ user_id: "user-1" }));
    await createHabit(makeInput({ user_id: "user-2" }));

    const results = await listHabits({ user_id: "user-1" });
    expect(results).toHaveLength(1);
    expect(results[0].user_id).toBe("user-1");
  });

  it("listHabits filters by a single habit_state value", async () => {
    await createHabit(makeInput({ habit_state: "active" }));
    await createHabit(makeInput({ habit_state: "automatic" }));

    const results = await listHabits({ user_id: "user-1", habit_state: "active" });
    expect(results).toHaveLength(1);
    expect(results[0].habit_state).toBe("active");
  });

  it("listHabits filters by an array of habit_state values", async () => {
    await createHabit(makeInput({ habit_state: "active" }));
    await createHabit(makeInput({ habit_state: "automatic" }));

    const results = await listHabits({
      user_id: "user-1",
      habit_state: ["active", "automatic"],
    });
    expect(results).toHaveLength(2);
    const states = results.map((h) => h.habit_state).sort();
    expect(states).toEqual(["active", "automatic"]);
  });

  it("listHabits filters by status", async () => {
    await createHabit(makeInput({ status: "active" }));
    await createHabit(makeInput({ status: "backlog" }));

    const results = await listHabits({ user_id: "user-1", status: "backlog" });
    expect(results).toHaveLength(1);
    expect(results[0].status).toBe("backlog");
  });

  it("listHabits returns habits in created_at DESC order", async () => {
    const a = await createHabit(makeInput({ title: "A" }));
    await new Promise((r) => setTimeout(r, 5));
    const b = await createHabit(makeInput({ title: "B" }));
    await new Promise((r) => setTimeout(r, 5));
    const c = await createHabit(makeInput({ title: "C" }));

    const results = await listHabits({ user_id: "user-1" });
    expect(results.map((h) => h.id)).toEqual([c.id, b.id, a.id]);
  });

  it("deleteHabit removes the row and returns true", async () => {
    const habit = await createHabit(makeInput());
    const deleted = await deleteHabit(habit.id);

    expect(deleted).toBe(true);
    expect(await getHabit(habit.id)).toBeNull();
  });

  it("deleteHabit returns false when the id does not exist", async () => {
    expect(await deleteHabit("does-not-exist")).toBe(false);
  });

  it("deleteHabit cascades to local_habit_logs via FK", async () => {
    const habit = await createHabit(makeInput());
    await upsertLog({
      habit_id: habit.id,
      user_id: "user-1",
      log_date: "2026-04-29",
      status: "done",
    });

    await deleteHabit(habit.id);

    const logs = await db.getAllAsync(
      "SELECT * FROM local_habit_logs WHERE habit_id = ?",
      habit.id,
    );
    expect(logs).toHaveLength(0);
  });

  it("declares habit_state and status constraints in the schema", async () => {
    const row = await db.getFirstAsync<{ sql: string }>(
      "SELECT sql FROM sqlite_master WHERE type = 'table' AND name = 'local_habits'",
    );

    expect(row?.sql).toContain("CHECK (habit_state IN ('active', 'automatic'))");
    expect(row?.sql).toContain("CHECK (status IN ('active', 'archived', 'backlog'))");
  });
});
