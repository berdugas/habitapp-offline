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
import { useTheme } from "@/theme/useTheme";
import { useThemedStyles } from "@/theme/useThemedStyles";

import type { Habit } from "@/lib/db/repositories/habits";

type ArchivedHabitCardProps = {
  habit: Habit;
};

export function ArchivedHabitCard({ habit }: ArchivedHabitCardProps) {
  const theme = useTheme();
  const styles = useThemedStyles((theme) =>
    StyleSheet.create({
      card: {
        backgroundColor: theme.colors.surfaceMuted,
        borderRadius: theme.radius.sm,
        gap: theme.spacing.xs,
        padding: theme.spacing.lg,
      },
      cardPressed: {
        opacity: 0.7,
      },
      goalText: {
        color: theme.colors.textFaint,
        fontFamily: theme.fontFamilies.body,
        fontSize: theme.typography.bodyMd,
      },
      metaText: {
        color: theme.colors.textFaint,
        fontFamily: theme.fontFamilies.body,
        fontSize: theme.typography.micro,
      },
      title: {
        color: theme.colors.textMuted,
        flex: 1,
        fontFamily: theme.fontFamilies.bodySemi,
        fontSize: theme.typography.bodyLg,
      },
      titleRow: {
        alignItems: "center",
        flexDirection: "row",
        gap: theme.spacing.sm,
      },
    }),
  );

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
      onPress={() =>
        router.push({
          pathname: "/(app)/habits/archived/[habitId]",
          params: { habitId: habit.id },
        })
      }
      style={({ pressed }) => [styles.card, pressed && styles.cardPressed]}
    >
      <View style={styles.titleRow}>
        {habit.icon ? (
          <LucideIcon
            name={habit.icon}
            size={18}
            color={theme.colors.textMuted}
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
