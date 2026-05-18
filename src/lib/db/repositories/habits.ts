import type { SQLiteBindValue } from "expo-sqlite";

import { getDb } from "@/lib/db/client";

export type HabitState = "active" | "automatic";
export type HabitStatus = "active" | "archived" | "backlog";

export type Habit = {
  id: string;
  user_id: string;
  title: string;
  identity_phrase: string | null;
  cue: string;
  tiny_action: string;
  minimum_viable_action: string | null;
  preferred_time_window: string | null;
  icon: string | null;
  habit_state: HabitState;
  status: HabitStatus;
  active_days: string;
  start_date: string;
  created_at: string;
  updated_at: string;
  archived_at: string | null;
  automated_at: string | null;
  backlog_at: string | null;
};

export type CreateHabitInput = Omit<
  Habit,
  | "id"
  | "created_at"
  | "updated_at"
  | "archived_at"
  | "automated_at"
  | "backlog_at"
  | "habit_state"
  | "status"
  | "icon"
  | "active_days"
> & {
  habit_state?: HabitState;
  status?: HabitStatus;
  icon?: string | null;
  active_days?: string;
  backlog_at?: string | null;
};

export type UpdateHabitPatch = Partial<
  Pick<
    Habit,
    | "title"
    | "identity_phrase"
    | "cue"
    | "tiny_action"
    | "minimum_viable_action"
    | "preferred_time_window"
    | "icon"
    | "habit_state"
    | "status"
    | "active_days"
    | "automated_at"
    | "backlog_at"
  >
>;

export type HabitFilter = {
  user_id: string;
  habit_state?: HabitState | HabitState[];
  status?: HabitStatus | HabitStatus[];
  identity_phrase?: string;
};

export async function createHabit(input: CreateHabitInput): Promise<Habit> {
  const db = getDb();
  const now = new Date().toISOString();
  const id = crypto.randomUUID();

  await db.runAsync(
    `INSERT INTO local_habits (
      id, user_id, title, identity_phrase, cue, tiny_action,
      minimum_viable_action, preferred_time_window, icon, habit_state, status,
      active_days, start_date, created_at, updated_at, archived_at, automated_at, backlog_at
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, NULL, NULL, ?)`,
    id,
    input.user_id,
    input.title,
    input.identity_phrase ?? null,
    input.cue,
    input.tiny_action,
    input.minimum_viable_action ?? null,
    input.preferred_time_window ?? null,
    input.icon ?? null,
    input.habit_state ?? "active",
    input.status ?? "active",
    input.active_days ?? "[1,2,3,4,5,6,7]",
    input.start_date,
    now,
    now,
    input.backlog_at ?? null,
  );

  return (await getHabit(id))!;
}

export async function updateHabit(
  id: string,
  patch: UpdateHabitPatch,
): Promise<Habit> {
  const db = getDb();
  const now = new Date().toISOString();

  const sets: string[] = [];
  const params: SQLiteBindValue[] = [];

  const allowed: (keyof UpdateHabitPatch)[] = [
    "title",
    "identity_phrase",
    "cue",
    "tiny_action",
    "minimum_viable_action",
    "preferred_time_window",
    "icon",
    "habit_state",
    "status",
    "active_days",
    "automated_at",
    "backlog_at",
  ];

  for (const key of allowed) {
    if (patch[key] !== undefined) {
      sets.push(`${key} = ?`);
      params.push(patch[key] ?? null);
    }
  }

  sets.push("updated_at = ?");
  params.push(now, id);

  const result = await db.runAsync(
    `UPDATE local_habits SET ${sets.join(", ")} WHERE id = ?`,
    ...params,
  );

  if (result.changes === 0) {
    throw new Error(`Habit not found: ${id}`);
  }

  return (await getHabit(id))!;
}

