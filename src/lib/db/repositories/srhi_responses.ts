import { getDb } from "@/lib/db/client";
import { GRADUATION_PASSING_SCORE } from "@/lib/graduation/constants";

export type SRHIResponse = {
  id: string;
  habit_id: string;
  user_id: string;
  q1_score: number;
  q2_score: number;
  q3_score: number;
  average_score: number;
  graduated: boolean;
  created_at: string;
};

export type CreateSRHIInput = {
  habit_id: string;
  user_id: string;
  q1_score: number;
  q2_score: number;
  q3_score: number;
};

type SRHIRow = Omit<SRHIResponse, "graduated"> & { graduated: number };

function mapRow(row: SRHIRow): SRHIResponse {
  return { ...row, graduated: row.graduated === 1 };
}

function roundAverage(q1: number, q2: number, q3: number): number {
  return Math.round(((q1 + q2 + q3) / 3) * 100) / 100;
}

export async function createSRHIResponse(
  input: CreateSRHIInput,
): Promise<SRHIResponse> {
  const db = getDb();
  const id = crypto.randomUUID();
  const created_at = new Date().toISOString();
  const average_score = roundAverage(
    input.q1_score,
    input.q2_score,
    input.q3_score,
  );
  const graduated = average_score >= GRADUATION_PASSING_SCORE ? 1 : 0;

  await db.runAsync(
    `INSERT INTO local_srhi_responses (
      id, habit_id, user_id, q1_score, q2_score, q3_score,
      average_score, graduated, created_at
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    id,
    input.habit_id,
    input.user_id,
    input.q1_score,
    input.q2_score,
    input.q3_score,
    average_score,
    graduated,
    created_at,
  );

  return {
    id,
    habit_id: input.habit_id,
    user_id: input.user_id,
    q1_score: input.q1_score,
    q2_score: input.q2_score,
    q3_score: input.q3_score,
    average_score,
    graduated: graduated === 1,
    created_at,
  };
}

export async function getSRHIResponsesForHabit(
  habitId: string,
): Promise<SRHIResponse[]> {
  const db = getDb();
  const rows = await db.getAllAsync<SRHIRow>(
    `SELECT * FROM local_srhi_responses
       WHERE habit_id = ?
       ORDER BY created_at DESC`,
    habitId,
  );
  return rows.map(mapRow);
}

export async function getLatestSRHIResponse(
  habitId: string,
): Promise<SRHIResponse | null> {
  const db = getDb();
  const row = await db.getFirstAsync<SRHIRow>(
    `SELECT * FROM local_srhi_responses
       WHERE habit_id = ?
       ORDER BY created_at DESC
       LIMIT 1`,
    habitId,
  );
  return row ? mapRow(row) : null;
}

export async function getSRHIResponsesForUser(
  userId: string,
): Promise<SRHIResponse[]> {
  const db = getDb();
  const rows = await db.getAllAsync<SRHIRow>(
    `SELECT * FROM local_srhi_responses
       WHERE user_id = ?
       ORDER BY created_at DESC`,
    userId,
  );
  return rows.map(mapRow);
}
