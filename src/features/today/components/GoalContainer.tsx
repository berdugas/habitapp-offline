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
  consistencyRate: number | null;
  goalGraduated?: boolean;
  identityPhrase: string;
  onAddHabit?: () => void;
  onGoalPress?: () => void;
  remainingCount: number;
  reviewDue?: boolean;
  reviewStatusError?: boolean;
  streak: number;
};

export function GoalContainer({
  banner,
  children,
  consistencyRate,
  goalGraduated = false,
  identityPhrase,
  onAddHabit,
  onGoalPress,
  remainingCount,
  reviewDue = false,
  reviewStatusError = false,
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
          <Text
            style={[styles.becomingText, goalGraduated && styles.becomingTextGraduated]}
          >
            Become {identityPhrase}
            {goalGraduated ? (
              <Text style={styles.graduatedSuffix}> (Graduated)</Text>
            ) : null}
          </Text>
          <Text style={styles.streakText}>{streakCopy}</Text>
          {/* Error wins over reviewDue: React Query keeps the last
              successful data when a refetch fails, so an errored status
              query can still expose data?.isDue=true. Showing "Review
              status unavailable" is the honest read in that case. */}
          {reviewStatusError ? (
            <Pressable onPress={onGoalPress} disabled={!onGoalPress}>
              <Text style={styles.reviewErrorHintText}>
                Review status unavailable
              </Text>
            </Pressable>
          ) : reviewDue ? (
            <Pressable onPress={onGoalPress} disabled={!onGoalPress}>
              <Text style={styles.reviewHintText}>Weekly review available</Text>
            </Pressable>
          ) : null}
          {remainingCount > 0 ? (
            <View style={styles.pill}>
              <Text style={styles.pillText}>{remainingCount} remaining to complete</Text>
            </View>
          ) : (
            <View style={[styles.pill, styles.pillComplete]}>
              <Text style={[styles.pillText, styles.pillTextComplete]}>All done ✓</Text>
            </View>
          )}
        </Pressable>
        {consistencyRate !== null ? (
          <ConsistencyDonut
            label="Goal consistency"
            onPress={onGoalPress}
            rate={consistencyRate}
            tint={goalGraduated ? colors.graduatedCircle : undefined}
            tintedBackground
          />
        ) : null}
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
  becomingTextGraduated: {
    color: colors.graduatedCircle,
  },
  graduatedSuffix: {
    color: colors.graduatedCircle,
    fontFamily: fontFamilies.body,
    fontSize: typography.micro,
    fontStyle: "italic",
    fontWeight: "400",
  },
  container: {
    backgroundColor: colors.surfaceMuted,
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
  reviewHintText: {
    color: colors.primary,
    fontFamily: fontFamilies.bodySemi,
    fontSize: typography.micro,
  },
  reviewErrorHintText: {
    color: colors.danger,
    fontFamily: fontFamilies.bodySemi,
    fontSize: typography.micro,
  },
  streakText: {
    color: colors.primary,
    fontFamily: fontFamilies.body,
    fontSize: typography.bodyMd,
  },
});
