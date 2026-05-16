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

export async function getLatestWeeklyReviewsForHabits(
  userId: string,
  habitIds: string[],
): Promise<Map<string, WeeklyReviewRecord | null>> {
  const result = new Map<string, WeeklyReviewRecord | null>();
  if (habitIds.length === 0) return result;
  const db = getDb();
  const placeholders = habitIds.map(() => "?").join(",");
  const rows = await db.getAllAsync<RawRow>(
    `SELECT * FROM local_weekly_reviews
     WHERE user_id = ? AND habit_id IN (${placeholders})
     ORDER BY habit_id, week_start DESC`,
    userId,
    ...habitIds,
  );
  for (const id of habitIds) result.set(id, null);
  for (const row of rows) {
    if (result.get(row.habit_id)) continue;
    result.set(row.habit_id, fromRow(row));
  }
  return result;
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

async function upsertWeeklyReviewRow(
  input: UpsertWeeklyReviewInput,
  now: string,
): Promise<void> {
  const db = getDb();
  const habit = await db.getFirstAsync<{ id: string }>(
    "SELECT id FROM local_habits WHERE id = ? AND user_id = ?",
    input.habitId,
    input.userId,
  );

  if (!habit) {
    throw new Error(`Habit not found: ${input.habitId}`);
  }

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
    crypto.randomUUID(),
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
}

export async function upsertWeeklyReview(
  input: UpsertWeeklyReviewInput,
): Promise<WeeklyReviewRecord> {
  const now = new Date().toISOString();
  await upsertWeeklyReviewRow(input, now);
  return (await getWeeklyReviewForWeek(input.userId, input.habitId, input.weekStart))!;
}

/**
 * Atomically upserts a batch of weekly review rows in a single transaction.
 * If any row fails the entire batch rolls back, so a goal-level review either
 * fully saves or leaves no partial state behind.
 */
export async function upsertWeeklyReviewsBatch(
  inputs: UpsertWeeklyReviewInput[],
): Promise<WeeklyReviewRecord[]> {
  if (inputs.length === 0) return [];
  const db = getDb();
  const now = new Date().toISOString();
  await db.withTransactionAsync(async () => {
    for (const input of inputs) {
      await upsertWeeklyReviewRow(input, now);
    }
  });
  const saved: WeeklyReviewRecord[] = [];
  for (const input of inputs) {
    const row = await getWeeklyReviewForWeek(
      input.userId,
      input.habitId,
      input.weekStart,
    );
    if (row) saved.push(row);
  }
  return saved;
}
