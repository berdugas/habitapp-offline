import type { SQLiteDatabase } from "expo-sqlite";

import * as habitsValidators from "@/features/habits/validators";
import { listActiveHabits } from "@/features/habits/api";
import { getDb } from "@/lib/db/client";
import * as preferencesRepo from "@/lib/db/repositories/preferences";
import { createTestDb } from "@/tests/setup/createTestDb";
import { setNowForTesting, resetClockForTesting } from "@/utils/clock";

import {
  finalizeOnboarding,
  OnboardingFinalizationError,
} from "../completion";
import {
  isOnboardingCompleted,
  loadOnboardingDraft,
  saveOnboardingDraft,
} from "../storage";
import { EMPTY_DRAFT } from "../types";

jest.mock("@/lib/db/client");
const mockGetDb = getDb as jest.Mock;

const TEST_USER_ID = "user-test-1";

function makeReadyDraft() {
  return {
    ...EMPTY_DRAFT,
    step: "confirmation" as const,
    becomingPhrase: "a runner",
    dailyAction: "Run for 30 minutes",
    tinyAction: "Run for 2 minutes",
    cueExisting: "morning coffee",
    worstDayPassed: true,
  };
}

describe("finalizeOnboarding", () => {
  let db: SQLiteDatabase;

  beforeEach(async () => {
    db = await createTestDb();
    mockGetDb.mockReturnValue(db);
    setNowForTesting(new Date("2026-04-29T10:00:00.000Z"));
  });

  afterEach(async () => {
    jest.restoreAllMocks();
    resetClockForTesting();
    await db.closeAsync();
  });

  it("creates an active habit, marks completion, and clears the draft on success", async () => {
    const draft = makeReadyDraft();
    await saveOnboardingDraft(draft);

    const habit = await finalizeOnboarding(TEST_USER_ID, draft);

    expect(habit.user_id).toBe(TEST_USER_ID);
    expect(habit.habit_state).toBe("active");
    expect(habit.status).toBe("active");
    expect(habit.identity_phrase).toBe("a runner");
    expect(habit.cue).toBe("morning coffee");
    expect(habit.tiny_action).toBe("Run for 2 minutes");
    expect(habit.title).toBe("Run for 2 minutes");
    expect(habit.start_date).toBe("2026-04-29");

    // Completion mark present.
    expect(await isOnboardingCompleted()).toBe(true);

    // Draft cleared.
    expect(await loadOnboardingDraft()).toEqual(EMPTY_DRAFT);

    // Active habits list shows the new habit.
    const active = await listActiveHabits(TEST_USER_ID);
    expect(active).toHaveLength(1);
    expect(active[0].id).toBe(habit.id);
  });

  it("throws cap_failed and writes nothing when the cap helper rejects", async () => {
    const draft = makeReadyDraft();
    await saveOnboardingDraft(draft);

    jest
      .spyOn(habitsValidators, "assertCanCreateActiveHabit")
      .mockResolvedValueOnce({
        ok: false,
        reason: "soft_cap_warning",
        count: 3,
      });

    const err = await finalizeOnboarding(TEST_USER_ID, draft).catch((e) => e);
    expect(err).toBeInstanceOf(OnboardingFinalizationError);
    expect(err.reason).toBe("cap_failed");

    // Completion mark NOT written.
    expect(await isOnboardingCompleted()).toBe(false);
    // Draft preserved.
    const reloaded = await loadOnboardingDraft();
    expect(reloaded.tinyAction).toBe("Run for 2 minutes");
    // No habit row.
    const active = await listActiveHabits(TEST_USER_ID);
    expect(active).toHaveLength(0);
  });

  it("rolls back the habit insert if a later step in the transaction throws", async () => {
    const draft = makeReadyDraft();
    await saveOnboardingDraft(draft);

    // Sabotage the second step in the transaction (setPreference for the
    // completion key) so the transaction rolls back.
    const realSetPreference = preferencesRepo.setPreference;
    jest
      .spyOn(preferencesRepo, "setPreference")
      .mockImplementation(async (key, value) => {
        if (key === "onboarding.completed_at") {
          throw new Error("Simulated write failure");
        }
        return realSetPreference(key, value);
      });

    const err = await finalizeOnboarding(TEST_USER_ID, draft).catch((e) => e);
    expect(err).toBeInstanceOf(OnboardingFinalizationError);
    expect(err.reason).toBe("write_failed");

    // No habit row — the insert was rolled back.
    const active = await listActiveHabits(TEST_USER_ID);
    expect(active).toHaveLength(0);

    // Completion mark NOT written (the throw on this step triggered rollback).
    expect(await isOnboardingCompleted()).toBe(false);

    // Draft preserved (the delete was rolled back).
    const reloaded = await loadOnboardingDraft();
    expect(reloaded.tinyAction).toBe("Run for 2 minutes");
  });
});
