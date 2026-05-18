import type { SQLiteDatabase } from "expo-sqlite";

import { getDb } from "@/lib/db/client";
import { createTestDb } from "@/tests/setup/createTestDb";
import {
  archiveGoal,
  archiveHabit,
  createHabit,
  deleteGoal,
  deleteHabit,
  getHabit,
  listHabits,
  restoreGoal,
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

  it("deleteHabit cascades to local_srhi_responses via FK", async () => {
    const habit = await createHabit(makeInput());
    await db.runAsync(
      `INSERT INTO local_srhi_responses
         (id, habit_id, user_id,
          q1_score, q2_score, q3_score, average_score,
          graduated, created_at)
       VALUES (?, ?, 'user-1', 4, 5, 4, 4.33, 0, datetime('now'))`,
      `srhi-${habit.id}`,
      habit.id,
    );

    await deleteHabit(habit.id);

    const rows = await db.getAllAsync(
      "SELECT * FROM local_srhi_responses WHERE habit_id = ?",
      habit.id,
    );
    expect(rows).toHaveLength(0);
  });

  it("deleteHabit cascades to local_weekly_reviews via FK", async () => {
    const habit = await createHabit(makeInput());
    await db.runAsync(
      `INSERT INTO local_weekly_reviews
         (id, habit_id, user_id, week_start,
          went_well, was_hard, adjustment_note,
          trigger_worked, tiny_action_too_hard,
          created_at, updated_at)
       VALUES (?, ?, 'user-1', '2026-05-11',
         'Good week', 'Tuesday was hard', null,
         1, 0,
         datetime('now'), datetime('now'))`,
      `wr-${habit.id}`,
      habit.id,
    );

    await deleteHabit(habit.id);

    const rows = await db.getAllAsync(
      "SELECT * FROM local_weekly_reviews WHERE habit_id = ?",
      habit.id,
    );
    expect(rows).toHaveLength(0);
  });

  it("listHabits filters by identity_phrase across all habit_states and statuses", async () => {
    const a = await createHabit(makeInput({ identity_phrase: "a runner", title: "A" }));
    const b = await createHabit(makeInput({ identity_phrase: "a runner", title: "B" }));
    const c = await createHabit(makeInput({ identity_phrase: "a writer", title: "C" }));

    const matches = await listHabits({
      user_id: "user-1",
      identity_phrase: "a runner",
    });

    expect(matches.map((h) => h.id).sort()).toEqual([a.id, b.id].sort());
    expect(matches.map((h) => h.id)).not.toContain(c.id);
  });

  describe("deleteGoal", () => {
    it("deletes all habits sharing the identity_phrase for the user", async () => {
      const a = await createHabit(makeInput({ identity_phrase: "a runner", title: "A" }));
      const b = await createHabit(makeInput({ identity_phrase: "a runner", title: "B" }));
      const c = await createHabit(makeInput({ identity_phrase: "a writer", title: "C" }));

      const result = await deleteGoal("user-1", "a runner");

      expect(result.deletedHabitCount).toBe(2);
      expect(await getHabit(a.id)).toBeNull();
      expect(await getHabit(b.id)).toBeNull();
      expect(await getHabit(c.id)).not.toBeNull();
    });

    it("returns deletedHabitCount=0 when no habits match", async () => {
      const result = await deleteGoal("user-1", "nonexistent phrase");
      expect(result.deletedHabitCount).toBe(0);
    });

    it("cascades child rows for every deleted habit", async () => {
      const a = await createHabit(makeInput({ identity_phrase: "a runner", title: "A" }));
      const b = await createHabit(makeInput({ identity_phrase: "a runner", title: "B" }));
      for (const h of [a, b]) {
        await upsertLog({
          habit_id: h.id,
          user_id: "user-1",
          log_date: "2026-05-10",
          status: "done",
        });
      }

      await deleteGoal("user-1", "a runner");

      for (const h of [a, b]) {
        const logs = await db.getAllAsync(
          "SELECT * FROM local_habit_logs WHERE habit_id = ?",
          h.id,
        );
        expect(logs).toHaveLength(0);
      }
    });

    it("scopes by userId — does not touch another user's habits with the same phrase", async () => {
      const mine = await createHabit(
        makeInput({ user_id: "user-1", identity_phrase: "a runner", title: "Mine" }),
      );
      const theirs = await createHabit(
        makeInput({ user_id: "user-2", identity_phrase: "a runner", title: "Theirs" }),
      );

      const result = await deleteGoal("user-1", "a runner");

      expect(result.deletedHabitCount).toBe(1);
      expect(await getHabit(mine.id)).toBeNull();
      expect(await getHabit(theirs.id)).not.toBeNull();
    });

    it("deletes habits regardless of habit_state and status (active/automatic + active/archived/backlog)", async () => {
      const active = await createHabit(
        makeInput({ identity_phrase: "a runner", title: "Active" }),
      );
      const automatic = await createHabit(
        makeInput({
          identity_phrase: "a runner",
          title: "Automatic",
          habit_state: "automatic",
        }),
      );
      const archived = await createHabit(
        makeInput({
          identity_phrase: "a runner",
          title: "Archived",
          status: "archived",
        }),
      );
      const backlog = await createHabit(
        makeInput({
          identity_phrase: "a runner",
          title: "Backlog",
          status: "backlog",
        }),
      );

      const result = await deleteGoal("user-1", "a runner");

      expect(result.deletedHabitCount).toBe(4);
      for (const h of [active, automatic, archived, backlog]) {
        expect(await getHabit(h.id)).toBeNull();
      }
    });
  });

  describe("archiveGoal", () => {
    it("flips active and backlog habits to archived; leaves already-archived rows alone", async () => {
      const active = await createHabit(
        makeInput({ identity_phrase: "a writer", title: "A", status: "active" }),
      );
      const backlog = await createHabit(
        makeInput({
          identity_phrase: "a writer",
          title: "B",
          status: "backlog",
        }),
      );
      const alreadyArchived = await createHabit(
        makeInput({
          identity_phrase: "a writer",
          title: "C",
          status: "archived",
        }),
      );
      // The repo's createHabit does not stamp backlog_at automatically (the
      // API layer does, at api.ts:128). Stamp it here to mirror real-world
      // state and verify the archive cascade preserves the marker.
      const originalBacklogAt = "2020-01-15T08:00:00.000Z";
      await getDb().runAsync(
        "UPDATE local_habits SET backlog_at = ? WHERE id = ?",
        originalBacklogAt,
        backlog.id,
      );
      // Force archived_at + bump updated_at so we can assert the cascade
      // doesn't trample the original archive timestamp on prior-archived rows.
      const originalArchivedAt = "2020-01-01T00:00:00.000Z";
      await getDb().runAsync(
        "UPDATE local_habits SET archived_at = ? WHERE id = ?",
        originalArchivedAt,
        alreadyArchived.id,
      );

      const result = await archiveGoal("user-1", "a writer");

      expect(result.cascadedHabitCount).toBe(2);
      expect((await getHabit(active.id))!.status).toBe("archived");
      expect((await getHabit(backlog.id))!.status).toBe("archived");

      // backlog_at preserved on the ex-backlog row — required as the marker
      // restoreGoal uses to drive the ex-backlog branch.
      expect((await getHabit(backlog.id))!.backlog_at).toBe(originalBacklogAt);

      // Already-archived row untouched (original archived_at preserved).
      const stillArchived = await getHabit(alreadyArchived.id);
      expect(stillArchived!.status).toBe("archived");
      expect(stillArchived!.archived_at).toBe(originalArchivedAt);
    });

    it("returns zero count when nothing in cascade scope exists", async () => {
      await createHabit(
        makeInput({
          identity_phrase: "a writer",
          status: "archived",
        }),
      );
      const result = await archiveGoal("user-1", "a writer");
      expect(result.cascadedHabitCount).toBe(0);
    });

    it("scopes by userId — does not touch another user's habits with the same phrase", async () => {
      const mine = await createHabit(
        makeInput({ user_id: "user-1", identity_phrase: "a runner" }),
      );
      const theirs = await createHabit(
        makeInput({ user_id: "user-2", identity_phrase: "a runner" }),
      );

      await archiveGoal("user-1", "a runner");

      expect((await getHabit(mine.id))!.status).toBe("archived");
      expect((await getHabit(theirs.id))!.status).toBe("active");
    });
  });

  describe("restoreGoal", () => {
    it("restores ex-active habits with start_date preserved", async () => {
      const habit = await createHabit(
        makeInput({
          identity_phrase: "a writer",
          status: "active",
          start_date: "2020-01-15",
        }),
      );
      await archiveGoal("user-1", "a writer");

      const result = await restoreGoal("user-1", "a writer", "2030-12-31");

      expect(result.restoredExActive).toHaveLength(1);
      expect(result.restoredExBacklog).toHaveLength(0);
      const restored = await getHabit(habit.id);
      expect(restored!.status).toBe("active");
      expect(restored!.archived_at).toBeNull();
      // start_date preserved for ex-active rows — streak/log accounting
      // continues from the original creation date.
      expect(restored!.start_date).toBe("2020-01-15");
    });

    it("restores ex-backlog habits with start_date=today and backlog_at cleared", async () => {
      const habit = await createHabit(
        makeInput({
          identity_phrase: "a writer",
          status: "backlog",
          start_date: "2020-01-15",
        }),
      );
      // backlog_at gets stamped by the API layer at create-time, but the
      // repo test directly mirrors what would be in-place at archive time:
      await getDb().runAsync(
        "UPDATE local_habits SET backlog_at = ? WHERE id = ?",
        "2020-01-15T08:00:00.000Z",
        habit.id,
      );
      await archiveGoal("user-1", "a writer");

      const result = await restoreGoal("user-1", "a writer", "2030-12-31");

      expect(result.restoredExBacklog).toHaveLength(1);
      expect(result.restoredExActive).toHaveLength(0);
      const restored = await getHabit(habit.id);
      expect(restored!.status).toBe("active");
      expect(restored!.archived_at).toBeNull();
      expect(restored!.backlog_at).toBeNull();
      // start_date reset matches activateBacklogHabitRow semantics —
      // without it, a previously-backlog habit revives looking like an old
      // active habit and fabricates "missed" days.
      expect(restored!.start_date).toBe("2030-12-31");
    });

    it("splits a mixed cascade into ex-active and ex-backlog branches correctly", async () => {
      const activeHabit = await createHabit(
        makeInput({
          identity_phrase: "a writer",
          title: "A",
          status: "active",
          start_date: "2020-01-15",
        }),
      );
      const backlogHabit = await createHabit(
        makeInput({
          identity_phrase: "a writer",
          title: "B",
          status: "backlog",
        }),
      );
      await getDb().runAsync(
        "UPDATE local_habits SET backlog_at = ? WHERE id = ?",
        "2020-01-15T08:00:00.000Z",
        backlogHabit.id,
      );
      await archiveGoal("user-1", "a writer");

      const result = await restoreGoal("user-1", "a writer", "2030-12-31");

      expect(result.restoredExActive.map((h) => h.id)).toEqual([activeHabit.id]);
      expect(result.restoredExBacklog.map((h) => h.id)).toEqual([
        backlogHabit.id,
      ]);
      // Returned rows are post-update — caller relies on full row data
      // (notably active_days) to call materializePendingReminder.
      const exBacklog = result.restoredExBacklog[0];
      expect(exBacklog.status).toBe("active");
      expect(exBacklog.backlog_at).toBeNull();
      expect(exBacklog.start_date).toBe("2030-12-31");
    });

    it("leaves non-archived rows untouched", async () => {
      const activeHabit = await createHabit(
        makeInput({ identity_phrase: "a writer", status: "active" }),
      );
      await archiveGoal("user-1", "a writer");

      // Add a brand-new active habit AFTER the archive — restore must not
      // disturb it.
      const newActive = await createHabit(
        makeInput({ identity_phrase: "a writer", status: "active", title: "New" }),
      );

      const result = await restoreGoal("user-1", "a writer", "2030-12-31");

      expect(result.restoredExActive.map((h) => h.id)).toEqual([activeHabit.id]);
      // The newly-added active habit is in the returned set only if we
      // accidentally widened the WHERE clause. We didn't — the captured-ID
      // pattern keeps the cascade addressable to only the rows that were
      // archived in the first place.
      expect((await getHabit(newActive.id))!.status).toBe("active");
    });

    it("returns empty arrays when nothing matches", async () => {
      const result = await restoreGoal(
        "user-1",
        "nonexistent phrase",
        "2030-12-31",
      );
      expect(result.restoredExActive).toEqual([]);
      expect(result.restoredExBacklog).toEqual([]);
    });
  });

  it("declares habit_state and status constraints in the schema", async () => {
    const row = await db.getFirstAsync<{ sql: string }>(
      "SELECT sql FROM sqlite_master WHERE type = 'table' AND name = 'local_habits'",
    );

    expect(row?.sql).toContain("CHECK (habit_state IN ('active', 'automatic'))");
    expect(row?.sql).toContain("CHECK (status IN ('active', 'archived', 'backlog'))");
  });
});
