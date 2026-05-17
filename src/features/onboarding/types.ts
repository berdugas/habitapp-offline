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

export const LEGACY_ONBOARDING_DRAFT_KEY = "onboarding.draft";
export const LEGACY_ONBOARDING_COMPLETED_AT_KEY = "onboarding.completed_at";

export function onboardingDraftKey(userId: string): string {
  return `onboarding.draft:${userId}`;
}

export function onboardingCompletedAtKey(userId: string): string {
  return `onboarding.completed_at:${userId}`;
}
export const WEEKLY_REVIEW_INTRO_SEEN_AT_KEY = "weekly_review.intro_seen_at";
export const WEEKLY_REVIEW_FIRST_RUN_COMPLETED_AT_KEY =
  "weekly_review.first_run_completed_at";
export const HABITS_ARCHIVE_INTRO_SEEN_AT_KEY = "habits.archive_intro_seen_at";
