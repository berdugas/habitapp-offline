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
  archiveHabit,
  createHabit,
  deleteGoal,
  deleteHabit,
  reactivateHabit,
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
});
