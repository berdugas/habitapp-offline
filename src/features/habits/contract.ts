import type { HabitState, HabitStatus, LogStatus } from "@/features/habits/types";

// Fields persisted on local_habits, in schema declaration order.
// Used by tests that round-trip rows through the repo.
export const LOCAL_HABIT_FIELDS = [
  "id",
  "user_id",
  "title",
  "identity_phrase",
  "cue",
  "tiny_action",
  "minimum_viable_action",
  "preferred_time_window",
  "habit_state",
  "status",
  "start_date",
  "created_at",
  "updated_at",
  "archived_at",
  "automated_at",
  "backlog_at",
] as const;

export const LOCAL_HABIT_LOG_FIELDS = [
  "id",
  "habit_id",
  "user_id",
  "log_date",
  "status",
  "note",
  "created_at",
  "updated_at",
] as const;

export const HABIT_STATES = [
  "active",
  "automatic",
] as const satisfies readonly HabitState[];

export const HABIT_STATUSES = [
  "active",
  "archived",
  "backlog",
] as const satisfies readonly HabitStatus[];

export const HABIT_LOG_STATUSES = [
  "done",
  "skipped",
  "missed",
] as const satisfies readonly LogStatus[];

export const HABIT_LOG_STATUS_LABELS: Record<LogStatus, string> = {
  done: "Done",
  skipped: "Skipped",
  missed: "Missed",
};

// Product rules — documented here so tests can assert against them.
export const FORGIVING_STREAK_RULES = {
  doneIncrements: true,
  skippedIsNeutral: true,
  toleratesIsolatedMiss: true,
  breaksOnConsecutiveMisses: true,
  skippedRemovedBeforeMissEvaluation: true,
} as const;

export const RETRO_LOG_WINDOW_HOURS = 48 as const;

export const ACTIVE_HABITS_PER_GOAL_SOFT_CAP = 3 as const;

export const LOGICAL_DAY_FORMAT = "YYYY-MM-DD";
export const LOGICAL_DAY_SOURCE = "device_local_day" as const;
