import { Redirect } from "expo-router";

import { LoadingState } from "@/components/feedback/LoadingState";
import { useOnboarding } from "@/features/onboarding/OnboardingProvider";
import type { OnboardingStep } from "@/features/onboarding/types";

const STEP_TO_HREF: Record<OnboardingStep, string> = {
  "welcome": "/(onboarding)/welcome",
  "insight": "/(onboarding)/insight",
  "becoming": "/(onboarding)/becoming",
  "action-insight": "/(onboarding)/action-insight",
  "daily-action": "/(onboarding)/daily-action",
  "shrink-insight": "/(onboarding)/shrink-insight",
  "shrink": "/(onboarding)/shrink",
  "cue-insight": "/(onboarding)/cue-insight",
  "cue": "/(onboarding)/cue",
  "schedule": "/(onboarding)/schedule",
  "personalize": "/(onboarding)/personalize",
  "confirmation": "/(onboarding)/confirmation",
};

export default function OnboardingIndex() {
  const { draft, hydrated } = useOnboarding();

  if (!hydrated) {
    return <LoadingState message="Picking up where you left off..." />;
  }

  return <Redirect href={STEP_TO_HREF[draft.step]} />;
}