export async function reactivateHabitRow(
  id: string,
  todayDate: string,
): Promise<Habit> {
  const db = getDb();
  const now = new Date().toISOString();

  const existing = await getHabit(id);
  if (!existing) throw new Error(`Habit not found: ${id}`);
  if (existing.habit_state !== "automatic") {
    throw new Error(`Habit ${id} is not graduated — cannot reactivate`);
  }
  if (existing.status !== "active") {
    // Defensive: an archived-and-graduated habit flipping habit_state to
    // "active" without touching status would stay invisible from Today. Refuse
    // until the caller restores status explicitly.
    throw new Error(
      `Habit ${id} is not active (status=${existing.status}) — cannot reactivate`,
    );
  }

  await db.runAsync(
    `UPDATE local_habits
       SET habit_state = 'active',
           automated_at = NULL,
           start_date = ?,
           updated_at = ?
     WHERE id = ?`,
    todayDate,
    now,
    id,
  );

  return (await getHabit(id))!;
}

export async function activateBacklogHabitRow(
  id: string,
  todayDate: string,
): Promise<Habit> {
  const db = getDb();
  const now = new Date().toISOString();

  const result = await db.runAsync(
    `UPDATE local_habits
       SET status = 'active',
           backlog_at = NULL,
           start_date = ?,
           updated_at = ?
     WHERE id = ? AND status = 'backlog'`,
    todayDate,
    now,
    id,
  );

  if (result.changes === 0) {
    const existing = await getHabit(id);
    if (!existing) throw new Error(`Habit not found: ${id}`);
    throw new Error(`Habit ${id} is not in backlog — cannot activate`);
  }

  return (await getHabit(id))!;
}

export async function archiveHabit(id: string): Promise<void> {
  const db = getDb();
  const now = new Date().toISOString();

  const result = await db.runAsync(
    `UPDATE local_habits
       SET status = 'archived', archived_at = ?, updated_at = ?
     WHERE id = ? AND status != 'archived'`,
    now,
    now,
    id,
  );

  if (result.changes === 0) {
    const existing = await getHabit(id);
    if (!existing) throw new Error(`Habit not found: ${id}`);
    // Already archived — no-op.
  }
}

export async function getHabit(id: string): Promise<Habit | null> {
  const db = getDb();
  return db.getFirstAsync<Habit>(
    "SELECT * FROM local_habits WHERE id = ?",
    id,
  );
}

export async function listHabits(filter: HabitFilter): Promise<Habit[]> {
  const db = getDb();

  const conditions: string[] = ["user_id = ?"];
  const params: SQLiteBindValue[] = [filter.user_id];

  if (filter.habit_state !== undefined) {
    const states = Array.isArray(filter.habit_state)
      ? filter.habit_state
      : [filter.habit_state];
    conditions.push(`habit_state IN (${states.map(() => "?").join(",")})`);
    params.push(...states);
  }

  if (filter.status !== undefined) {
    const statuses = Array.isArray(filter.status)
      ? filter.status
      : [filter.status];
    conditions.push(`status IN (${statuses.map(() => "?").join(",")})`);
    params.push(...statuses);
  }

  if (filter.identity_phrase !== undefined) {
    conditions.push("identity_phrase = ?");
    params.push(filter.identity_phrase);
  }

  return db.getAllAsync<Habit>(
    `SELECT * FROM local_habits WHERE ${conditions.join(" AND ")} ORDER BY created_at DESC`,
    ...params,
  );
}

export async function deleteHabit(id: string): Promise<boolean> {
  const db = getDb();
  const result = await db.runAsync("DELETE FROM local_habits WHERE id = ?", id);
  return result.changes > 0;
}

// ─── Goal-level archive / restore ─────────────────────────────────────────────
//
// "Goals" are derived state — a set of local_habits rows sharing an
// identity_phrase. Archive/restore cascade across every active or backlog
// habit in the goal.
//
// The cascade preserves backlog_at as a marker: a habit's pre-archive state
// is "ex-active" iff backlog_at IS NULL at archive time, and "ex-backlog"
// iff backlog_at IS NOT NULL. Restore uses this to revive each habit with
// the correct lifecycle semantics (ex-backlog rows get start_date=today,
// mirroring activateBacklogHabitRow; ex-active rows keep their original
// start_date so streak/log accounting stays correct).

