import type { HabitLogStatus, HabitState } from "@/features/habits/types";

export type TodayHabitCardData = {
  activeDays: number[];
  consistencyDenominator: number;
  consistencyRate: number;
  cue: string;
  formula: string;
  habitState: HabitState;
  icon: string | null;
  id: string;
  identityPhrase: string;
  name: string;
  offDay: boolean;
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
