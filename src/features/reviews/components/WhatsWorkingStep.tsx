import { StyleSheet, Text, View } from "react-native";

import { LucideIcon } from "@/components/LucideIconPicker";
import { ZenCard } from "@/components/cards/ZenCard";
import { Eyebrow } from "@/components/text/Eyebrow";
import { colors } from "@/theme/colors";
import { fontFamilies } from "@/theme/fontFamilies";
import { spacing } from "@/theme/spacing";
import { typography } from "@/theme/typography";

import type { HabitWeekSummary } from "@/features/reviews/buildGoalWeekSummary";

type WhatsWorkingStepProps = {
  strongHabits: HabitWeekSummary[];
};

function getStrongHabitMessage(habit: HabitWeekSummary): string {
  if (habit.weekConsistency === 1) {
    return "Perfect week. Your routine is holding.";
  }
  if (habit.skipCount > 0) {
    return `You used ${habit.skipCount} intentional skip${
      habit.skipCount > 1 ? "s" : ""
    } — that's healthy flexibility.`;
  }
  return "Solid consistency. This one is becoming part of your rhythm.";
}

export function WhatsWorkingStep({ strongHabits }: WhatsWorkingStepProps) {
  return (
    <ZenCard>
      <Eyebrow label="What's working" />

      <View style={styles.list}>
        {strongHabits.map((habit) => (
          <View key={habit.habitId} style={styles.item}>
            <View style={styles.titleRow}>
              {habit.icon ? (
                <LucideIcon color={colors.text} name={habit.icon} size={16} />
              ) : null}
              <Text style={styles.title}>{habit.title}</Text>
            </View>
            <Text style={styles.count}>
              {habit.doneCount} of {habit.activeDayCount} days
            </Text>
            <Text style={styles.message}>{getStrongHabitMessage(habit)}</Text>
          </View>
        ))}
      </View>

      <Text style={styles.closing}>
        Keep these stable. Consistency is more valuable than intensity.
      </Text>
    </ZenCard>
  );
}

const styles = StyleSheet.create({
  closing: {
    color: colors.textMuted,
    fontFamily: fontFamilies.body,
    fontSize: typography.bodyMd,
    lineHeight: 20,
  },
  count: {
    color: colors.primary,
    fontFamily: fontFamilies.bodySemi,
    fontSize: typography.bodyMd,
  },
  item: {
    gap: spacing.xs,
  },
  list: {
    gap: spacing.lg,
  },
  message: {
    color: colors.textMuted,
    fontFamily: fontFamilies.body,
    fontSize: typography.bodyMd,
    fontStyle: "italic",
    lineHeight: 20,
  },
  title: {
    color: colors.text,
    fontFamily: fontFamilies.bodySemi,
    fontSize: typography.bodyMd,
  },
  titleRow: {
    alignItems: "center",
    flexDirection: "row",
    gap: spacing.xs,
  },
});
