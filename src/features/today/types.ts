import type { HabitLogStatus } from "@/features/habits/types";

export type TodayHabitCardData = {
  activeDays: number[];
  consistencyRate: number;
  cue: string;
  formula: string;
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
