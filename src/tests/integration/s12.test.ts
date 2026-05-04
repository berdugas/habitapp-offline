import type { SQLiteDatabase } from "expo-sqlite";

import { getDb } from "@/lib/db/client";
import { createTestDb } from "@/tests/setup/createTestDb";

jest.mock("@/features/reminders/notifications", () => ({
  cancelReminder: jest.fn().mockResolvedValue(undefined),
  rescheduleAll: jest.fn().mockResolvedValue(undefined),
  scheduleReminder: jest.fn().mockResolvedValue(undefined),
}));
import { resetClockForTesting, setNowForTesting } from "@/utils/clock";
import {
  createHabit,
  getHabitById,
  updateHabit,
} from "@/features/habits/api";
import { assertCanCreateActiveHabit, validateHabitSetupPayload } from "@/features/habits/validators";
import { createHabit as repoCreateHabit } from "@/lib/db/repositories/habits";

jest.mock("@/lib/db/client");
const mockGetDb = getDb as jest.Mock;

const FIXED_NOW = new Date("2026-05-04T12:00:00");
const USER = "user-1";

describe("S12 — icon wiring + cap check", () => {
  let db: SQLiteDatabase;

  beforeEach(async () => {
    db = await createTestDb();
    mockGetDb.mockReturnValue(db);
    setNowForTesting(FIXED_NOW);
  });

  afterEach(async () => {
    resetClockForTesting();
    await db.closeAsync();
  });

  // ─── Helper ─────────────────────────────────────────────────────────────────

  async function seedHabit(userId: string, identityPhrase: string) {
    return repoCreateHabit({
      user_id: userId,
      title: "Seed habit",
      identity_phrase: identityPhrase,
      cue: "Morning",
      tiny_action: "Do it",
      minimum_viable_action: null,
      preferred_time_window: null,
      start_date: "2026-05-04",
      habit_state: "active",
      status: "active",
    });
  }

  const BASE_PAYLOAD = {
    identityPhrase: "a runner",
    title: "Run",
    cue: "After coffee",
    tinyAction: "Put on shoes",
    minimumViableAction: "",
    preferredTimeWindow: "",
    icon: "",
    habitState: "active" as const,
  };

  // ─── 1. Cap check: 3 habits → soft_cap_warning ───────────────────────────────

  it("assertCanCreateActiveHabit returns soft_cap_warning when 3 active habits exist for the goal", async () => {
    await seedHabit(USER, "a runner");
    await seedHabit(USER, "a runner");
    await seedHabit(USER, "a runner");

    const result = await assertCanCreateActiveHabit(USER, "a runner");

    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.reason).toBe("soft_cap_warning");
      expect(result.count).toBe(3);
    }
  });

  // ─── 2. Cap check: 2 habits → ok ─────────────────────────────────────────────

  it("assertCanCreateActiveHabit returns ok when fewer than 3 active habits exist for the goal", async () => {
    await seedHabit(USER, "a runner");
    await seedHabit(USER, "a runner");

    const result = await assertCanCreateActiveHabit(USER, "a runner");

    expect(result.ok).toBe(true);
  });

  // ─── 3. Icon round-trip ───────────────────────────────────────────────────────

  it("icon persists through create and read-back", async () => {
    const created = await createHabit(USER, { ...BASE_PAYLOAD, icon: "BookOpen" });

    expect(created.icon).toBe("BookOpen");

    const fetched = await getHabitById(USER, created.id);
    expect(fetched.icon).toBe("BookOpen");
  });

  // ─── 4. Icon update ───────────────────────────────────────────────────────────

  it("icon updates correctly from BookOpen to Brain", async () => {
    const created = await createHabit(USER, { ...BASE_PAYLOAD, icon: "BookOpen" });

    const updated = await updateHabit(USER, created.id, {
      title: "Run",
      identityPhrase: "a runner",
      cue: "After coffee",
      tinyAction: "Put on shoes",
      minimumViableAction: "",
      preferredTimeWindow: "",
      icon: "Brain",
    });

    expect(updated.icon).toBe("Brain");
  });

  // ─── 5. Validator: icon length guard ─────────────────────────────────────────

  it("validateHabitSetupPayload errors when icon exceeds 60 characters", () => {
    const errors = validateHabitSetupPayload({
      title: "Run",
      identityPhrase: "",
      cue: "After coffee",
      tinyAction: "Put on shoes",
      minimumViableAction: "",
      preferredTimeWindow: "",
      icon: "a".repeat(61),
    });

    expect(errors.icon).toMatch(/60/);
  });
});
