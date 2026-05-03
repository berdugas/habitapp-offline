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
> & {
  habit_state?: HabitState;
  status?: HabitStatus;
  icon?: string | null;
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
    | "automated_at"
    | "backlog_at"
  >
>;

export type HabitFilter = {
  user_id: string;
  habit_state?: HabitState | HabitState[];
  status?: HabitStatus | HabitStatus[];
};

export async function createHabit(input: CreateHabitInput): Promise<Habit> {
  const db = getDb();
  const now = new Date().toISOString();
  const id = crypto.randomUUID();

  await db.runAsync(
    `INSERT INTO local_habits (
      id, user_id, title, identity_phrase, cue, tiny_action,
      minimum_viable_action, preferred_time_window, icon, habit_state, status,
      start_date, created_at, updated_at, archived_at, automated_at, backlog_at
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, NULL, NULL, NULL)`,
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
    input.start_date,
    now,
    now,
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
