import { useQuery } from "@tanstack/react-query";
import { Pressable, StyleSheet, Text, View } from "react-native";
import { router } from "expo-router";

import { LucideIcon } from "@/components/LucideIconPicker";
import { useAuthSession } from "@/features/auth/hooks";
import { getHabitLogsForHabitInRange } from "@/features/habits/api";
import {
  formatExactDate,
  inclusiveDayCount,
} from "@/features/library/metrics";
import { colors } from "@/theme/colors";
import { fontFamilies } from "@/theme/fontFamilies";
import { radius } from "@/theme/radius";
import { spacing } from "@/theme/spacing";
import { typography } from "@/theme/typography";

import type { Habit } from "@/lib/db/repositories/habits";

type ArchivedHabitCardProps = {
  habit: Habit;
};

export function ArchivedHabitCard({ habit }: ArchivedHabitCardProps) {
  const { user } = useAuthSession();
  const archivedAt = habit.archived_at ?? habit.updated_at;
  const archivedDay = archivedAt.slice(0, 10);

  const logsQuery = useQuery({
    enabled: Boolean(user?.id),
    queryFn: () =>
      getHabitLogsForHabitInRange(
        user!.id,
        habit.id,
        habit.start_date,
        archivedDay,
      ),
    queryKey: [
      "habit-logs",
      "archived-summary",
      user?.id ?? "guest",
      habit.id,
      habit.start_date,
      archivedDay,
    ],
  });

  const doneCount = (logsQuery.data ?? []).filter(
    (log) => log.status === "done",
  ).length;
  const lifetimeDays = inclusiveDayCount(habit.start_date, archivedDay);

  return (
    <Pressable
      accessibilityLabel={`Open ${habit.title}`}
      accessibilityRole="button"
      onPress={() => router.push(`/(app)/habits/${habit.id}`)}
      style={({ pressed }) => [styles.card, pressed && styles.cardPressed]}
    >
      <View style={styles.titleRow}>
        {habit.icon ? (
          <LucideIcon
            name={habit.icon}
            size={18}
            color={colors.textMuted}
            strokeWidth={1.75}
          />
        ) : null}
        <Text style={styles.title}>{habit.title}</Text>
      </View>
      {habit.identity_phrase ? (
        <Text style={styles.goalText}>Become {habit.identity_phrase}</Text>
      ) : null}
      <Text style={styles.metaText}>Archived {formatExactDate(archivedAt)}</Text>
      {logsQuery.isSuccess ? (
        <Text style={styles.metaText}>
          {doneCount} day{doneCount === 1 ? "" : "s"} completed over{" "}
          {lifetimeDays} day{lifetimeDays === 1 ? "" : "s"}
        </Text>
      ) : null}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: colors.surfaceMuted,
    borderRadius: radius.sm,
    gap: spacing.xs,
    padding: spacing.lg,
  },
  cardPressed: {
    opacity: 0.7,
  },
  goalText: {
    color: colors.textFaint,
    fontFamily: fontFamilies.body,
    fontSize: typography.bodyMd,
  },
  metaText: {
    color: colors.textFaint,
    fontFamily: fontFamilies.body,
    fontSize: typography.micro,
  },
  title: {
    color: colors.textMuted,
    flex: 1,
    fontFamily: fontFamilies.bodySemi,
    fontSize: typography.bodyLg,
  },
  titleRow: {
    alignItems: "center",
    flexDirection: "row",
    gap: spacing.sm,
  },
});
