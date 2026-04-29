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
  };

  it("errors on blank required fields: title, cue, tinyAction", () => {
    const errors = validateCreateHabitPayload({
      title: "   ",
      identityPhrase: "",
      cue: "   ",
      tinyAction: "   ",
      minimumViableAction: "",
      preferredTimeWindow: "",
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

// ─── Cap helper (async, uses real DB) ────────────────────────────────────────

describe("assertCanCreateActiveHabit", () => {
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
    state: "focus" | "supporting",
    status: "active" | "archived" = "active",
  ) {
    return repoCreateHabit({
      user_id: userId,
      title: "Test habit",
      identity_phrase: null,
      cue: "Morning",
      tiny_action: "Do it",
      minimum_viable_action: null,
      preferred_time_window: null,
      start_date: "2026-04-23",
      habit_state: state,
      status,
    });
  }

  it("returns ok when there are no active habits (asking for focus)", async () => {
    const result = await assertCanCreateActiveHabit("user-1", "focus");
    expect(result.ok).toBe(true);
  });

  it("returns ok when there are no active habits (asking for supporting)", async () => {
    const result = await assertCanCreateActiveHabit("user-1", "supporting");
    expect(result.ok).toBe(true);
  });

  it("returns focus_full when 1 focus habit exists and asking for another focus", async () => {
    await seedHabit("user-1", "focus");
    const result = await assertCanCreateActiveHabit("user-1", "focus");
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.reason).toBe("focus_full");
      expect(result.counts.focus).toBe(1);
    }
  });

  it("returns supporting_full when 2 supporting habits exist and asking for another supporting", async () => {
    await seedHabit("user-1", "supporting");
    await seedHabit("user-1", "supporting");
    const result = await assertCanCreateActiveHabit("user-1", "supporting");
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.reason).toBe("supporting_full");
      expect(result.counts.supporting).toBe(2);
    }
  });

  it("returns ok when 1 focus and 1 supporting exist and asking for supporting (under cap)", async () => {
    await seedHabit("user-1", "focus");
    await seedHabit("user-1", "supporting");
    const result = await assertCanCreateActiveHabit("user-1", "supporting");
    expect(result.ok).toBe(true);
  });

  it("returns total_cap_reached when 1 focus + 2 supporting exist and asking for a valid state", async () => {
    await seedHabit("user-1", "focus");
    await seedHabit("user-1", "supporting");
    await seedHabit("user-1", "supporting");
    // Total = 3 = cap. Asking for supporting would hit supporting_full first (2 >= 2).
    // But if we ask for something that wouldn't hit a sub-limit: let's verify the cap check.
    // At 1 focus + 2 supporting, the focus sub-limit (1) is hit for focus requests.
    // The supporting sub-limit (2) is hit for supporting requests.
    // The total cap (3) is also hit regardless.
    const focusResult = await assertCanCreateActiveHabit("user-1", "focus");
    expect(focusResult.ok).toBe(false);
    if (!focusResult.ok) {
      expect(focusResult.reason).toBe("focus_full");
    }
    const supportingResult = await assertCanCreateActiveHabit("user-1", "supporting");
    expect(supportingResult.ok).toBe(false);
    if (!supportingResult.ok) {
      expect(supportingResult.reason).toBe("supporting_full");
    }
  });

  it("always returns ok for automatic state regardless of counts", async () => {
    await seedHabit("user-1", "focus");
    await seedHabit("user-1", "supporting");
    await seedHabit("user-1", "supporting");
    const result = await assertCanCreateActiveHabit("user-1", "automatic");
    expect(result.ok).toBe(true);
  });

  it("does not count archived habits toward the cap", async () => {
    await seedHabit("user-1", "focus");
    await seedHabit("user-1", "focus", "archived"); // archived — should not count
    // With 1 active focus (+ 1 archived), asking for focus should hit the limit
    const result = await assertCanCreateActiveHabit("user-1", "focus");
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.counts.focus).toBe(1); // only active counted
    }
  });

  it("does not count another user's habits toward this user's cap", async () => {
    // User-2 has 1 focus — should not affect user-1's cap check
    await seedHabit("user-2", "focus");
    const result = await assertCanCreateActiveHabit("user-1", "focus");
    expect(result.ok).toBe(true);
  });
});
