import {
  deletePreference,
  getPreference,
  setPreference,
} from "@/lib/db/repositories/preferences";
import { logger } from "@/services/logger";
import { nowIso } from "@/utils/clock";

import {
  EMPTY_DRAFT,
  KNOWN_DRAFT_KEYS,
  LEGACY_ONBOARDING_COMPLETED_AT_KEY,
  LEGACY_ONBOARDING_DRAFT_KEY,
  onboardingCompletedAtKey,
  onboardingDraftKey,
  type OnboardingDraft,
} from "./types";

function pickKnownDraftKeys(parsed: unknown): Partial<OnboardingDraft> {
  if (typeof parsed !== "object" || parsed === null) {
    return {};
  }
  const result: Partial<OnboardingDraft> = {};
  for (const key of KNOWN_DRAFT_KEYS) {
    if (key in parsed) {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      (result as any)[key] = (parsed as any)[key];
    }
  }
  return result;
}

// Unscoped legacy rows cannot be attributed to the signed-in user — drop them
// rather than adopt them, to avoid falsely marking a fresh account onboarded.
async function dropLegacyRowIfPresent(legacyKey: string): Promise<void> {
  try {
    const legacy = await getPreference(legacyKey);
    if (legacy !== null) {
      await deletePreference(legacyKey);
      logger.info("Dropped unscoped legacy onboarding preference", {
        key: legacyKey,
      });
    }
  } catch (error) {
    logger.warn("Failed to clean up legacy onboarding preference", {
      key: legacyKey,
      error,
    });
  }
}

export async function loadOnboardingDraft(
  userId: string,
): Promise<OnboardingDraft> {
  await dropLegacyRowIfPresent(LEGACY_ONBOARDING_DRAFT_KEY);

  const raw = await getPreference(onboardingDraftKey(userId));
  if (raw === null) {
    return { ...EMPTY_DRAFT };
  }
  try {
    const parsed = JSON.parse(raw);
    return { ...EMPTY_DRAFT, ...pickKnownDraftKeys(parsed) };
  } catch (error) {
    logger.warn("Failed to parse onboarding draft — resetting to empty", {
      error,
    });
    return { ...EMPTY_DRAFT };
  }
}

export async function saveOnboardingDraft(
  userId: string,
  draft: OnboardingDraft,
): Promise<void> {
  try {
    await setPreference(onboardingDraftKey(userId), JSON.stringify(draft));
  } catch (error) {
    logger.warn("Failed to persist onboarding draft", { error });
  }
}

export async function clearOnboardingDraft(userId: string): Promise<void> {
  await deletePreference(onboardingDraftKey(userId));
}

export async function isOnboardingCompleted(userId: string): Promise<boolean> {
  await dropLegacyRowIfPresent(LEGACY_ONBOARDING_COMPLETED_AT_KEY);
  const value = await getPreference(onboardingCompletedAtKey(userId));
  return value !== null;
}

export async function markOnboardingCompleted(userId: string): Promise<void> {
  await setPreference(onboardingCompletedAtKey(userId), nowIso());
}
