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
  streak: number;
};

export function GoalContainer({
  banner,
  children,
  consistencyRate,
  identityPhrase,
  onAddHabit,
  streak,
}: GoalContainerProps) {
  const streakCopy = useMemo(() => getStreakCopy(streak), [streak]);

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <View style={styles.anchorSide}>
          <Text style={styles.becomingText}>Become {identityPhrase}</Text>
          <Text style={styles.streakText}>{streakCopy}</Text>
        </View>
        <ConsistencyDonut rate={consistencyRate} />
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
      <Text style={styles.hintText}>Long-press a circle to skip</Text>
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
    alignItems: "center",
    flexDirection: "row",
  },
  hintText: {
    color: colors.textFaint,
    fontFamily: fontFamilies.body,
    fontSize: typography.micro,
    paddingHorizontal: 2,
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
  streakText: {
    color: colors.primary,
    fontFamily: fontFamilies.body,
    fontSize: typography.bodyMd,
  },
});
