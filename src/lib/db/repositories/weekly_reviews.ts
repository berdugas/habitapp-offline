import { getDb } from "@/lib/db/client";

export type WeeklyReviewRecord = {
  id: string;
  habit_id: string;
  user_id: string;
  week_start: string;
  went_well: string | null;
  was_hard: string | null;
  adjustment_note: string | null;
  trigger_worked: boolean | null;
  tiny_action_too_hard: boolean | null;
  created_at: string;
  updated_at: string;
};

export type UpsertWeeklyReviewInput = {
  habitId: string;
  userId: string;
  weekStart: string;
  wentWell: string;
  wasHard: string;
  adjustmentNote: string;
  triggerWorked: boolean | null;
  tinyActionTooHard: boolean | null;
};

type RawRow = Omit<
  WeeklyReviewRecord,
  "trigger_worked" | "tiny_action_too_hard"
> & {
  trigger_worked: number | null;
  tiny_action_too_hard: number | null;
};

function fromRow(row: RawRow): WeeklyReviewRecord {
  return {
    ...row,
    trigger_worked: row.trigger_worked === null ? null : row.trigger_worked === 1,
    tiny_action_too_hard:
      row.tiny_action_too_hard === null ? null : row.tiny_action_too_hard === 1,
  };
}

function boolToInt(value: boolean | null): number | null {
  return value === null ? null : value ? 1 : 0;
}

export async function getLatestWeeklyReview(
  userId: string,
  habitId: string,
): Promise<WeeklyReviewRecord | null> {
  const db = getDb();
  const row = await db.getFirstAsync<RawRow>(
    `SELECT * FROM local_weekly_reviews
     WHERE user_id = ? AND habit_id = ?
     ORDER BY week_start DESC
     LIMIT 1`,
    userId,
    habitId,
  );
  return row ? fromRow(row) : null;
}

export async function getWeeklyReviewForWeek(
  userId: string,
  habitId: string,
  weekStart: string,
): Promise<WeeklyReviewRecord | null> {
  const db = getDb();
  const row = await db.getFirstAsync<RawRow>(
    `SELECT * FROM local_weekly_reviews
     WHERE user_id = ? AND habit_id = ? AND week_start = ?`,
    userId,
    habitId,
    weekStart,
  );
  return row ? fromRow(row) : null;
}

export async function upsertWeeklyReview(
  input: UpsertWeeklyReviewInput,
): Promise<WeeklyReviewRecord> {
  const db = getDb();
  const now = new Date().toISOString();
  const id = crypto.randomUUID();

  await db.runAsync(
    `INSERT INTO local_weekly_reviews (
      id, habit_id, user_id, week_start,
      went_well, was_hard, adjustment_note,
      trigger_worked, tiny_action_too_hard,
      created_at, updated_at
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    ON CONFLICT(user_id, habit_id, week_start) DO UPDATE SET
      went_well = excluded.went_well,
      was_hard = excluded.was_hard,
      adjustment_note = excluded.adjustment_note,
      trigger_worked = excluded.trigger_worked,
      tiny_action_too_hard = excluded.tiny_action_too_hard,
      updated_at = excluded.updated_at`,
    id,
    input.habitId,
    input.userId,
    input.weekStart,
    input.wentWell.trim() || null,
    input.wasHard.trim() || null,
    input.adjustmentNote.trim() || null,
    boolToInt(input.triggerWorked),
    boolToInt(input.tinyActionTooHard),
    now,
    now,
  );

  return (await getWeeklyReviewForWeek(input.userId, input.habitId, input.weekStart))!;
}
