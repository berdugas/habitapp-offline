import type { SQLiteDatabase } from "expo-sqlite";

import { getDb } from "@/lib/db/client";
import * as preferencesRepo from "@/lib/db/repositories/preferences";
import { setPreference } from "@/lib/db/repositories/preferences";
import { logger } from "@/services/logger";
import { createTestDb } from "@/tests/setup/createTestDb";
import { setNowForTesting, resetClockForTesting } from "@/utils/clock";

import {
  clearOnboardingDraft,
  isOnboardingCompleted,
  loadOnboardingDraft,
  markOnboardingCompleted,
  saveOnboardingDraft,
} from "../storage";
import {
  EMPTY_DRAFT,
  LEGACY_ONBOARDING_COMPLETED_AT_KEY,
  LEGACY_ONBOARDING_DRAFT_KEY,
  onboardingCompletedAtKey,
  onboardingDraftKey,
} from "../types";

jest.mock("@/lib/db/client");
const mockGetDb = getDb as jest.Mock;

const USER_A = "user-A";
const USER_B = "user-B";

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
      const draft = await loadOnboardingDraft(USER_A);
      expect(draft).toEqual(EMPTY_DRAFT);
    });

    it("round-trips a full draft via save then load", async () => {
      const original = {
        ...EMPTY_DRAFT,
        step: "becoming" as const,
        becomingPhrase: "a runner",
        dailyAction: "Run for 5 minutes",
      };
      await saveOnboardingDraft(USER_A, original);
      const loaded = await loadOnboardingDraft(USER_A);
      expect(loaded).toEqual(original);
    });

    it("merges a draft saved with an old shape (missing fields) over EMPTY_DRAFT", async () => {
      // Simulate a draft saved before tinyAction was added to the schema.
      const oldShape = { step: "daily-action", becomingPhrase: "a writer" };
      await setPreference(onboardingDraftKey(USER_A), JSON.stringify(oldShape));

      const loaded = await loadOnboardingDraft(USER_A);
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
      await setPreference(onboardingDraftKey(USER_A), JSON.stringify(oldShape));

      const loaded = await loadOnboardingDraft(USER_A);
      expect(loaded.step).toBe("cue");
      expect(loaded.becomingPhrase).toBe("a writer");
      // Unknown keys should not appear on the result.
      expect(loaded).not.toHaveProperty("cueAction");
      expect(loaded).not.toHaveProperty("bogusField");
    });

    it("returns EMPTY_DRAFT without throwing when the stored JSON is malformed", async () => {
      await setPreference(onboardingDraftKey(USER_A), "{not valid json");
      const loaded = await loadOnboardingDraft(USER_A);
      expect(loaded).toEqual(EMPTY_DRAFT);
    });
  });

  describe("clearOnboardingDraft", () => {
    it("removes the draft so subsequent load returns EMPTY_DRAFT", async () => {
      await saveOnboardingDraft(USER_A, {
        ...EMPTY_DRAFT,
        becomingPhrase: "a runner",
      });
      await clearOnboardingDraft(USER_A);
      const loaded = await loadOnboardingDraft(USER_A);
      expect(loaded).toEqual(EMPTY_DRAFT);
    });
  });

  describe("isOnboardingCompleted / markOnboardingCompleted", () => {
    it("returns false when no completion mark exists", async () => {
      expect(await isOnboardingCompleted(USER_A)).toBe(false);
    });

    it("returns true after markOnboardingCompleted is called", async () => {
      setNowForTesting(new Date("2026-04-29T10:00:00.000Z"));
      await markOnboardingCompleted(USER_A);
      expect(await isOnboardingCompleted(USER_A)).toBe(true);
    });

    it("markOnboardingCompleted writes an ISO timestamp under the per-user key", async () => {
      const fixedDate = new Date("2026-04-29T10:00:00.000Z");
      setNowForTesting(fixedDate);
      await markOnboardingCompleted(USER_A);
      // Verify the stored value is the ISO string from the mocked clock under the per-user key.
      const row = await db.getFirstAsync<{ value: string }>(
        "SELECT value FROM local_user_preferences WHERE key = ?",
        onboardingCompletedAtKey(USER_A),
      );
      expect(row?.value).toBe(fixedDate.toISOString());
    });
  });

  describe("per-user scoping", () => {
    it("marking user A complete does not flip user B's completion state", async () => {
      await markOnboardingCompleted(USER_A);
      expect(await isOnboardingCompleted(USER_A)).toBe(true);
      expect(await isOnboardingCompleted(USER_B)).toBe(false);
    });

    it("after markOnboardingCompleted only the per-user row exists (no legacy/unscoped row)", async () => {
      await markOnboardingCompleted(USER_A);
      const rows = await db.getAllAsync<{ key: string }>(
        "SELECT key FROM local_user_preferences",
      );
      const keys = rows.map((r) => r.key);
      expect(keys).toContain(onboardingCompletedAtKey(USER_A));
      expect(keys).not.toContain(LEGACY_ONBOARDING_COMPLETED_AT_KEY);
    });
  });

  describe("legacy unscoped row cleanup", () => {
    it("isOnboardingCompleted deletes a legacy onboarding.completed_at row and returns false for a brand-new user", async () => {
      await setPreference(
        LEGACY_ONBOARDING_COMPLETED_AT_KEY,
        "2026-04-01T00:00:00.000Z",
      );

      const result = await isOnboardingCompleted(USER_A);

      expect(result).toBe(false);
      const legacyRow = await db.getFirstAsync<{ value: string }>(
        "SELECT value FROM local_user_preferences WHERE key = ?",
        LEGACY_ONBOARDING_COMPLETED_AT_KEY,
      );
      expect(legacyRow).toBeNull();
      // And the per-user key was NOT adopted from the legacy value.
      const perUserRow = await db.getFirstAsync<{ value: string }>(
        "SELECT value FROM local_user_preferences WHERE key = ?",
        onboardingCompletedAtKey(USER_A),
      );
      expect(perUserRow).toBeNull();
    });

    it("loadOnboardingDraft deletes a legacy onboarding.draft row, returns EMPTY_DRAFT, and does not persist a per-user copy", async () => {
      await setPreference(
        LEGACY_ONBOARDING_DRAFT_KEY,
        JSON.stringify({ step: "becoming", becomingPhrase: "a stranger" }),
      );

      const loaded = await loadOnboardingDraft(USER_A);

      expect(loaded).toEqual(EMPTY_DRAFT);
      const legacyRow = await db.getFirstAsync<{ value: string }>(
        "SELECT value FROM local_user_preferences WHERE key = ?",
        LEGACY_ONBOARDING_DRAFT_KEY,
      );
      expect(legacyRow).toBeNull();
      const perUserRow = await db.getFirstAsync<{ value: string }>(
        "SELECT value FROM local_user_preferences WHERE key = ?",
        onboardingDraftKey(USER_A),
      );
      expect(perUserRow).toBeNull();
    });

    it("legacy cleanup failure does not block the per-user read (best-effort contract)", async () => {
      // Seed the legacy row and a per-user mark — we want to prove the
      // per-user true read still propagates even if the cleanup delete throws.
      await setPreference(
        LEGACY_ONBOARDING_COMPLETED_AT_KEY,
        "2026-04-01T00:00:00.000Z",
      );
      await markOnboardingCompleted(USER_A);

      const deleteSpy = jest
        .spyOn(preferencesRepo, "deletePreference")
        .mockImplementation(async (key: string) => {
          if (key === LEGACY_ONBOARDING_COMPLETED_AT_KEY) {
            throw new Error("simulated delete failure");
          }
        });
      const warnSpy = jest.spyOn(logger, "warn").mockImplementation(() => {});

      try {
        const result = await isOnboardingCompleted(USER_A);
        expect(result).toBe(true);
        expect(warnSpy).toHaveBeenCalledWith(
          "Failed to clean up legacy onboarding preference",
          expect.objectContaining({ key: LEGACY_ONBOARDING_COMPLETED_AT_KEY }),
        );
      } finally {
        deleteSpy.mockRestore();
        warnSpy.mockRestore();
      }
    });
  });
});
