const mockCancelReminder = jest.fn().mockResolvedValue(undefined);
const mockMaterializePendingReminder = jest.fn().mockResolvedValue(true);

jest.mock("@/features/reminders/notifications", () => ({
  cancelReminder: (...args: unknown[]) => mockCancelReminder(...args),
  materializePendingReminder: (...args: unknown[]) =>
    mockMaterializePendingReminder(...args),
  persistReminderIntent: jest.fn(),
  scheduleReminder: jest.fn(),
}));

import {
  activateBacklogHabit,
  archiveGoal,
  archiveHabit,
  createHabit,
  deleteGoal,
  deleteHabit,
  listArchivedGoals,
  reactivateHabit,
  restoreGoal,
} from "@/features/habits/api";
import { closeDb, getDb, initDb } from "@/lib/db/client";
import * as habitsRepo from "@/lib/db/repositories/habits";
import { getHabit, listHabits } from "@/lib/db/repositories/habits";
import { resetClockForTesting, setNowForTesting } from "@/utils/clock";

async function seedActiveHabit(overrides: Partial<{
  user_id: string;
  identity_phrase: string | null;
  start_date: string;
}> = {}) {
  return createHabit(overrides.user_id ?? "user-1", {
    title: "Run",
    identityPhrase: overrides.identity_phrase ?? "a runner",
    cue: "morning coffee",
    tinyAction: "run for 2 minutes",
    minimumViableAction: "",
    preferredTimeWindow: "",
    icon: "",
    activeDays: [1, 2, 3, 4, 5, 6, 7],
    habitState: "active",
  });
}

