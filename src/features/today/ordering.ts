import type { TodayGoalGroup, TodayHabitCardData } from "@/features/today/types";

function isHabitActionNeeded(habit: TodayHabitCardData): boolean {
  return habit.todayStatus === null && !habit.offDay;
}

function isGoalActive(habits: TodayHabitCardData[]): boolean {
  return habits.some(isHabitActionNeeded);
}

function earliestReminderTime(habits: TodayHabitCardData[]): string | null {
  let earliest: string | null = null;
  for (const habit of habits) {
    if (habit.reminderTime === null) continue;
    if (earliest === null || habit.reminderTime < earliest) {
      earliest = habit.reminderTime;
    }
  }
  return earliest;
}

function oldestHabitCreatedAt(habits: TodayHabitCardData[]): string {
  let oldest = habits[0]?.createdAt ?? "";
  for (const habit of habits) {
    if (habit.createdAt < oldest) oldest = habit.createdAt;
  }
  return oldest;
}

function compareGoals(a: TodayGoalGroup, b: TodayGoalGroup): number {
  const aEarliest = earliestReminderTime(a.habits);
  const bEarliest = earliestReminderTime(b.habits);
  const aTimed = aEarliest !== null;
  const bTimed = bEarliest !== null;

  // 1. Timed goals first.
  if (aTimed && !bTimed) return -1;
  if (!aTimed && bTimed) return 1;

  // 2. Among timed goals: ascending earliestReminderTime (ASCII == numeric for "HH:mm").
  if (aTimed && bTimed && aEarliest !== bEarliest) {
    return aEarliest! < bEarliest! ? -1 : 1;
  }

  // 3. Among untimed goals: ascending oldestHabitCreatedAt.
  if (!aTimed && !bTimed) {
    const aOldest = oldestHabitCreatedAt(a.habits);
    const bOldest = oldestHabitCreatedAt(b.habits);
    if (aOldest !== bOldest) return aOldest < bOldest ? -1 : 1;
  }

  // 4. Stability tiebreaker: identity_phrase lexicographic ascending.
  if (a.identityPhrase < b.identityPhrase) return -1;
  if (a.identityPhrase > b.identityPhrase) return 1;
  return 0;
}

export function sortHabitsWithinGoal(
  habits: TodayHabitCardData[],
): TodayHabitCardData[] {
  const actionNeeded: TodayHabitCardData[] = [];
  const resolved: TodayHabitCardData[] = [];
  for (const habit of habits) {
    if (isHabitActionNeeded(habit)) actionNeeded.push(habit);
    else resolved.push(habit);
  }
  const byCreatedThenId = (a: TodayHabitCardData, b: TodayHabitCardData) => {
    if (a.createdAt !== b.createdAt) return a.createdAt < b.createdAt ? -1 : 1;
    if (a.id !== b.id) return a.id < b.id ? -1 : 1;
    return 0;
  };
  actionNeeded.sort(byCreatedThenId);
  resolved.sort(byCreatedThenId);
  return [...actionNeeded, ...resolved];
}

export function groupAndSortForToday(
  habits: TodayHabitCardData[],
): TodayGoalGroup[] {
  // Orphan filter: habits without an identity_phrase are not surfaced on Today.
  const eligible = habits.filter(
    (h) => h.identityPhrase !== null && h.identityPhrase !== "",
  );

  const byIdentity = new Map<string, TodayHabitCardData[]>();
  for (const habit of eligible) {
    const arr = byIdentity.get(habit.identityPhrase) ?? [];
    arr.push(habit);
    byIdentity.set(habit.identityPhrase, arr);
  }

  const groups: TodayGoalGroup[] = Array.from(byIdentity.entries()).map(
    ([identityPhrase, groupHabits]) => ({
      identityPhrase,
      habits: sortHabitsWithinGoal(groupHabits),
    }),
  );

  const active: TodayGoalGroup[] = [];
  const done: TodayGoalGroup[] = [];
  for (const group of groups) {
    if (isGoalActive(group.habits)) active.push(group);
    else done.push(group);
  }
  active.sort(compareGoals);
  done.sort(compareGoals);
  return [...active, ...done];
}
