import type { SQLiteDatabase } from "expo-sqlite";

import { getDb } from "@/lib/db/client";
import { setPreference } from "@/lib/db/repositories/preferences";
import { createTestDb } from "@/tests/setup/createTestDb";
import { setNowForTesting, resetClockForTesting } from "@/utils/clock";

import {
  clearOnboardingDraft,
  isOnboardingCompleted,
  loadOnboardingDraft,
  markOnboardingCompleted,
  saveOnboardingDraft,
} from "../storage";
import { EMPTY_DRAFT, ONBOARDING_DRAFT_KEY } from "../types";

jest.mock("@/lib/db/client");
const mockGetDb = getDb as jest.Mock;

describe("onboarding storage", () => {
  let db: SQLiteDatabase;

  beforeEach(async () => {
    db = await createTestDb();
    mockGetDb.mockReturnValue(db);
    resetClockForTesting();
  });

  afterEach(async () => {
    await db.closeAsync();
  });

  describe("loadOnboardingDraft", () => {
    it("returns EMPTY_DRAFT when nothing has been saved", async () => {
      const draft = await loadOnboardingDraft();
      expect(draft).toEqual(EMPTY_DRAFT);
    });

    it("round-trips a full draft via save then load", async () => {
      const original = {
        ...EMPTY_DRAFT,
        step: "becoming" as const,
        becomingPhrase: "a runner",
        dailyAction: "Run for 5 minutes",
      };
      await saveOnboardingDraft(original);
      const loaded = await loadOnboardingDraft();
      expect(loaded).toEqual(original);
    });

    it("merges a draft saved with an old shape (missing fields) over EMPTY_DRAFT", async () => {
      // Simulate a draft saved before tinyAction was added to the schema.
      const oldShape = { step: "daily-action", becomingPhrase: "a writer" };
      await setPreference(ONBOARDING_DRAFT_KEY, JSON.stringify(oldShape));

      const loaded = await loadOnboardingDraft();
      expect(loaded.step).toBe("daily-action");
      expect(loaded.becomingPhrase).toBe("a writer");
      // Fields from EMPTY_DRAFT are filled in.
      expect(loaded.tinyAction).toBe("");
      expect(loaded.worstDayPassed).toBeNull();
    });

    it("drops unknown keys when loading a draft persisted under an older shape", async () => {
      // Simulate a draft saved before cueAction was removed from the schema.
      const oldShape = {
        step: "cue",
        becomingPhrase: "a writer",
        cueAction: "this field no longer exists",
        bogusField: 12345,
      };
      await setPreference(ONBOARDING_DRAFT_KEY, JSON.stringify(oldShape));

      const loaded = await loadOnboardingDraft();
      expect(loaded.step).toBe("cue");
      expect(loaded.becomingPhrase).toBe("a writer");
      // Unknown keys should not appear on the result.
      expect(loaded).not.toHaveProperty("cueAction");
      expect(loaded).not.toHaveProperty("bogusField");
    });

    it("returns EMPTY_DRAFT without throwing when the stored JSON is malformed", async () => {
      await setPreference(ONBOARDING_DRAFT_KEY, "{not valid json");
      const loaded = await loadOnboardingDraft();
      expect(loaded).toEqual(EMPTY_DRAFT);
    });
  });

  describe("clearOnboardingDraft", () => {
    it("removes the draft so subsequent load returns EMPTY_DRAFT", async () => {
      await saveOnboardingDraft({ ...EMPTY_DRAFT, becomingPhrase: "a runner" });
      await clearOnboardingDraft();
      const loaded = await loadOnboardingDraft();
      expect(loaded).toEqual(EMPTY_DRAFT);
    });
  });

  describe("isOnboardingCompleted / markOnboardingCompleted", () => {
    it("returns false when no completion mark exists", async () => {
      expect(await isOnboardingCompleted()).toBe(false);
    });

    it("returns true after markOnboardingCompleted is called", async () => {
      setNowForTesting(new Date("2026-04-29T10:00:00.000Z"));
      await markOnboardingCompleted();
      expect(await isOnboardingCompleted()).toBe(true);
    });

    it("markOnboardingCompleted writes an ISO timestamp using clock.nowIso", async () => {
      const fixedDate = new Date("2026-04-29T10:00:00.000Z");
      setNowForTesting(fixedDate);
      await markOnboardingCompleted();
      // Verify the stored value is the ISO string from the mocked clock.
      const row = await db.getFirstAsync<{ value: string }>(
        "SELECT value FROM local_user_preferences WHERE key = 'onboarding.completed_at'",
      );
      expect(row?.value).toBe(fixedDate.toISOString());
    });
  });
});
