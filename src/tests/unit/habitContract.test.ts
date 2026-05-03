import {
  ACTIVE_HABITS_PER_GOAL_SOFT_CAP,
  FORGIVING_STREAK_RULES,
  HABIT_LOG_STATUSES,
  HABIT_STATES,
  HABIT_STATUSES,
  LOCAL_HABIT_FIELDS,
  LOCAL_HABIT_LOG_FIELDS,
  LOGICAL_DAY_FORMAT,
  LOGICAL_DAY_SOURCE,
  RETRO_LOG_WINDOW_HOURS,
} from "@/features/habits/contract";

describe("local-DB contract constants", () => {
  it("LOCAL_HABIT_FIELDS includes the new field names and not the old ones", () => {
    expect(LOCAL_HABIT_FIELDS).toContain("title");
    expect(LOCAL_HABIT_FIELDS).toContain("identity_phrase");
    expect(LOCAL_HABIT_FIELDS).toContain("cue");
    expect(LOCAL_HABIT_FIELDS).toContain("status");
    expect(LOCAL_HABIT_FIELDS).toContain("habit_state");
    expect(LOCAL_HABIT_FIELDS).not.toContain("name");
    expect(LOCAL_HABIT_FIELDS).not.toContain("identity_statement");
    expect(LOCAL_HABIT_FIELDS).not.toContain("stack_trigger");
    expect(LOCAL_HABIT_FIELDS).not.toContain("is_active");
    expect(LOCAL_HABIT_FIELDS).not.toContain("reminder_enabled");
    expect(LOCAL_HABIT_FIELDS).not.toContain("reminder_time");
  });

  it("LOCAL_HABIT_LOG_FIELDS matches the schema", () => {
    expect(LOCAL_HABIT_LOG_FIELDS).toEqual([
      "id",
      "habit_id",
      "user_id",
      "log_date",
      "status",
      "note",
      "created_at",
      "updated_at",
    ]);
  });

  it("HABIT_LOG_STATUSES matches expected values", () => {
    expect(HABIT_LOG_STATUSES).toEqual(["done", "skipped", "missed"]);
  });

  it("HABIT_STATES matches expected values", () => {
    expect(HABIT_STATES).toEqual(["active", "automatic"]);
  });

  it("HABIT_STATUSES matches expected values", () => {
    expect(HABIT_STATUSES).toEqual(["active", "archived", "backlog"]);
  });

  it("cap and streak constants have the correct values", () => {
    expect(ACTIVE_HABITS_PER_GOAL_SOFT_CAP).toBe(3);
    expect(RETRO_LOG_WINDOW_HOURS).toBe(48);
  });

  it("FORGIVING_STREAK_RULES documents the forgiving algorithm", () => {
    expect(FORGIVING_STREAK_RULES.skippedIsNeutral).toBe(true);
    expect(FORGIVING_STREAK_RULES.toleratesIsolatedMiss).toBe(true);
    expect(FORGIVING_STREAK_RULES.breaksOnConsecutiveMisses).toBe(true);
    expect(FORGIVING_STREAK_RULES.skippedRemovedBeforeMissEvaluation).toBe(true);
  });

  it("logical day constants are correct", () => {
    expect(LOGICAL_DAY_FORMAT).toBe("YYYY-MM-DD");
    expect(LOGICAL_DAY_SOURCE).toBe("device_local_day");
  });
});
