import {
  activateBacklogHabitRow,
  archiveHabit as archiveHabitRow,
  createHabit as createHabitRow,
  deleteGoal as deleteGoalRow,
  deleteHabit as deleteHabitRow,
  getHabit,
  listHabits,
  reactivateHabitRow,
  updateHabit as updateHabitRow,
} from "@/lib/db/repositories/habits";
import { ALL_DAYS, parseActiveDays, serializeActiveDays } from "@/features/habits/activeDays";

import { deleteLogByHabitAndDate, listLogs, listLogsByUser, upsertLog } from "@/lib/db/repositories/habit_logs";
import { RETRO_LOG_WINDOW_HOURS } from "@/features/habits/contract";
import {
  cancelReminder,
  materializePendingReminder,
} from "@/features/reminders/notifications";
import { now, todayDateString } from "@/utils/clock";
import { logger } from "@/services/logger";

import type {
  CreateHabitInput,
  CreateHabitPayload,
  Habit,
  HabitLog,
  HabitSetupPayload,
  UpdateHabitPatch,
  UpsertHabitLogPayload,
} from "@/features/habits/types";

// ─── Typed errors ─────────────────────────────────────────────────────────────

export type RetroLogReason =
  | "outside_window"
  | "future_date"
  | "before_start_date"
  | "habit_archived";

export class RetroLogError extends Error {
  reason: RetroLogReason;
  constructor(reason: RetroLogReason) {
    super(`Retro log rejected: ${reason}`);
    this.reason = reason;
  }
}

// ─── Helpers ─────────────────────────────────────────────────────────────────

export function isWithinRetroWindow(logDate: string, currentTime: Date): boolean {
  const [y, m, d] = logDate.split("-").map(Number) as [number, number, number];
  const endOfLogDay = new Date(y, m - 1, d, 23, 59, 59, 999);
  const windowEnds = new Date(
    endOfLogDay.getTime() + RETRO_LOG_WINDOW_HOURS * 60 * 60 * 1000,
  );
  return currentTime <= windowEnds;
}

// ─── Habit listings ───────────────────────────────────────────────────────────

export async function listActiveHabits(userId: string): Promise<Habit[]> {
  return listHabits({ user_id: userId, status: "active" });
}

export async function listEligibleHabitsForToday(
  userId: string,
  todayDate: string,
): Promise<Habit[]> {
  const all = await listHabits({ user_id: userId, status: "active" });
  return all.filter((h) => h.start_date <= todayDate);
}

export async function listUpcomingHabits(
  userId: string,
  todayDate: string,
): Promise<Habit[]> {
  const all = await listHabits({ user_id: userId, status: "active" });
  return all
    .filter((h) => h.start_date > todayDate)
    .sort((a, b) => {
      if (a.start_date !== b.start_date) {
        return a.start_date < b.start_date ? -1 : 1;
      }
      return a.created_at < b.created_at ? -1 : 1;
    });
}

export async function listArchivedHabits(userId: string): Promise<Habit[]> {
  return listHabits({ user_id: userId, status: "archived" });
}

export async function listBacklogHabits(userId: string): Promise<Habit[]> {
  return listHabits({ user_id: userId, status: "backlog" });
}

// ─── Habit CRUD ───────────────────────────────────────────────────────────────

export async function getHabitById(
  userId: string,
  habitId: string,
): Promise<Habit> {
  const habit = await getHabit(habitId);
  if (!habit || habit.user_id !== userId) {
    throw new Error(`Habit not found: ${habitId}`);
  }
  return habit;
}

export async function createHabit(
  userId: string,
  payload: CreateHabitPayload,
): Promise<Habit> {
  const status = payload.status ?? "active";
  const input: CreateHabitInput = {
    user_id: userId,
    title: payload.title.trim(),
    identity_phrase: payload.identityPhrase.trim() || null,
    cue: payload.cue.trim(),
    tiny_action: payload.tinyAction.trim(),
    minimum_viable_action: payload.minimumViableAction.trim() || null,
    preferred_time_window: payload.preferredTimeWindow.trim() || null,
    icon: payload.icon?.trim() || null,
    active_days: serializeActiveDays(payload.activeDays ?? ALL_DAYS),
    start_date: todayDateString(),
    habit_state: payload.habitState,
    status,
    backlog_at: status === "backlog" ? now().toISOString() : null,
  };
  return createHabitRow(input);
}

export async function updateHabit(
  userId: string,
  habitId: string,
  payload: HabitSetupPayload,
): Promise<Habit> {
  await getHabitById(userId, habitId);

  const patch: UpdateHabitPatch = {
    title: payload.title.trim(),
    identity_phrase: payload.identityPhrase.trim() || null,
    cue: payload.cue.trim(),
    tiny_action: payload.tinyAction.trim(),
    minimum_viable_action: payload.minimumViableAction.trim() || null,
    preferred_time_window: payload.preferredTimeWindow.trim() || null,
    icon: payload.icon?.trim() || null,
    active_days: serializeActiveDays(payload.activeDays ?? ALL_DAYS),
  };
  return updateHabitRow(habitId, patch);
}

