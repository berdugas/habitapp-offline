import type { HabitLogStatus, HabitState } from "@/features/habits/types";
import type { ReminderType } from "@/lib/db/repositories/reminders";

export type TodayHabitCardData = {
  activeDays: number[];
  consistencyDenominator: number;
  consistencyRate: number;
  createdAt: string;
  cue: string;
  formula: string;
  habitState: HabitState;
  icon: string | null;
  id: string;
  identityPhrase: string;
  name: string;
  offDay: boolean;
  reminderTime: string | null;
  reminderType: ReminderType;
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

export type TodayGoalGroup = {
  identityPhrase: string;
  habits: TodayHabitCardData[];
};
