import { StyleSheet, Text, View } from "react-native";

import { Eyebrow } from "@/components/text/Eyebrow";
import { HabitDiagnosticCard } from "@/features/reviews/components/HabitDiagnosticCard";
import { colors } from "@/theme/colors";
import { fontFamilies } from "@/theme/fontFamilies";
import { spacing } from "@/theme/spacing";
import { typography } from "@/theme/typography";

import type { HabitDiagnosticData } from "@/features/reviews/components/HabitDiagnosticCard";
import type { HabitWeekSummary } from "@/features/reviews/buildGoalWeekSummary";

type NeedsAttentionStepProps = {
  attentionHabits: HabitWeekSummary[];
  diagnostics: Map<string, HabitDiagnosticData>;
  onUpdateDiagnostic: (
    habitId: string,
    field: "triggerWorked" | "tinyActionTooHard",
    value: boolean | null,
  ) => void;
};

export function NeedsAttentionStep({
  attentionHabits,
  diagnostics,
  onUpdateDiagnostic,
}: NeedsAttentionStepProps) {
  return (
    <View style={styles.container}>
      <View style={styles.intro}>
        <Eyebrow label="What needs attention" />
        <Text style={styles.helper}>
          A couple of habits had a rough week. Let's name what got in the way.
        </Text>
      </View>

      {attentionHabits.map((habit) => {
        const data = diagnostics.get(habit.habitId) ?? {
          habitId: habit.habitId,
          triggerWorked: null,
          tinyActionTooHard: null,
        };
        return (
          <HabitDiagnosticCard
            diagnosticData={data}
            habit={habit}
            key={habit.habitId}
            onUpdate={onUpdateDiagnostic}
          />
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    gap: spacing.lg,
  },
  helper: {
    color: colors.textMuted,
    fontFamily: fontFamilies.body,
    fontSize: typography.bodyMd,
    lineHeight: 20,
  },
  intro: {
    gap: spacing.sm,
  },
});
