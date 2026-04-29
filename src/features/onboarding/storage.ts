import {
  deletePreference,
  getPreference,
  setPreference,
} from "@/lib/db/repositories/preferences";
import { logger } from "@/services/logger";
import { nowIso } from "@/utils/clock";

import {
  EMPTY_DRAFT,
  ONBOARDING_COMPLETED_AT_KEY,
  ONBOARDING_DRAFT_KEY,
  type OnboardingDraft,
} from "./types";

export async function loadOnboardingDraft(): Promise<OnboardingDraft> {
  const raw = await getPreference(ONBOARDING_DRAFT_KEY);
  if (raw === null) {
    return { ...EMPTY_DRAFT };
  }
  try {
    const parsed = JSON.parse(raw) as Partial<OnboardingDraft>;
    return { ...EMPTY_DRAFT, ...parsed };
  } catch (error) {
    logger.warn("Failed to parse onboarding draft — resetting to empty", {
      error,
    });
    return { ...EMPTY_DRAFT };
  }
}

export async function saveOnboardingDraft(draft: OnboardingDraft): Promise<void> {
  try {
    await setPreference(ONBOARDING_DRAFT_KEY, JSON.stringify(draft));
  } catch (error) {
    logger.warn("Failed to persist onboarding draft", { error });
  }
}

export async function clearOnboardingDraft(): Promise<void> {
  await deletePreference(ONBOARDING_DRAFT_KEY);
}

export async function isOnboardingCompleted(): Promise<boolean> {
  const value = await getPreference(ONBOARDING_COMPLETED_AT_KEY);
  return value !== null;
}

export async function markOnboardingCompleted(): Promise<void> {
  await setPreference(ONBOARDING_COMPLETED_AT_KEY, nowIso());
}
