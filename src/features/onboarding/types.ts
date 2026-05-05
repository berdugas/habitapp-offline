export type OnboardingStep =
  | "welcome"
  | "insight"
  | "becoming"
  | "action-insight"
  | "daily-action"
  | "shrink-insight"
  | "shrink"
  | "cue-insight"
  | "cue"
  | "schedule"
  | "personalize"
  | "confirmation";

export type OnboardingDraft = {
  step: OnboardingStep;
  becomingPhrase: string;
  dailyAction: string;
  tinyAction: string;
  cueExisting: string;
  worstDayPassed: boolean | null;
  habitName: string;
  habitIcon: string | null;
  activeDays: number[];
  reminderEnabled: boolean;
  reminderTime: string;
};

export const EMPTY_DRAFT: OnboardingDraft = {
  step: "welcome",
  becomingPhrase: "",
  dailyAction: "",
  tinyAction: "",
  cueExisting: "",
  worstDayPassed: null,
  habitName: "",
  habitIcon: null,
  activeDays: [1, 2, 3, 4, 5, 6, 7],
  reminderEnabled: true,
  reminderTime: "07:00",
};

export const KNOWN_DRAFT_KEYS = [
  "step",
  "becomingPhrase",
  "dailyAction",
  "tinyAction",
  "cueExisting",
  "worstDayPassed",
  "habitName",
  "habitIcon",
  "activeDays",
  "reminderEnabled",
  "reminderTime",
] as const satisfies readonly (keyof OnboardingDraft)[];

export const ONBOARDING_DRAFT_KEY = "onboarding.draft";
export const ONBOARDING_COMPLETED_AT_KEY = "onboarding.completed_at";
