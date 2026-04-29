import type { SQLiteBindValue } from "expo-sqlite";

import { getDb } from "@/lib/db/client";

export type LogStatus = "done" | "skipped" | "missed";

export type HabitLog = {
  id: string;
  habit_id: string;
  user_id: string;
  log_date: string;
  status: LogStatus;
  note: string | null;
  created_at: string;
  updated_at: string;
};

export type UpsertLogInput = {
  habit_id: string;
  user_id: string;
  log_date: string;
  status: LogStatus;
  note?: string | null;
};

export async function upsertLog(input: UpsertLogInput): Promise<HabitLog> {
  const db = getDb();
  const now = new Date().toISOString();
  const id = crypto.randomUUID();

  await db.runAsync(
    `INSERT INTO local_habit_logs (id, habit_id, user_id, log_date, status, note, created_at, updated_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?)
     ON CONFLICT(user_id, habit_id, log_date) DO UPDATE SET
       status = excluded.status,
       note = excluded.note,
       updated_at = excluded.updated_at`,
    id,
    input.habit_id,
    input.user_id,
    input.log_date,
    input.status,
    input.note ?? null,
    now,
    now,
  );

  return (await getLog({
    habit_id: input.habit_id,
    user_id: input.user_id,
    log_date: input.log_date,
  }))!;
}

export async function getLog(args: {
  habit_id: string;
  user_id: string;
  log_date: string;
}): Promise<HabitLog | null> {
  const db = getDb();
  return db.getFirstAsync<HabitLog>(
    `SELECT * FROM local_habit_logs
     WHERE habit_id = ? AND user_id = ? AND log_date = ?`,
    args.habit_id,
    args.user_id,
    args.log_date,
  );
}

export async function listLogs(args: {
  habit_id: string;
  from_date?: string;
  to_date?: string;
  limit?: number;
}): Promise<HabitLog[]> {
  const db = getDb();

  const conditions: string[] = ["habit_id = ?"];
  const params: SQLiteBindValue[] = [args.habit_id];

  if (args.from_date !== undefined) {
    conditions.push("log_date >= ?");
    params.push(args.from_date);
  }

  if (args.to_date !== undefined) {
    conditions.push("log_date <= ?");
    params.push(args.to_date);
  }

  let sql = `SELECT * FROM local_habit_logs WHERE ${conditions.join(" AND ")} ORDER BY log_date DESC`;

  if (args.limit !== undefined) {
    sql += " LIMIT ?";
    params.push(args.limit);
  }

  return db.getAllAsync<HabitLog>(sql, ...params);
}

export async function listLogsByUser(args: {
  user_id: string;
  from_date?: string;
  to_date?: string;
}): Promise<HabitLog[]> {
  const db = getDb();

  const conditions: string[] = ["user_id = ?"];
  const params: SQLiteBindValue[] = [args.user_id];

  if (args.from_date !== undefined) {
    conditions.push("log_date >= ?");
    params.push(args.from_date);
  }

  if (args.to_date !== undefined) {
    conditions.push("log_date <= ?");
    params.push(args.to_date);
  }

  return db.getAllAsync<HabitLog>(
    `SELECT * FROM local_habit_logs WHERE ${conditions.join(" AND ")} ORDER BY log_date DESC`,
    ...params,
  );
}

export async function deleteLog(id: string): Promise<boolean> {
  const db = getDb();
  const result = await db.runAsync("DELETE FROM local_habit_logs WHERE id = ?", id);
  return result.changes > 0;
}