describe("habits/api — new mutations", () => {
  beforeEach(async () => {
    await initDb();
    setNowForTesting(new Date("2026-05-16T12:00:00.000Z"));
    mockCancelReminder.mockClear();
    mockMaterializePendingReminder.mockClear();
    mockMaterializePendingReminder.mockResolvedValue(true);
  });

  afterEach(async () => {
    await closeDb();
    resetClockForTesting();
  });

  describe("createHabit with status='backlog'", () => {
    it("sets status=backlog and stamps backlog_at when created from backlog mode", async () => {
      const habit = await createHabit("user-1", {
        title: "Read",
        identityPhrase: "a reader",
        cue: "after coffee",
        tinyAction: "read 1 page",
        minimumViableAction: "",
        preferredTimeWindow: "",
        icon: "",
        activeDays: [1, 2, 3, 4, 5, 6, 7],
        habitState: "active",
        status: "backlog",
      });

      const row = await getHabit(habit.id);
      expect(row?.status).toBe("backlog");
      expect(row?.backlog_at).not.toBeNull();
    });

    it("defaults to status=active when no status provided", async () => {
      const habit = await seedActiveHabit();
      const row = await getHabit(habit.id);
      expect(row?.status).toBe("active");
      expect(row?.backlog_at).toBeNull();
    });

    it("backlog habits are not returned by active list filter", async () => {
      await createHabit("user-1", {
        title: "Active",
        identityPhrase: "a doer",
        cue: "after lunch",
        tinyAction: "walk",
        minimumViableAction: "",
        preferredTimeWindow: "",
        icon: "",
        habitState: "active",
        status: "active",
      });
      await createHabit("user-1", {
        title: "Backlogged",
        identityPhrase: "a doer",
        cue: "after dinner",
        tinyAction: "read",
        minimumViableAction: "",
        preferredTimeWindow: "",
        icon: "",
        habitState: "active",
        status: "backlog",
      });
      const active = await listHabits({ user_id: "user-1", status: "active" });
      expect(active.map((h) => h.title)).toEqual(["Active"]);
    });
  });

  describe("reactivateHabit", () => {
    it("throws when habit is not owned by user", async () => {
      const habit = await seedActiveHabit({ user_id: "user-1" });
      await expect(reactivateHabit("user-2", habit.id)).rejects.toThrow(
        /not found/i,
      );
    });

    it("throws when habit is not graduated", async () => {
      const habit = await seedActiveHabit();
      await expect(reactivateHabit("user-1", habit.id)).rejects.toThrow(
        /not graduated/i,
      );
    });

    it("flips habit_state to active, clears automated_at, resets start_date to today", async () => {
      const habit = await seedActiveHabit();
      // Manually mark as graduated.
      await getDb().runAsync(
        "UPDATE local_habits SET habit_state = 'automatic', automated_at = ? WHERE id = ?",
        "2026-03-01T12:00:00.000Z",
        habit.id,
      );

      setNowForTesting(new Date("2026-05-16T12:00:00.000Z"));
      const result = await reactivateHabit("user-1", habit.id);

      expect(result.habit_state).toBe("active");
      expect(result.automated_at).toBeNull();
      expect(result.start_date).toBe("2026-05-16");
    });

    it("refuses to reactivate an archived graduated habit (defensive — would leave it invisible)", async () => {
      const habit = await seedActiveHabit();
      // Mark as both graduated AND archived.
      await getDb().runAsync(
        `UPDATE local_habits
            SET habit_state = 'automatic', automated_at = ?, status = 'archived', archived_at = ?
          WHERE id = ?`,
        "2026-03-01T12:00:00.000Z",
        "2026-04-01T12:00:00.000Z",
        habit.id,
      );

      await expect(reactivateHabit("user-1", habit.id)).rejects.toThrow(
        /not active/i,
      );

      const row = await getHabit(habit.id);
      expect(row?.habit_state).toBe("automatic");
      expect(row?.status).toBe("archived");
    });
  });

  describe("activateBacklogHabit", () => {
    it("throws when habit is not owned by user", async () => {
      const habit = await createHabit("user-1", {
        title: "X",
        identityPhrase: "a doer",
        cue: "c",
        tinyAction: "t",
        minimumViableAction: "",
        preferredTimeWindow: "",
        icon: "",
        habitState: "active",
        status: "backlog",
      });
      await expect(activateBacklogHabit("user-2", habit.id)).rejects.toThrow(
        /not found/i,
      );
    });

    it("throws when habit is not in backlog", async () => {
      const habit = await seedActiveHabit();
      await expect(activateBacklogHabit("user-1", habit.id)).rejects.toThrow(
        /not in backlog/i,
      );
    });

    it("flips status to active, clears backlog_at, resets start_date to today", async () => {
      const habit = await createHabit("user-1", {
        title: "X",
        identityPhrase: "a doer",
        cue: "c",
        tinyAction: "t",
        minimumViableAction: "",
        preferredTimeWindow: "",
        icon: "",
        habitState: "active",
        status: "backlog",
      });

      setNowForTesting(new Date("2026-06-01T08:00:00.000Z"));
      const result = await activateBacklogHabit("user-1", habit.id);

      expect(result.status).toBe("active");
      expect(result.backlog_at).toBeNull();
      expect(result.start_date).toBe("2026-06-01");
    });

    it("invokes materializePendingReminder with parsed active days", async () => {
      const habit = await createHabit("user-1", {
        title: "X",
        identityPhrase: "a doer",
        cue: "c",
        tinyAction: "t",
        minimumViableAction: "",
        preferredTimeWindow: "",
        icon: "",
        activeDays: [1, 3, 5],
        habitState: "active",
        status: "backlog",
      });

      await activateBacklogHabit("user-1", habit.id);

      expect(mockMaterializePendingReminder).toHaveBeenCalledTimes(1);
      expect(mockMaterializePendingReminder).toHaveBeenCalledWith(
        habit.id,
        "user-1",
        [1, 3, 5],
      );
    });

    it("activation succeeds even when materializePendingReminder resolves false (permission denied)", async () => {
      mockMaterializePendingReminder.mockResolvedValueOnce(false);
      const habit = await createHabit("user-1", {
        title: "X",
        identityPhrase: "a doer",
        cue: "c",
        tinyAction: "t",
        minimumViableAction: "",
        preferredTimeWindow: "",
        icon: "",
        habitState: "active",
        status: "backlog",
      });

      const result = await activateBacklogHabit("user-1", habit.id);
      expect(result.status).toBe("active");
    });
  });

  describe("deleteHabit", () => {
    it("throws when habit is not owned by user", async () => {
      const habit = await seedActiveHabit({ user_id: "user-1" });
      await expect(deleteHabit("user-2", habit.id)).rejects.toThrow(/not found/i);
      // Row should still exist.
      expect(await getHabit(habit.id)).not.toBeNull();
    });

    it("calls cancelReminder before the repo delete (order assertion)", async () => {
      // Spy on the repo deleteHabit to capture invocation order.
      const deleteHabitSpy = jest.spyOn(habitsRepo, "deleteHabit");

      const habit = await seedActiveHabit();
      await deleteHabit("user-1", habit.id);

      expect(mockCancelReminder).toHaveBeenCalled();
      expect(deleteHabitSpy).toHaveBeenCalled();

      const cancelOrder = mockCancelReminder.mock.invocationCallOrder[0];
      const deleteOrder = deleteHabitSpy.mock.invocationCallOrder[0];
      expect(cancelOrder).toBeLessThan(deleteOrder);

      deleteHabitSpy.mockRestore();
    });

    it("does not throw when cancelReminder rejects (best-effort)", async () => {
      mockCancelReminder.mockRejectedValueOnce(new Error("permission denied"));
      const habit = await seedActiveHabit();
      await expect(deleteHabit("user-1", habit.id)).resolves.toBeUndefined();
      expect(await getHabit(habit.id)).toBeNull();
    });

    it("hard-deletes the habit row", async () => {
      const habit = await seedActiveHabit();
      await deleteHabit("user-1", habit.id);
      expect(await getHabit(habit.id)).toBeNull();
    });
  });

  describe("archiveHabit (regression — still ownership-checked)", () => {
    it("throws when habit is not owned by user", async () => {
      const habit = await seedActiveHabit({ user_id: "user-1" });
      await expect(archiveHabit("user-2", habit.id)).rejects.toThrow(/not found/i);
    });
  });

  describe("deleteGoal", () => {
    it("returns count=0 + empty deletedHabitIds and skips cancelReminder when no habits match", async () => {
      const result = await deleteGoal("user-1", "no such phrase");
      expect(result).toEqual({ deletedHabitCount: 0, deletedHabitIds: [] });
      expect(mockCancelReminder).not.toHaveBeenCalled();
    });

    it("cancels reminders for every habit before the repo delete (any habit_state/status)", async () => {
      // Seed: one active, one automatic, one archived, one backlog — all
      // under the same identity_phrase. The api wrapper must cancel each
      // before calling the repo's deleteGoal.
      const active = await seedActiveHabit({
        identity_phrase: "a runner",
      });
      const automatic = await createHabit("user-1", {
        title: "Stretch",
        identityPhrase: "a runner",
        cue: "after run",
        tinyAction: "stretch for 30s",
        minimumViableAction: "",
        preferredTimeWindow: "",
        icon: "",
        activeDays: [1, 2, 3, 4, 5, 6, 7],
        habitState: "automatic",
      });
      // Archived and backlog rows need to be inserted directly — the api's
      // createHabit forces status defaults. Use the repo to bypass that.
      const archived = await habitsRepo.createHabit({
        user_id: "user-1",
        title: "Hydrate",
        identity_phrase: "a runner",
        cue: "after stretch",
        tiny_action: "drink water",
        minimum_viable_action: null,
        preferred_time_window: null,
        start_date: "2026-05-01",
        status: "archived",
      });
      const backlog = await habitsRepo.createHabit({
        user_id: "user-1",
        title: "Foam roll",
        identity_phrase: "a runner",
        cue: "evening",
        tiny_action: "foam roll for 1 min",
        minimum_viable_action: null,
        preferred_time_window: null,
        start_date: "2026-05-01",
        status: "backlog",
      });

      const deleteGoalSpy = jest.spyOn(habitsRepo, "deleteGoal");

      const result = await deleteGoal("user-1", "a runner");

      expect(result.deletedHabitCount).toBe(4);
      expect(result.deletedHabitIds.sort()).toEqual(
        [active.id, automatic.id, archived.id, backlog.id].sort(),
      );
      expect(mockCancelReminder).toHaveBeenCalledTimes(4);
      const cancelledIds = mockCancelReminder.mock.calls.map((c) => c[0]).sort();
      expect(cancelledIds).toEqual(
        [active.id, automatic.id, archived.id, backlog.id].sort(),
      );

      // All cancels happened before the repo delete fired.
      const lastCancelOrder = Math.max(
        ...mockCancelReminder.mock.invocationCallOrder,
      );
      const deleteOrder = deleteGoalSpy.mock.invocationCallOrder[0];
      expect(lastCancelOrder).toBeLessThan(deleteOrder);

      // Rows are gone.
      for (const h of [active, automatic, archived, backlog]) {
        expect(await getHabit(h.id)).toBeNull();
      }

      deleteGoalSpy.mockRestore();
    });

    it("does not throw when a cancelReminder rejects (best-effort)", async () => {
      mockCancelReminder.mockRejectedValueOnce(new Error("permission denied"));
      const habit = await seedActiveHabit({ identity_phrase: "a runner" });
      await expect(deleteGoal("user-1", "a runner")).resolves.toEqual({
        deletedHabitCount: 1,
        deletedHabitIds: [habit.id],
      });
      expect(await getHabit(habit.id)).toBeNull();
    });
  });

  describe("archiveGoal", () => {
    it("returns zero counts and skips cancelReminder when nothing to cascade", async () => {
      const result = await archiveGoal("user-1", "no such phrase");
      expect(result.cascadedHabitCount).toBe(0);
      expect(result.cascadedHabitIds).toEqual([]);
      expect(result.cancelledActiveHabitIds).toEqual([]);
      expect(result.preservedBacklogHabitIds).toEqual([]);
      expect(mockCancelReminder).not.toHaveBeenCalled();
    });

    it("cancels reminders only for active habits — backlog reminder intent is preserved", async () => {
      const activeHabit = await seedActiveHabit({ identity_phrase: "a writer" });
      // Backlog habit goes through the API so backlog_at is stamped per the
      // real lifecycle. Reminder intent is what materializePendingReminder
      // would need on later activation — it must survive the archive cascade.
      const backlogHabit = await createHabit("user-1", {
        title: "Read",
        identityPhrase: "a writer",
        cue: "after dinner",
        tinyAction: "read 1 page",
        minimumViableAction: "",
        preferredTimeWindow: "",
        icon: "",
        activeDays: [1, 2, 3, 4, 5, 6, 7],
        habitState: "active",
        status: "backlog",
      });
      // Already-archived habit must not have its reminder touched.
      const archivedHabit = await habitsRepo.createHabit({
        user_id: "user-1",
        title: "Old archive",
        identity_phrase: "a writer",
        cue: "x",
        tiny_action: "y",
        minimum_viable_action: null,
        preferred_time_window: null,
        start_date: "2026-04-01",
        status: "archived",
      });

      const result = await archiveGoal("user-1", "a writer");

      expect(result.cascadedHabitCount).toBe(2);
      expect(result.cascadedHabitIds.sort()).toEqual(
        [activeHabit.id, backlogHabit.id].sort(),
      );
      expect(result.cancelledActiveHabitIds).toEqual([activeHabit.id]);
      expect(result.preservedBacklogHabitIds).toEqual([backlogHabit.id]);

      // cancelReminder fired exactly once — for the active habit, NOT the
      // backlog habit (which would null its reminder_time intent) and NOT
      // the already-archived row.
      expect(mockCancelReminder).toHaveBeenCalledTimes(1);
      expect(mockCancelReminder).toHaveBeenCalledWith(activeHabit.id);
      expect(mockCancelReminder).not.toHaveBeenCalledWith(backlogHabit.id);
      expect(mockCancelReminder).not.toHaveBeenCalledWith(archivedHabit.id);

      // Rows landed in archived state in the DB.
      expect((await getHabit(activeHabit.id))!.status).toBe("archived");
      expect((await getHabit(backlogHabit.id))!.status).toBe("archived");
      // The ex-backlog row still carries backlog_at as the restore marker.
      expect((await getHabit(backlogHabit.id))!.backlog_at).not.toBeNull();
    });

    it("does not throw when a cancelReminder rejects (best-effort)", async () => {
      mockCancelReminder.mockRejectedValueOnce(new Error("permission denied"));
      const habit = await seedActiveHabit({ identity_phrase: "a writer" });
      const result = await archiveGoal("user-1", "a writer");
      expect(result.cascadedHabitCount).toBe(1);
      expect(result.cancelledActiveHabitIds).toEqual([habit.id]);
    });
  });

  describe("restoreGoal", () => {
    it("returns zero counts when nothing to restore", async () => {
      const result = await restoreGoal("user-1", "no such phrase");
      expect(result.restoredExActiveCount).toBe(0);
      expect(result.restoredExBacklogCount).toBe(0);
      expect(result.restoredHabitIds).toEqual([]);
      expect(mockMaterializePendingReminder).not.toHaveBeenCalled();
    });

    it("rematerializes reminders only for ex-backlog habits", async () => {
      const activeHabit = await seedActiveHabit({ identity_phrase: "a writer" });
      const backlogHabit = await createHabit("user-1", {
        title: "Read",
        identityPhrase: "a writer",
        cue: "after dinner",
        tinyAction: "read 1 page",
        minimumViableAction: "",
        preferredTimeWindow: "",
        icon: "",
        activeDays: [1, 2, 3, 4, 5, 6, 7],
        habitState: "active",
        status: "backlog",
      });
      await archiveGoal("user-1", "a writer");
      mockCancelReminder.mockClear();

      const result = await restoreGoal("user-1", "a writer");

      expect(result.restoredExActiveCount).toBe(1);
      expect(result.restoredExBacklogCount).toBe(1);
      expect(result.restoredHabitIds.sort()).toEqual(
        [activeHabit.id, backlogHabit.id].sort(),
      );

      // Mirrors activateBacklogHabit: rematerialize the ex-backlog habit's
      // saved reminder intent. Ex-active stays not-rearmed (matches
      // reactivateHabit semantics).
      expect(mockMaterializePendingReminder).toHaveBeenCalledTimes(1);
      expect(mockMaterializePendingReminder).toHaveBeenCalledWith(
        backlogHabit.id,
        "user-1",
        expect.any(Array),
      );
      expect(mockMaterializePendingReminder).not.toHaveBeenCalledWith(
        activeHabit.id,
        expect.anything(),
        expect.anything(),
      );

      // Rows are restored to active and ex-backlog's backlog_at is cleared.
      const restoredActive = await getHabit(activeHabit.id);
      const restoredBacklog = await getHabit(backlogHabit.id);
      expect(restoredActive!.status).toBe("active");
      expect(restoredBacklog!.status).toBe("active");
      expect(restoredBacklog!.backlog_at).toBeNull();
    });

    it("does not throw when materializePendingReminder fails (best-effort)", async () => {
      mockMaterializePendingReminder.mockRejectedValueOnce(
        new Error("permission denied"),
      );
      await createHabit("user-1", {
        title: "Read",
        identityPhrase: "a writer",
        cue: "after dinner",
        tinyAction: "read 1 page",
        minimumViableAction: "",
        preferredTimeWindow: "",
        icon: "",
        activeDays: [1, 2, 3, 4, 5, 6, 7],
        habitState: "active",
        status: "backlog",
      });
      await archiveGoal("user-1", "a writer");

      await expect(restoreGoal("user-1", "a writer")).resolves.toMatchObject({
        restoredExBacklogCount: 1,
      });
    });
  });

  describe("listArchivedGoals", () => {
    it("returns only goals where every habit is archived (no active, no backlog)", async () => {
      // Fully-archived: 2 habits all archived under "a writer"
      await habitsRepo.createHabit({
        user_id: "user-1",
        title: "A",
        identity_phrase: "a writer",
        cue: "x",
        tiny_action: "y",
        minimum_viable_action: null,
        preferred_time_window: null,
        start_date: "2026-04-01",
        status: "archived",
      });
      await habitsRepo.createHabit({
        user_id: "user-1",
        title: "B",
        identity_phrase: "a writer",
        cue: "x",
        tiny_action: "y",
        minimum_viable_action: null,
        preferred_time_window: null,
        start_date: "2026-04-01",
        status: "archived",
      });
      // Mixed (1 active, 1 archived) — should NOT show up as an archived goal.
      await seedActiveHabit({ identity_phrase: "a runner" });
      await habitsRepo.createHabit({
        user_id: "user-1",
        title: "Old run",
        identity_phrase: "a runner",
        cue: "x",
        tiny_action: "y",
        minimum_viable_action: null,
        preferred_time_window: null,
        start_date: "2026-04-01",
        status: "archived",
      });

      const result = await listArchivedGoals("user-1");

      expect(result).toHaveLength(1);
      expect(result[0].identityPhrase).toBe("a writer");
      expect(result[0].habitCount).toBe(2);
    });

    it("excludes goalless archived habits — empty/null identity_phrase never rolls up", async () => {
      await habitsRepo.createHabit({
        user_id: "user-1",
        title: "Goalless",
        identity_phrase: null,
        cue: "x",
        tiny_action: "y",
        minimum_viable_action: null,
        preferred_time_window: null,
        start_date: "2026-04-01",
        status: "archived",
      });
      const result = await listArchivedGoals("user-1");
      expect(result).toEqual([]);
    });

    it("scopes by userId", async () => {
      await habitsRepo.createHabit({
        user_id: "user-2",
        title: "Theirs",
        identity_phrase: "a writer",
        cue: "x",
        tiny_action: "y",
        minimum_viable_action: null,
        preferred_time_window: null,
        start_date: "2026-04-01",
        status: "archived",
      });

      expect(await listArchivedGoals("user-1")).toEqual([]);
    });

    it("excludes goals where any habit is backlog (goal isn't fully archived)", async () => {
      await habitsRepo.createHabit({
        user_id: "user-1",
        title: "Archived",
        identity_phrase: "a writer",
        cue: "x",
        tiny_action: "y",
        minimum_viable_action: null,
        preferred_time_window: null,
        start_date: "2026-04-01",
        status: "archived",
      });
      await habitsRepo.createHabit({
        user_id: "user-1",
        title: "Backlog",
        identity_phrase: "a writer",
        cue: "x",
        tiny_action: "y",
        minimum_viable_action: null,
        preferred_time_window: null,
        start_date: "2026-04-01",
        status: "backlog",
      });
      expect(await listArchivedGoals("user-1")).toEqual([]);
    });

    it("orders by archivedAt descending (most recent first)", async () => {
      // Insert in non-recent order so we test the sort, not the insert order.
      const oldH = await habitsRepo.createHabit({
        user_id: "user-1",
        title: "Older",
        identity_phrase: "older goal",
        cue: "x",
        tiny_action: "y",
        minimum_viable_action: null,
        preferred_time_window: null,
        start_date: "2026-04-01",
        status: "archived",
      });
      const newH = await habitsRepo.createHabit({
        user_id: "user-1",
        title: "Newer",
        identity_phrase: "newer goal",
        cue: "x",
        tiny_action: "y",
        minimum_viable_action: null,
        preferred_time_window: null,
        start_date: "2026-04-01",
        status: "archived",
      });
      await getDb().runAsync(
        "UPDATE local_habits SET archived_at = ? WHERE id = ?",
        "2020-01-01T00:00:00.000Z",
        oldH.id,
      );
      await getDb().runAsync(
        "UPDATE local_habits SET archived_at = ? WHERE id = ?",
        "2026-01-01T00:00:00.000Z",
        newH.id,
      );

      const result = await listArchivedGoals("user-1");
      expect(result.map((g) => g.identityPhrase)).toEqual([
        "newer goal",
        "older goal",
      ]);
    });
  });
});
