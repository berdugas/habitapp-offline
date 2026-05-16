import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";

import { useAuthSession } from "@/features/auth/hooks";
import { reactivateHabit } from "@/features/habits/api";
import {
  getLibraryQueryKey,
  invalidateHabitSurfaceQueries,
} from "@/features/habits/hooks";
import { parseActiveDays } from "@/features/habits/activeDays";
import { computePreGraduationConsistency, inclusiveDayCount } from "@/features/library/metrics";
import { listHabits } from "@/lib/db/repositories/habits";
import { listLogsForHabitInRange } from "@/lib/db/repositories/habit_logs";
import { getLatestSRHIResponse } from "@/lib/db/repositories/srhi_responses";
import { logger } from "@/services/logger";

import type { Habit } from "@/lib/db/repositories/habits";
import type { SRHIResponse } from "@/lib/db/repositories/srhi_responses";

export type LibraryHabit = {
  id: string;
  title: string;
  icon: string | null;
  identityPhrase: string | null;
  graduationDate: string; // ISO timestamp from automated_at
  lifetimeDays: number;
  preGraduationConsistency: number; // 0..1
  latestSRHI: SRHIResponse | null;
};

export type LibraryGoalGroup = {
  identityPhrase: string | null; // null → "Other"
  habits: LibraryHabit[];
  goalGraduated: boolean;
};

const OTHER_GROUP_KEY = "__other__";

async function fetchLibraryGroups(userId: string): Promise<LibraryGoalGroup[]> {
  const [graduatedHabits, allActiveHabits] = await Promise.all([
    listHabits({ user_id: userId, habit_state: "automatic", status: "active" }),
    listHabits({ user_id: userId, status: "active" }),
  ]);

  // Group active habits by identity_phrase for goalGraduated calc.
  const activeByGoal = new Map<string, Habit[]>();
  for (const habit of allActiveHabits) {
    const key = habit.identity_phrase ?? OTHER_GROUP_KEY;
    const bucket = activeByGoal.get(key) ?? [];
    bucket.push(habit);
    activeByGoal.set(key, bucket);
  }

  // Per-habit data (parallel).
  const enrichments = await Promise.all(
    graduatedHabits.map(async (habit) => {
      const graduationDate = habit.automated_at ?? habit.updated_at;
      const startDate = habit.start_date;
      const graduationDay = graduationDate.slice(0, 10);

      const [latestSRHI, logs] = await Promise.all([
        getLatestSRHIResponse(habit.id).catch((err) => {
          logger.warn("Library: latest SRHI fetch failed", { habitId: habit.id, err });
          return null;
        }),
        listLogsForHabitInRange(habit.id, startDate, graduationDay).catch(
          (err) => {
            logger.warn("Library: log range fetch failed", { habitId: habit.id, err });
            return [];
          },
        ),
      ]);

      const activeDays = parseActiveDays(habit.active_days);
      const preGraduationConsistency = computePreGraduationConsistency(
        logs,
        startDate,
        graduationDay,
        activeDays,
      );
      const lifetimeDays = inclusiveDayCount(startDate, graduationDay);

      const entry: LibraryHabit = {
        id: habit.id,
        title: habit.title,
        icon: habit.icon,
        identityPhrase: habit.identity_phrase,
        graduationDate,
        lifetimeDays,
        preGraduationConsistency,
        latestSRHI,
      };
      return entry;
    }),
  );

  // Group enrichments by identity_phrase, preserving null as "Other".
  const groupMap = new Map<string, LibraryHabit[]>();
  for (const entry of enrichments) {
    const key = entry.identityPhrase ?? OTHER_GROUP_KEY;
    const bucket = groupMap.get(key) ?? [];
    bucket.push(entry);
    groupMap.set(key, bucket);
  }

  const groups: LibraryGoalGroup[] = [];
  for (const [key, habits] of groupMap.entries()) {
    const isOther = key === OTHER_GROUP_KEY;
    const goalGraduated = isOther
      ? false
      : (() => {
          const allInGoal = activeByGoal.get(key) ?? [];
          if (allInGoal.length === 0) return false;
          return allInGoal.every((h) => h.habit_state === "automatic");
        })();
    groups.push({
      identityPhrase: isOther ? null : key,
      habits,
      goalGraduated,
    });
  }

  // Sort groups: most recent graduation first.
  groups.sort((a, b) => {
    const aMax = a.habits.reduce(
      (acc, h) => (h.graduationDate > acc ? h.graduationDate : acc),
      "",
    );
    const bMax = b.habits.reduce(
      (acc, h) => (h.graduationDate > acc ? h.graduationDate : acc),
      "",
    );
    return bMax.localeCompare(aMax);
  });

  // Inside each group: most recent first.
  for (const group of groups) {
    group.habits.sort((a, b) => b.graduationDate.localeCompare(a.graduationDate));
  }

  return groups;
}

export function useLibraryHabits() {
  const { user } = useAuthSession();

  return useQuery({
    enabled: Boolean(user?.id),
    queryFn: () => fetchLibraryGroups(user!.id),
    queryKey: getLibraryQueryKey(user?.id),
  });
}

export function useReactivateHabitMutation() {
  const { user } = useAuthSession();
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ habitId }: { habitId: string }) => {
      if (!user?.id) {
        throw new Error(
          "You need an account session before reactivating a habit.",
        );
      }
      return reactivateHabit(user.id, habitId);
    },
    onSuccess: async (_result, variables) => {
      if (!user?.id) return;
      await invalidateHabitSurfaceQueries(user.id, variables.habitId, queryClient);
    },
    onError: (error, variables) => {
      logger.error("Habit reactivate mutation failed", {
        error,
        habitId: variables.habitId,
        userId: user?.id ?? null,
      });
    },
  });
}
