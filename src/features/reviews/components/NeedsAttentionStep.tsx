import { StyleSheet, Text, View } from "react-native";

import { Eyebrow } from "@/components/text/Eyebrow";
import { FirstRunTipBanner } from "@/features/reviews/components/FirstRunTipBanner";
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
  showFirstRunTip?: boolean;
  onDismissFirstRunTip?: () => void;
};

export function NeedsAttentionStep({
  attentionHabits,
  diagnostics,
  onUpdateDiagnostic,
  showFirstRunTip,
  onDismissFirstRunTip,
}: NeedsAttentionStepProps) {
  return (
    <View style={styles.container}>
      {showFirstRunTip && onDismissFirstRunTip ? (
        <FirstRunTipBanner
          message="These didn't stick this week. That's a clue, not a verdict — next step we'll diagnose what's getting in the way."
          onDismiss={onDismissFirstRunTip}
          testID="needs-attention-first-run-tip"
        />
      ) : null}
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
