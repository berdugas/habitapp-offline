import { StyleSheet, Text, View } from "react-native";

import { useThemedStyles } from "@/theme/useThemedStyles";

/**
 * Replaces the old `GoalReflectionStep` on clean weeks (zero
 * struggling habits). The earlier step asked the user for an
 * optional free-text "experiment" to try. That framing implicitly
 * suggested change was due even when everything was working — which
 * fights the product's "Smaller than she thinks" principle and the
 * "Compound, do not graduate" model.
 *
 * The screen is purely declarative: headline + body, no input,
 * no inline buttons. The parent owns the Continue button via the
 * existing footer (same affordance used on Mirror and What's
 * Working). The catch-up effect on Week Complete entry writes the
 * empty `weekly_reviews` rows for every habit, so no write path is
 * needed here.
 *
 * The "zero active days" branch handles brand-new goals where no
 * day in the review week was active for any habit (e.g., custom
 * `active_days` not yet reached, or the review opens off a mature
 * habit while younger habits in the goal have no active days yet).
 * `getStepSequence` routes those cases through the same clean-week
 * branch (see `attentionHabits.length === 0`), so without the
 * branch here a brand-new goal would read "Every habit was on
 * track" — false when there were no days to be on track for.
 * `WeekCompleteStep` handles the same edge with its
 * "Your first week is just getting going." copy.
 */
type CleanWeekAffirmationStepProps = {
  /** True when at least one habit in the goal had at least one
   * active day in the review week. False indicates a brand-new
   * goal (or all-off week) where there's nothing to evaluate. */
  hasActiveDays: boolean;
};

export function CleanWeekAffirmationStep({
  hasActiveDays,
}: CleanWeekAffirmationStepProps) {
  const styles = useThemedStyles((theme) =>
    StyleSheet.create({
      body: {
        color: theme.colors.textMuted,
        fontFamily: theme.fontFamilies.body,
        fontSize: theme.typography.bodyMd,
        lineHeight: 18.6,
      },
      container: {
        gap: theme.spacing.sm,
      },
      headline: {
        color: theme.colors.text,
        fontFamily: theme.fontFamilies.displayBold,
        fontSize: theme.typography.headlineMd,
        letterSpacing: -0.2,
        lineHeight: 27.3,
      },
    }),
  );

  const headline = hasActiveDays ? "Solid week." : "Just getting started.";
  const body = hasActiveDays
    ? "Every habit was on track. Take the win and keep showing up."
    : "Your habits haven't run a full week yet. Keep showing up.";

  return (
    <View style={styles.container}>
      <Text style={styles.headline}>{headline}</Text>
      <Text style={styles.body}>{body}</Text>
    </View>
  );
}
