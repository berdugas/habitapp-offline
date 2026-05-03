import type { SQLiteDatabase } from "expo-sqlite";

import { getDb } from "@/lib/db/client";
import { createTestDb } from "@/tests/setup/createTestDb";
import { resetClockForTesting, setNowForTesting } from "@/utils/clock";
import {
  archiveHabit,
  createHabit,
  getHabitById,
  getHabitLogsForHabitInRange,
  getHabitLogsInRange,
  listActiveHabits,
  listArchivedHabits,
  listEligibleHabitsForToday,
  listUpcomingHabits,
  RetroLogError,
  updateHabit,
  upsertHabitLog,
} from "@/features/habits/api";
import { createHabit as repoCreateHabit } from "@/lib/db/repositories/habits";
import type { CreateHabitInput } from "@/lib/db/repositories/habits";

jest.mock("@/lib/db/client");
const mockGetDb = getDb as jest.Mock;

// Fixed "now" used across all tests unless overridden per-case
const FIXED_NOW = new Date("2026-04-23T12:00:00");
const TODAY = "2026-04-23";

describe("habits API integration", () => {
  let db: SQLiteDatabase;

  beforeEach(async () => {
    db = await createTestDb();
    mockGetDb.mockReturnValue(db);
    setNowForTesting(FIXED_NOW);
  });

  afterEach(async () => {
    resetClockForTesting();
    await db.closeAsync();
  });

  // ─── Helpers ──────────────────────────────────────────────────────────────

  async function makeHabit(
    userId = "user-1",
    overrides: Partial<Parameters<typeof createHabit>[1]> = {},
  ) {
    return createHabit(userId, {
      title: "Meditate",
      identityPhrase: "I am calm",
      cue: "After coffee",
      tinyAction: "2 minutes of breathing",
      minimumViableAction: "One breath",
      preferredTimeWindow: "morning",
      habitState: "active",
      ...overrides,
    });
  }

  // ─── CRUD round-trips ────────────────────────────────────────────────────

  it("createHabit returns a habit with expected defaults", async () => {
    const habit = await makeHabit();
    expect(habit.id).toBeTruthy();
    expect(habit.title).toBe("Meditate");
    expect(habit.status).toBe("active");
    expect(habit.habit_state).toBe("active");
    expect(habit.start_date).toBe(TODAY);
    expect(habit.created_at).toBeTruthy();
    expect(habit.updated_at).toBeTruthy();
  });

  it("getHabitById round-trips a created habit", async () => {
    const created = await makeHabit();
    const fetched = await getHabitById("user-1", created.id);
    expect(fetched.id).toBe(created.id);
    expect(fetched.title).toBe("Meditate");
  });

  it("updateHabit changes specified fields and bumps updated_at", async () => {
    const habit = await makeHabit();
    const originalUpdatedAt = habit.updated_at;

    // Small delay to ensure updated_at is different
    await new Promise((r) => setTimeout(r, 5));

    const updated = await updateHabit("user-1", habit.id, {
      title: "Read",
      identityPhrase: "I am a reader",
      cue: "After dinner",
      tinyAction: "One page",
      minimumViableAction: "",
      preferredTimeWindow: "evening",
    });

    expect(updated.title).toBe("Read");
    expect(updated.cue).toBe("After dinner");
    expect(updated.updated_at).not.toBe(originalUpdatedAt);
  });

  it("archiveHabit sets status to archived and populates archived_at", async () => {
    const habit = await makeHabit();
    await archiveHabit("user-1", habit.id);
    const archived = await getHabitById("user-1", habit.id);
    expect(archived.status).toBe("archived");
    expect(archived.archived_at).toBeTruthy();
  });

  // ─── Listing functions ───────────────────────────────────────────────────

  it("listActiveHabits returns only active habits for the given user", async () => {
    const h1 = await makeHabit("user-1");
    const h2 = await makeHabit("user-1");
    await archiveHabit("user-1", h2.id);
    await makeHabit("user-2"); // different user

    const active = await listActiveHabits("user-1");
    expect(active.map((h) => h.id)).toContain(h1.id);
    expect(active.map((h) => h.id)).not.toContain(h2.id);
    expect(active.every((h) => h.user_id === "user-1")).toBe(true);
  });

  it("listEligibleHabitsForToday filters by start_date <= today", async () => {
    const eligible = await makeHabit(); // start_date = today (FIXED_NOW)

    // Habit starting tomorrow
    const upcoming = await createHabit("user-1", {
      title: "Future habit",
      identityPhrase: "",
      cue: "Morning",
      tinyAction: "Do it",
      minimumViableAction: "",
      preferredTimeWindow: "",
      habitState: "active",
    });
    // Override start_date to tomorrow by using the repo directly after creation
    // We verify by checking the filter, not by mutating — the API sets start_date = today
    // so both would be eligible. Use a trick: archive the "upcoming" one and check the list.
    // Actually, since the API always sets start_date=today, we test the filter by seeding
    // a habit with a future start_date directly through the repo.
    
    await repoCreateHabit({
      user_id: "user-1",
      title: "Not yet",
      cue: "Later",
      tiny_action: "Wait",
      identity_phrase: null,
      minimum_viable_action: null,
      preferred_time_window: null,
      start_date: "2026-04-24", // tomorrow
      habit_state: "active",
      status: "active",
    });

    const eligibleList = await listEligibleHabitsForToday("user-1", TODAY);
    expect(eligibleList.some((h) => h.title === "Meditate")).toBe(true);
    expect(eligibleList.some((h) => h.title === "Not yet")).toBe(false);
    void upcoming; // suppress unused
  });

  it("listUpcomingHabits filters by start_date > today and sorts by start_date ASC", async () => {
    
    await repoCreateHabit({
      user_id: "user-1",
      title: "Far future",
      cue: "Later",
      tiny_action: "Do it",
      identity_phrase: null,
      minimum_viable_action: null,
      preferred_time_window: null,
      start_date: "2026-04-26",
      habit_state: "active",
      status: "active",
    });
    await repoCreateHabit({
      user_id: "user-1",
      title: "Near future",
      cue: "Later",
      tiny_action: "Do it",
      identity_phrase: null,
      minimum_viable_action: null,
      preferred_time_window: null,
      start_date: "2026-04-24",
      habit_state: "active",
      status: "active",
    });
    await makeHabit("user-1"); // today — should not appear

    const upcoming = await listUpcomingHabits("user-1", TODAY);
    expect(upcoming.some((h) => h.title === "Meditate")).toBe(false);
    expect(upcoming.length).toBeGreaterThanOrEqual(2);
    // Sorted by start_date ASC
    expect(upcoming[0]!.start_date <= upcoming[1]!.start_date).toBe(true);
    expect(upcoming.map((h) => h.title)).toContain("Near future");
    expect(upcoming.map((h) => h.title)).toContain("Far future");
  });

  it("listArchivedHabits returns only archived habits for the user", async () => {
    const h = await makeHabit("user-1");
    await archiveHabit("user-1", h.id);
    const active = await makeHabit("user-1");

    const archived = await listArchivedHabits("user-1");
    expect(archived.some((a) => a.id === h.id)).toBe(true);
    expect(archived.some((a) => a.id === active.id)).toBe(false);
  });

  // ─── Log upsert — happy paths ────────────────────────────────────────────

  it("upsertHabitLog inserts a log for today", async () => {
    const habit = await makeHabit();
    const log = await upsertHabitLog("user-1", {
      habitId: habit.id,
      logDate: TODAY,
      status: "done",
    });
    expect(log.status).toBe("done");
    expect(log.log_date).toBe(TODAY);
    expect(log.habit_id).toBe(habit.id);
  });

  it("upsertHabitLog updates an existing log for the same date (upsert)", async () => {
    const habit = await makeHabit();
    const first = await upsertHabitLog("user-1", {
      habitId: habit.id,
      logDate: TODAY,
      status: "done",
    });
    const second = await upsertHabitLog("user-1", {
      habitId: habit.id,
      logDate: TODAY,
      status: "skipped",
    });
    expect(second.status).toBe("skipped");
    expect(second.log_date).toBe(TODAY);
    // Same row — IDs match in SQLite ON CONFLICT DO UPDATE
    expect(second.habit_id).toBe(first.habit_id);
  });

  it("getHabitLogsForHabitInRange returns logs within range", async () => {
    const habit = await makeHabit();
    await upsertHabitLog("user-1", { habitId: habit.id, logDate: TODAY, status: "done" });

    const logs = await getHabitLogsForHabitInRange(
      "user-1",
      habit.id,
      "2026-04-01",
      "2026-04-30",
    );
    expect(logs.length).toBe(1);
    expect(logs[0]!.log_date).toBe(TODAY);
  });

  it("getHabitLogsInRange returns logs for all habits by the user within range", async () => {
    const h1 = await makeHabit("user-1");
    const h2 = await makeHabit("user-1");
    await upsertHabitLog("user-1", { habitId: h1.id, logDate: TODAY, status: "done" });
    await upsertHabitLog("user-1", { habitId: h2.id, logDate: TODAY, status: "skipped" });

    const logs = await getHabitLogsInRange("user-1", "2026-04-01", "2026-04-30");
    expect(logs.length).toBe(2);
  });

  // ─── 48-hour window — accepted ───────────────────────────────────────────

  it("accepts a log for today", async () => {
    const habit = await makeHabit();
    await expect(
      upsertHabitLog("user-1", { habitId: habit.id, logDate: TODAY, status: "done" }),
    ).resolves.toBeTruthy();
  });

  it("accepts a log for yesterday", async () => {
    // Create habit with start_date in the past so yesterday is not before_start_date
    
    const habit = await repoCreateHabit({
      user_id: "user-1",
      title: "Old habit",
      cue: "Morning",
      tiny_action: "Do it",
      identity_phrase: null,
      minimum_viable_action: null,
      preferred_time_window: null,
      start_date: "2026-04-20",
      habit_state: "active",
      status: "active",
    });
    await expect(
      upsertHabitLog("user-1", { habitId: habit.id, logDate: "2026-04-22", status: "done" }),
    ).resolves.toBeTruthy();
  });

  it("accepts a log for two days ago when within the 48-hour window (clock at noon)", async () => {
    // now = Apr 23 noon. Log for Apr 21. Window: Apr 21 23:59:59 + 48h = Apr 23 23:59:59.
    // Apr 23 noon < Apr 23 23:59:59 → within window.
    
    const habit = await repoCreateHabit({
      user_id: "user-1",
      title: "Old habit",
      cue: "Morning",
      tiny_action: "Do it",
      identity_phrase: null,
      minimum_viable_action: null,
      preferred_time_window: null,
      start_date: "2026-04-19",
      habit_state: "active",
      status: "active",
    });
    await expect(
      upsertHabitLog("user-1", { habitId: habit.id, logDate: "2026-04-21", status: "done" }),
    ).resolves.toBeTruthy();
  });

  it("accepts a log for two days ago when clock is at midnight (start of today)", async () => {
    // Window for Apr 21 ends at Apr 23 23:59:59.999. Clock at midnight Apr 23 00:00:00 → inside.
    setNowForTesting(new Date(2026, 3, 23, 0, 0, 0)); // Apr 23 00:00:00 device-local
    
    const habit = await repoCreateHabit({
      user_id: "user-1",
      title: "Old habit",
      cue: "Morning",
      tiny_action: "Do it",
      identity_phrase: null,
      minimum_viable_action: null,
      preferred_time_window: null,
      start_date: "2026-04-19",
      habit_state: "active",
      status: "active",
    });
    await expect(
      upsertHabitLog("user-1", { habitId: habit.id, logDate: "2026-04-21", status: "done" }),
    ).resolves.toBeTruthy();
  });

  // ─── 48-hour window — rejected ───────────────────────────────────────────

  it("rejects a log for three days ago (outside_window)", async () => {
    // Window for Apr 20 ends Apr 22 23:59:59. Clock is Apr 23 noon → outside window.
    
    const habit = await repoCreateHabit({
      user_id: "user-1",
      title: "Old habit",
      cue: "Morning",
      tiny_action: "Do it",
      identity_phrase: null,
      minimum_viable_action: null,
      preferred_time_window: null,
      start_date: "2026-04-18",
      habit_state: "active",
      status: "active",
    });
    await expect(
      upsertHabitLog("user-1", { habitId: habit.id, logDate: "2026-04-20", status: "done" }),
    ).rejects.toMatchObject({ reason: "outside_window" });
  });

  it("rejects a log for tomorrow (future_date)", async () => {
    const habit = await makeHabit();
    await expect(
      upsertHabitLog("user-1", { habitId: habit.id, logDate: "2026-04-24", status: "done" }),
    ).rejects.toMatchObject({ reason: "future_date" });
  });

  it("rejects a log for a date before the habit's start_date (before_start_date)", async () => {
    const habit = await makeHabit(); // start_date = TODAY = Apr 23
    // Apr 22 is before start_date even though it's within the 48h window
    await expect(
      upsertHabitLog("user-1", { habitId: habit.id, logDate: "2026-04-22", status: "done" }),
    ).rejects.toMatchObject({ reason: "before_start_date" });
  });

  it("rejects a log for an archived habit (habit_archived)", async () => {
    const habit = await makeHabit();
    await archiveHabit("user-1", habit.id);
    await expect(
      upsertHabitLog("user-1", { habitId: habit.id, logDate: TODAY, status: "done" }),
    ).rejects.toMatchObject({ reason: "habit_archived" });
  });

  it("RetroLogError instances have a .reason property", async () => {
    
    const habit = await repoCreateHabit({
      user_id: "user-1",
      title: "Old habit",
      cue: "Morning",
      tiny_action: "Do it",
      identity_phrase: null,
      minimum_viable_action: null,
      preferred_time_window: null,
      start_date: "2026-04-18",
      habit_state: "active",
      status: "active",
    });
    let caught: unknown;
    try {
      await upsertHabitLog("user-1", { habitId: habit.id, logDate: "2026-04-20", status: "done" });
    } catch (e) {
      caught = e;
    }
    expect(caught).toBeInstanceOf(RetroLogError);
    expect((caught as RetroLogError).reason).toBe("outside_window");
  });

  // ─── Cross-user isolation ────────────────────────────────────────────────

  it("getHabitById throws when the requesting user does not own the habit", async () => {
    const habit = await makeHabit("user-1");
    await expect(getHabitById("user-2", habit.id)).rejects.toThrow();
  });

  it("upsertHabitLog throws when the requesting user does not own the habit", async () => {
    const habit = await makeHabit("user-1");
    await expect(
      upsertHabitLog("user-2", { habitId: habit.id, logDate: TODAY, status: "done" }),
    ).rejects.toThrow();
  });

  it("listActiveHabits does not return habits belonging to another user", async () => {
    await makeHabit("user-1");
    const active = await listActiveHabits("user-2");
    expect(active).toHaveLength(0);
  });
});