export async function archiveHabit(
  userId: string,
  habitId: string,
): Promise<void> {
  await getHabitById(userId, habitId);
  await archiveHabitRow(habitId);
}

export async function reactivateHabit(
  userId: string,
  habitId: string,
): Promise<Habit> {
  await getHabitById(userId, habitId);
  return reactivateHabitRow(habitId, todayDateString());
}

export async function activateBacklogHabit(
  userId: string,
  habitId: string,
): Promise<Habit> {
  await getHabitById(userId, habitId);
  const updated = await activateBacklogHabitRow(habitId, todayDateString());
  // Best-effort: materialize any persisted reminder intent now that the habit
  // is active. Never blocks activation on notification permission state.
  await materializePendingReminder(
    habitId,
    userId,
    parseActiveDays(updated.active_days),
  );
  return updated;
}

export async function deleteHabit(
  userId: string,
  habitId: string,
): Promise<void> {
  await getHabitById(userId, habitId);
  // Cancel any OS-scheduled notifications BEFORE the row is deleted — the DB
  // row cascades via FK but expo-notifications schedule entries live in the OS
  // and would keep firing for an absent habit otherwise.
  await cancelReminder(habitId).catch(() => {});
  await deleteHabitRow(habitId);
}

export async function deleteGoal(
  userId: string,
  identityPhrase: string,
): Promise<{ deletedHabitCount: number; deletedHabitIds: string[] }> {
  // listHabits with identity_phrase returns every row regardless of
  // habit_state ("active" | "automatic") or status ("active" | "archived" |
  // "backlog"). The cascade-delete fires on the DB layer; this layer's job
  // is to clean up OS-level reminder schedules for each habit first.
  const habits = await listGoalHabits(userId, identityPhrase);
  if (habits.length === 0) {
    return { deletedHabitCount: 0, deletedHabitIds: [] };
  }

  await Promise.all(habits.map((h) => cancelReminder(h.id).catch(() => {})));

  const deletedHabitIds = habits.map((h) => h.id);
  const result = await deleteGoalRow(userId, identityPhrase);
  // The hook needs the IDs to drop per-habit caches; the count comes from
  // the repo so we don't drift from what actually got deleted.
  return { deletedHabitCount: result.deletedHabitCount, deletedHabitIds };
}

export async function listGoalHabits(
  userId: string,
  identityPhrase: string,
): Promise<Habit[]> {
  // All habits under a goal, regardless of habit_state or status. Useful for
  // delete-goal flows that need a true count and for cancelling reminders on
  // archived/backlog rows the UI never displays.
  return listHabits({ user_id: userId, identity_phrase: identityPhrase });
}

// ─── Log reads ────────────────────────────────────────────────────────────────

export async function getHabitLogsForHabitInRange(
  userId: string,
  habitId: string,
  startDate: string,
  endDate: string,
): Promise<HabitLog[]> {
  await getHabitById(userId, habitId);
  return listLogs({ habit_id: habitId, from_date: startDate, to_date: endDate });
}

export async function getHabitLogsInRange(
  userId: string,
  startDate: string,
  endDate: string,
): Promise<HabitLog[]> {
  return listLogsByUser({ user_id: userId, from_date: startDate, to_date: endDate });
}

// ─── Log upsert with 48-hour retro window ─────────────────────────────────────

export async function upsertHabitLog(
  userId: string,
  payload: UpsertHabitLogPayload,
): Promise<HabitLog> {
  const habit = await getHabitById(userId, payload.habitId);

  if (habit.status !== "active") {
    logger.warn("Rejected habit log for archived habit", {
      habitId: payload.habitId,
      logDate: payload.logDate,
      status: payload.status,
      userId,
    });
    throw new RetroLogError("habit_archived");
  }

  if (payload.logDate < habit.start_date) {
    logger.warn("Rejected habit log before habit start_date", {
      habitId: payload.habitId,
      logDate: payload.logDate,
      startDate: habit.start_date,
      userId,
    });
    throw new RetroLogError("before_start_date");
  }

  if (payload.logDate > todayDateString()) {
    logger.warn("Rejected habit log for future date", {
      habitId: payload.habitId,
      logDate: payload.logDate,
      userId,
    });
    throw new RetroLogError("future_date");
  }

  if (!isWithinRetroWindow(payload.logDate, now())) {
    logger.warn("Rejected habit log outside 48-hour retro window", {
      habitId: payload.habitId,
      logDate: payload.logDate,
      userId,
    });
    throw new RetroLogError("outside_window");
  }

  return upsertLog({
    habit_id: payload.habitId,
    user_id: userId,
    log_date: payload.logDate,
    status: payload.status,
    note: payload.note ?? null,
  });
}

export async function deleteHabitLog(
  userId: string,
  habitId: string,
  logDate: string,
): Promise<boolean> {
  return deleteLogByHabitAndDate(habitId, userId, logDate);
}
