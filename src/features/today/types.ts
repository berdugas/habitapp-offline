import type { HabitLogStatus, HabitState } from "@/features/habits/types";

export type TodayHabitCardData = {
  consistencyRate: number;
  cue: string;
  formula: string;
  habitState: HabitState;
  id: string;
  identityPhrase: string;
  isWeeklyReviewDue: boolean;
  latestReviewWeekStart: string | null;
  name: string;
  skipCount: number;
  startDate: string;
  streak: number;
  tinyAction: string;
  todayStatus: HabitLogStatus | null;
};

export type UpcomingHabitCardData = {
  formula: string;
  id: string;
  name: string;
  startDate: string;
};
