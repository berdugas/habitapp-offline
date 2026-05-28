import React, { useMemo } from "react";
import { ChevronRight, Plus } from "lucide-react-native";
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
          ) : null}
          {/* Review pill (stacked above the daily pill). The slim green
              hint text was dropped; this pill carries the signal.
              Vertical gap to the daily pill comes from anchorSide.gap. */}
          {reviewDue && !reviewStatusError ? (
            <Pressable
              accessibilityLabel="Open weekly review"
              accessibilityRole="button"
              hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
              onPress={onGoalPress}
              disabled={!onGoalPress}
              style={({ pressed }) => [
                styles.pillReview,
                pressed && styles.pillReviewPressed,
              ]}
            >
              <Text style={styles.pillReviewText}>Weekly review</Text>
              <ChevronRight
                color={colors.primaryText}
                size={12}
                strokeWidth={2.25}
              />
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
          <View style={styles.donutColumn}>
            <ConsistencyDonut
              label="Goal consistency"
              onPress={onGoalPress}
              rate={consistencyRate}
              showAttentionDot={reviewDue && !reviewStatusError}
              tint={goalGraduated ? colors.graduatedCircle : undefined}
            />
          </View>
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
  donutColumn: {
    width: 80,
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
  pillReview: {
    alignItems: "center",
    alignSelf: "flex-start",
    backgroundColor: colors.primary,
    borderRadius: 99,
    elevation: 2,
    flexDirection: "row",
    gap: spacing.xs,
    paddingHorizontal: spacing.sm + 2,
    paddingVertical: spacing.xs - 1,
    shadowColor: colors.primary,
    shadowOffset: { height: 4, width: 0 },
    shadowOpacity: 0.18,
    shadowRadius: 8,
  },
  pillReviewPressed: {
    opacity: 0.85,
  },
  pillReviewText: {
    color: colors.primaryText,
    fontFamily: fontFamilies.bodySemi,
    fontSize: typography.micro,
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
