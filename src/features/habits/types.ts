import type {
  CreateHabitInput,
  Habit,
  HabitState,
  HabitStatus,
  UpdateHabitPatch,
} from "@/lib/db/repositories/habits";
import type { HabitLog, LogStatus, UpsertLogInput } from "@/lib/db/repositories/habit_logs";

export type {
  Habit,
  HabitState,
  HabitStatus,
  CreateHabitInput,
  UpdateHabitPatch,
  HabitLog,
  LogStatus,
  UpsertLogInput,
};

// Back-compat aliases. Migrated away from in DEV-S2-06.
export type HabitRecord = Habit;
export type HabitLogRecord = HabitLog;
export type HabitLogStatus = LogStatus;

// Form-layer shape (camelCase). Used by CreateHabitFlow / EditHabitScreen.
export type HabitSetupPayload = {
  identityPhrase: string;
  title: string;
  cue: string;
  tinyAction: string;
  minimumViableAction: string;
  preferredTimeWindow: string;
  icon: string;
  activeDays?: number[];
};

export type CreateHabitPayload = HabitSetupPayload & {
  habitState: HabitState;
};

export type UpsertHabitLogPayload = {
  habitId: string;
  logDate: string;
  note?: string | null;
  status: LogStatus;
};
