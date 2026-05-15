import { getDb } from "@/lib/db/client";
import { GRADUATION_PASSING_SCORE } from "@/lib/graduation/constants";
import {
  getHabit,
  type Habit,
  type HabitState,
  updateHabit,
} from "@/lib/db/repositories/habits";
import {
  createSRHIResponse,
  type CreateSRHIInput,
  type SRHIResponse,
} from "@/lib/db/repositories/srhi_responses";

export type GraduationOutcome = {
  averageScore: number;
  graduated: boolean;
  message: string;
};

const PASSING_MESSAGES = [
  "This habit has become part of who you are.",
  "What once took effort now happens naturally.",
  "You've done the work. This one is yours now.",
];

const FAILING_MESSAGES = [
  "Not automatic yet. That's useful information — we'll keep supporting this habit.",
  "Still forming. Give it more time — consistency is doing the work.",
  "Not quite there. The fact that you checked shows you care about doing this right.",
];

function pick(pool: string[], seed: number): string {
  const index = ((seed % pool.length) + pool.length) % pool.length;
  return pool[index];
}

export function scoreGraduation(scores: {
  q1: number;
  q2: number;
  q3: number;
}): GraduationOutcome {
  const averageScore =
    Math.round(((scores.q1 + scores.q2 + scores.q3) / 3) * 100) / 100;
  const graduated = averageScore >= GRADUATION_PASSING_SCORE;
  const seed = Math.round(averageScore * 100);
  const message = graduated
    ? pick(PASSING_MESSAGES, seed)
    : pick(FAILING_MESSAGES, seed);
  return { averageScore, graduated, message };
}

// Idempotent: a habit that is already 'automatic' is returned unchanged
// so the original automated_at timestamp is preserved across duplicate
// submissions, retries, or accidental second invocations.
export async function graduateHabit(habitId: string): Promise<Habit> {
  const existing = await getHabit(habitId);
  if (!existing) throw new Error(`Habit not found: ${habitId}`);
  if (existing.habit_state === "automatic") return existing;
  return updateHabit(habitId, {
    habit_state: "automatic",
    automated_at: new Date().toISOString(),
  });
}

export function isGoalGraduated(
  habits: { habit_state: HabitState }[],
): boolean {
  if (habits.length === 0) return false;
  return habits.every((h) => h.habit_state === "automatic");
}

// The SRHI insert and the habit transition are wrapped in a single
// transaction. Without this, a graduateHabit failure after a passing
// SRHI would leave the database in a contradictory state: the latest
// SRHI says the habit passed, but the habit is still non-automatic —
// and eligibility would re-trigger the ceremony, because the only
// block on a passing SRHI runs through habit_state='automatic'.
export async function recordAndProcessGraduation(
  input: CreateSRHIInput,
): Promise<{ response: SRHIResponse; habit: Habit | null }> {
  const db = getDb();
  let response!: SRHIResponse;
  let habit: Habit | null = null;

  await db.withTransactionAsync(async () => {
    response = await createSRHIResponse(input);
    if (response.graduated) {
      habit = await graduateHabit(input.habit_id);
    }
  });

  return { response, habit };
}
