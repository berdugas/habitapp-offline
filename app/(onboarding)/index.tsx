import { Redirect } from "expo-router";

import { LoadingState } from "@/components/feedback/LoadingState";
import { useOnboarding } from "@/features/onboarding/OnboardingProvider";
import type { OnboardingStep } from "@/features/onboarding/types";

const STEP_TO_HREF: Record<OnboardingStep, string> = {
  "welcome": "/(onboarding)/welcome",
  "becoming": "/(onboarding)/becoming",
  "daily-action": "/(onboarding)/daily-action",
  "shrink": "/(onboarding)/shrink",
  "cue": "/(onboarding)/cue",
  "worst-day": "/(onboarding)/worst-day",
  "confirmation": "/(onboarding)/confirmation",
};

export default function OnboardingIndex() {
  const { draft, hydrated } = useOnboarding();

  if (!hydrated) {
    return <LoadingState message="Picking up where you left off..." />;
  }

  return <Redirect href={STEP_TO_HREF[draft.step]} />;
}
