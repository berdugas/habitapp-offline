import type { SQLiteDatabase } from "expo-sqlite";

import { getDb } from "@/lib/db/client";
import { createTestDb } from "@/tests/setup/createTestDb";
import {
  assertCanCreateActiveHabit,
  validateCreateHabitPayload,
} from "@/features/habits/validators";
import { createHabit as repoCreateHabit } from "@/lib/db/repositories/habits";

jest.mock("@/lib/db/client");
const mockGetDb = getDb as jest.Mock;

// ─── Field validation (sync) ─────────────────────────────────────────────────

describe("validateCreateHabitPayload — field validation", () => {
  const valid = {
    title: "Meditate",
    identityPhrase: "",
    cue: "After coffee",
    tinyAction: "2 minutes of breathing",
    minimumViableAction: "",
    preferredTimeWindow: "",
    icon: "",
  };

  it("errors on blank required fields: title, cue, tinyAction", () => {
    const errors = validateCreateHabitPayload({
      title: "   ",
      identityPhrase: "",
      cue: "   ",
      tinyAction: "   ",
      minimumViableAction: "",
      preferredTimeWindow: "",
      icon: "",
    });
    expect(errors).toHaveProperty("title");
    expect(errors).toHaveProperty("cue");
    expect(errors).toHaveProperty("tinyAction");
  });

  it("returns no errors when all required fields are valid and optional fields are blank", () => {
    expect(validateCreateHabitPayload(valid)).toEqual({});
  });

  it("errors when title exceeds 120 characters", () => {
    const errors = validateCreateHabitPayload({ ...valid, title: "a".repeat(121) });
    expect(errors.title).toMatch(/120/);
  });

  it("errors when cue exceeds 240 characters", () => {
    const errors = validateCreateHabitPayload({ ...valid, cue: "b".repeat(241) });
    expect(errors.cue).toMatch(/240/);
  });

  it("errors when tinyAction exceeds 240 characters", () => {
    const errors = validateCreateHabitPayload({ ...valid, tinyAction: "c".repeat(241) });
    expect(errors.tinyAction).toMatch(/240/);
  });

  it("errors when minimumViableAction exceeds 240 characters (if non-blank)", () => {
    const errors = validateCreateHabitPayload({
      ...valid,
      minimumViableAction: "d".repeat(241),
    });
    expect(errors.minimumViableAction).toMatch(/240/);
  });

  it("does not error on blank minimumViableAction", () => {
    expect(validateCreateHabitPayload({ ...valid, minimumViableAction: "" })).toEqual({});
  });

  it("errors when identityPhrase exceeds 240 characters (if non-blank)", () => {
    const errors = validateCreateHabitPayload({
      ...valid,
      identityPhrase: "e".repeat(241),
    });
    expect(errors.identityPhrase).toMatch(/240/);
  });

  it("does not error on blank identityPhrase", () => {
    expect(validateCreateHabitPayload({ ...valid, identityPhrase: "" })).toEqual({});
  });

  it("errors when preferredTimeWindow exceeds 80 characters (if non-blank)", () => {
    const errors = validateCreateHabitPayload({
      ...valid,
      preferredTimeWindow: "f".repeat(81),
    });
    expect(errors.preferredTimeWindow).toMatch(/80/);
  });

  it("does not error on blank preferredTimeWindow", () => {
    expect(validateCreateHabitPayload({ ...valid, preferredTimeWindow: "" })).toEqual({});
  });
});

// ─── Per-goal soft cap (async, uses real DB) ──────────────────────────────────

describe("assertCanCreateActiveHabit — per-goal soft cap", () => {
  let db: SQLiteDatabase;

  beforeEach(async () => {
    db = await createTestDb();
    mockGetDb.mockReturnValue(db);
  });

  afterEach(async () => {
    await db.closeAsync();
  });

  async function seedHabit(
    userId: string,
    identityPhrase: string | null,
    status: "active" | "archived" = "active",
  ) {
    return repoCreateHabit({
      user_id: userId,
      title: "Test habit",
      identity_phrase: identityPhrase,
      cue: "Morning",
      tiny_action: "Do it",
      minimum_viable_action: null,
      preferred_time_window: null,
      start_date: "2026-04-23",
      habit_state: "active",
      status,
    });
  }

  it("returns ok when there are no active habits for the identity phrase", async () => {
    const result = await assertCanCreateActiveHabit("user-1", "a runner");
    expect(result.ok).toBe(true);
  });

  it("returns ok when fewer than 3 active habits exist under the identity phrase", async () => {
    await seedHabit("user-1", "a runner");
    await seedHabit("user-1", "a runner");
    const result = await assertCanCreateActiveHabit("user-1", "a runner");
    expect(result.ok).toBe(true);
  });

  it("returns soft_cap_warning when 3 active habits exist under the same identity phrase", async () => {
    await seedHabit("user-1", "a runner");
    await seedHabit("user-1", "a runner");
    await seedHabit("user-1", "a runner");
    const result = await assertCanCreateActiveHabit("user-1", "a runner");
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.reason).toBe("soft_cap_warning");
      expect(result.count).toBe(3);
    }
  });

  it("does not count habits under a different identity phrase toward the cap", async () => {
    await seedHabit("user-1", "a runner");
    await seedHabit("user-1", "a runner");
    await seedHabit("user-1", "a runner");
    // Different identity phrase — should not be affected by the runner cap
    const result = await assertCanCreateActiveHabit("user-1", "a meditator");
    expect(result.ok).toBe(true);
  });

  it("does not count archived habits toward the cap", async () => {
    await seedHabit("user-1", "a runner");
    await seedHabit("user-1", "a runner");
    await seedHabit("user-1", "a runner", "archived"); // archived — should not count
    // Only 2 active, under cap
    const result = await assertCanCreateActiveHabit("user-1", "a runner");
    expect(result.ok).toBe(true);
  });

  it("does not count another user's habits toward this user's cap", async () => {
    await seedHabit("user-2", "a runner");
    await seedHabit("user-2", "a runner");
    await seedHabit("user-2", "a runner");
    const result = await assertCanCreateActiveHabit("user-1", "a runner");
    expect(result.ok).toBe(true);
  });
});
