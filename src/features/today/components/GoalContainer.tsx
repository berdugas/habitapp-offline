import React, { useMemo } from "react";
import { Plus } from "lucide-react-native";
import { Pressable, StyleSheet, Text, View } from "react-native";

import { ConsistencyDonut } from "@/features/today/components/ConsistencyDonut";
import { getStreakCopy } from "@/features/today/streakCopy";
import { colors } from "@/theme/colors";
import { fontFamilies } from "@/theme/fontFamilies";
import { spacing } from "@/theme/spacing";
import { typography } from "@/theme/typography";

type GoalContainerProps = {
  banner?: React.ReactNode;
  children: React.ReactNode;
  consistencyRate: number;
  identityPhrase: string;
  onAddHabit?: () => void;
  onGoalPress?: () => void;
  remainingCount: number;
  streak: number;
};

export function GoalContainer({
  banner,
  children,
  consistencyRate,
  identityPhrase,
  onAddHabit,
  onGoalPress,
  remainingCount,
  streak,
}: GoalContainerProps) {
  const streakCopy = useMemo(() => getStreakCopy(streak), [streak]);

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <Pressable
          onPress={onGoalPress}
          style={styles.anchorSide}
          disabled={!onGoalPress}
        >
          <Text style={styles.becomingText}>Become {identityPhrase}</Text>
          <Text style={styles.streakText}>{streakCopy}</Text>
          {remainingCount > 0 ? (
            <View style={styles.pill}>
              <Text style={styles.pillText}>{remainingCount} remaining</Text>
            </View>
          ) : (
            <View style={[styles.pill, styles.pillComplete]}>
              <Text style={[styles.pillText, styles.pillTextComplete]}>All done ✓</Text>
            </View>
          )}
        </Pressable>
        <ConsistencyDonut
          label="Goal consistency"
          onPress={onGoalPress}
          rate={consistencyRate}
        />
      </View>
      {banner ?? null}
      <View style={styles.habitsCard}>
        {children}
        {onAddHabit ? (
          <Pressable
            onPress={onAddHabit}
            style={({ pressed }) => [styles.addHabitRow, pressed && styles.addHabitRowPressed]}
            accessibilityLabel="Add a habit"
          >
            <Plus color={colors.textMuted} size={16} strokeWidth={1.75} />
            <Text style={styles.addHabitText}>Add a habit</Text>
          </Pressable>
        ) : null}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  anchorSide: {
    flex: 1,
    gap: spacing.xs,
    paddingRight: spacing.lg,
  },
  becomingText: {
    color: colors.text,
    fontFamily: fontFamilies.bodyMedium,
    fontSize: 21,
    fontWeight: "500",
  },
  container: {
    backgroundColor: colors.surface,
    borderRadius: 20,
    gap: spacing.md,
    padding: spacing.lg,
  },
  habitsCard: {
    backgroundColor: colors.surfaceCard,
    borderRadius: 14,
    overflow: "hidden",
  },
  header: {
    alignItems: "flex-start",
    flexDirection: "row",
  },
  addHabitRow: {
    alignItems: "center",
    borderTopColor: colors.surface,
    borderTopWidth: StyleSheet.hairlineWidth,
    flexDirection: "row",
    gap: spacing.sm,
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.md + 2,
  },
  addHabitRowPressed: {
    backgroundColor: colors.surface,
  },
  addHabitText: {
    color: colors.textMuted,
    fontFamily: fontFamilies.body,
    fontSize: 14,
  },
  pill: {
    alignSelf: "flex-start",
    backgroundColor: colors.surfaceHigh,
    borderRadius: 99,
    paddingHorizontal: spacing.sm + 2,
    paddingVertical: spacing.xs - 1,
  },
  pillComplete: {
    backgroundColor: colors.primaryLight,
  },
  pillText: {
    color: colors.textMuted,
    fontFamily: fontFamilies.body,
    fontSize: typography.micro,
  },
  pillTextComplete: {
    color: colors.primary,
    fontFamily: fontFamilies.bodyMedium,
  },
  streakText: {
    color: colors.primary,
    fontFamily: fontFamilies.body,
    fontSize: typography.bodyMd,
  },
});
