export type OnboardingStep =
  | "welcome"
  | "becoming"
  | "daily-action"
  | "shrink" // S4
  | "cue" // S4
  | "worst-day" // S4
  | "confirmation"; // S4

export type OnboardingDraft = {
  step: OnboardingStep;
  becomingPhrase: string;
  dailyAction: string;
  // S4 fields — defined now so the persisted JSON format doesn't need to change in S4.
  tinyAction: string;
  cueExisting: string;
  cueAction: string;
  worstDayPassed: boolean | null;
};

export const EMPTY_DRAFT: OnboardingDraft = {
  step: "welcome",
  becomingPhrase: "",
  dailyAction: "",
  tinyAction: "",
  cueExisting: "",
  cueAction: "",
  worstDayPassed: null,
};

export const ONBOARDING_DRAFT_KEY = "onboarding.draft";
export const ONBOARDING_COMPLETED_AT_KEY = "onboarding.completed_at";
