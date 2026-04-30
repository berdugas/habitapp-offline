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
  tinyAction: string;
  cueExisting: string;
  worstDayPassed: boolean | null;
};

export const EMPTY_DRAFT: OnboardingDraft = {
  step: "welcome",
  becomingPhrase: "",
  dailyAction: "",
  tinyAction: "",
  cueExisting: "",
  worstDayPassed: null,
};

export const KNOWN_DRAFT_KEYS = [
  "step",
  "becomingPhrase",
  "dailyAction",
  "tinyAction",
  "cueExisting",
  "worstDayPassed",
] as const satisfies readonly (keyof OnboardingDraft)[];

export const ONBOARDING_DRAFT_KEY = "onboarding.draft";
export const ONBOARDING_COMPLETED_AT_KEY = "onboarding.completed_at";
