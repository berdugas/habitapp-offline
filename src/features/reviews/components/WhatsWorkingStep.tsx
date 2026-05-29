import { StyleSheet, Text, View } from "react-native";

import { LucideIcon } from "@/components/LucideIconPicker";
import { ZenCard } from "@/components/cards/ZenCard";
import { useThemedStyles } from "@/theme/useThemedStyles";
import { useTheme } from "@/theme/useTheme";

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
  const theme = useTheme();
  const styles = useThemedStyles((t) =>
    StyleSheet.create({
      closing: {
        color: t.colors.textMuted,
        fontFamily: t.fontFamilies.body,
        fontSize: t.typography.bodyMd,
        lineHeight: 18.6,
      },
      headline: {
        color: t.colors.text,
        fontFamily: t.fontFamilies.displayBold,
        fontSize: t.typography.headlineMd,
        letterSpacing: -0.2,
        lineHeight: 25.5,
      },
      count: {
        color: t.colors.primary,
        fontFamily: t.fontFamilies.bodySemi,
        fontSize: t.typography.bodyMd,
      },
      item: {
        gap: t.spacing.xs,
      },
      list: {
        gap: t.spacing.lg,
      },
      message: {
        color: t.colors.textMuted,
        fontFamily: t.fontFamilies.body,
        fontSize: t.typography.bodyMd,
        fontStyle: "italic",
        lineHeight: 18.6,
      },
      title: {
        color: t.colors.text,
        fontFamily: t.fontFamilies.bodySemi,
        fontSize: t.typography.bodyMd,
      },
      titleRow: {
        alignItems: "center",
        flexDirection: "row",
        gap: t.spacing.xs,
      },
    }),
  );

  return (
    <ZenCard>
      {/* Promoted from the small uppercase eyebrow to a display-bold
       * headline — the section title IS the screen's anchor here
       * (no separate hero below), and "What's working" reads better
       * as a confident statement than as a quiet category tag. */}
      <Text style={styles.headline}>What's working</Text>

      <View style={styles.list}>
        {strongHabits.map((habit) => (
          <View key={habit.habitId} style={styles.item}>
            <View style={styles.titleRow}>
              {habit.icon ? (
                <LucideIcon color={theme.colors.text} name={habit.icon} size={16} />
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