export async function archiveGoal(
  userId: string,
  identityPhrase: string,
): Promise<{ cascadedHabitCount: number }> {
  const db = getDb();
  const now = new Date().toISOString();

  let cascadedHabitCount = 0;
  await db.withTransactionAsync(async () => {
    const result = await db.runAsync(
      `UPDATE local_habits
         SET status = 'archived', archived_at = ?, updated_at = ?
       WHERE user_id = ?
         AND identity_phrase = ?
         AND status IN ('active', 'backlog')`,
      now,
      now,
      userId,
      identityPhrase,
    );
    cascadedHabitCount = result.changes;
  });

  return { cascadedHabitCount };
}

export async function restoreGoal(
  userId: string,
  identityPhrase: string,
  todayDate: string,
): Promise<{ restoredExActive: Habit[]; restoredExBacklog: Habit[] }> {
  const db = getDb();
  const now = new Date().toISOString();

  // Pre-capture target IDs BEFORE the UPDATEs run. Branch 2 nulls backlog_at,
  // so any post-update selector keyed on backlog_at IS NULL/NOT NULL cannot
  // distinguish ex-active from ex-backlog rows afterward. Pre-capturing keeps
  // both groups individually addressable for re-fetch.
  let exActiveRows: Habit[] = [];
  let exBacklogRows: Habit[] = [];

  await db.withTransactionAsync(async () => {
    const exActiveIds = (
      await db.getAllAsync<{ id: string }>(
        `SELECT id FROM local_habits
         WHERE user_id = ? AND identity_phrase = ?
           AND status = 'archived' AND backlog_at IS NULL`,
        userId,
        identityPhrase,
      )
    ).map((r) => r.id);

    const exBacklogIds = (
      await db.getAllAsync<{ id: string }>(
        `SELECT id FROM local_habits
         WHERE user_id = ? AND identity_phrase = ?
           AND status = 'archived' AND backlog_at IS NOT NULL`,
        userId,
        identityPhrase,
      )
    ).map((r) => r.id);

    if (exActiveIds.length > 0) {
      const placeholders = exActiveIds.map(() => "?").join(",");
      await db.runAsync(
        `UPDATE local_habits
           SET status = 'active', archived_at = NULL, updated_at = ?
         WHERE id IN (${placeholders})`,
        now,
        ...exActiveIds,
      );
    }

    if (exBacklogIds.length > 0) {
      const placeholders = exBacklogIds.map(() => "?").join(",");
      // start_date reset matches activateBacklogHabitRow semantics — without
      // it, a previously-backlog habit would revive looking like it had been
      // active since original creation, fabricating "missed" days.
      await db.runAsync(
        `UPDATE local_habits
           SET status = 'active',
               archived_at = NULL,
               backlog_at = NULL,
               start_date = ?,
               updated_at = ?
         WHERE id IN (${placeholders})`,
        todayDate,
        now,
        ...exBacklogIds,
      );
    }

    if (exActiveIds.length > 0) {
      const placeholders = exActiveIds.map(() => "?").join(",");
      exActiveRows = await db.getAllAsync<Habit>(
        `SELECT * FROM local_habits WHERE id IN (${placeholders})`,
        ...exActiveIds,
      );
    }

    if (exBacklogIds.length > 0) {
      const placeholders = exBacklogIds.map(() => "?").join(",");
      exBacklogRows = await db.getAllAsync<Habit>(
        `SELECT * FROM local_habits WHERE id IN (${placeholders})`,
        ...exBacklogIds,
      );
    }
  });

  return { restoredExActive: exActiveRows, restoredExBacklog: exBacklogRows };
}

export async function deleteGoal(
  userId: string,
  identityPhrase: string,
): Promise<{ deletedHabitCount: number }> {
  const db = getDb();

  const habits = await db.getAllAsync<{ id: string }>(
    "SELECT id FROM local_habits WHERE user_id = ? AND identity_phrase = ?",
    userId,
    identityPhrase,
  );

  if (habits.length === 0) return { deletedHabitCount: 0 };

  const ids = habits.map((h) => h.id);
  const placeholders = ids.map(() => "?").join(",");

  let deletedCount = 0;
  await db.withTransactionAsync(async () => {
    const result = await db.runAsync(
      `DELETE FROM local_habits WHERE user_id = ? AND id IN (${placeholders})`,
      userId,
      ...ids,
    );
    deletedCount = result.changes;
  });

  return { deletedHabitCount: deletedCount };
}
