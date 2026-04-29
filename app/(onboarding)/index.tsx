import { Redirect } from "expo-router";

import { LoadingState } from "@/components/feedback/LoadingState";
import { useOnboarding } from "@/features/onboarding/OnboardingProvider";
import type { OnboardingStep } from "@/features/onboarding/types";

const STEP_TO_HREF: Record<OnboardingStep, string> = {
  "welcome": "/(onboarding)/welcome",
  "becoming": "/(onboarding)/becoming",
  "daily-action": "/(onboarding)/daily-action",
  // S4 steps are capped at daily-action — the last screen S3 ships.
  // S4 will replace these entries with real routes.
  "shrink": "/(onboarding)/daily-action",
  "cue": "/(onboarding)/daily-action",
  "worst-day": "/(onboarding)/daily-action",
  "confirmation": "/(onboarding)/daily-action",
};

export default function OnboardingIndex() {
  const { draft, hydrated } = useOnboarding();

  if (!hydrated) {
    return <LoadingState message="Picking up where you left off..." />;
  }

  return <Redirect href={STEP_TO_HREF[draft.step]} />;
}
