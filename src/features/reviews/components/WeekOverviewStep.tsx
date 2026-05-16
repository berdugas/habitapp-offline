import { StyleSheet, Text, View } from "react-native";

import { ZenCard } from "@/components/cards/ZenCard";
import { Eyebrow } from "@/components/text/Eyebrow";
import { WeekStrip } from "@/features/reviews/components/WeekStrip";
import { colors } from "@/theme/colors";
import { fontFamilies } from "@/theme/fontFamilies";
import { spacing } from "@/theme/spacing";
import { typography } from "@/theme/typography";

import type { GoalWeekSummary } from "@/features/reviews/buildGoalWeekSummary";

type WeekOverviewStepProps = {
  summary: GoalWeekSummary;
};

const DAY_LABELS = ["M", "T", "W", "T", "F", "S", "S"];

function getSummaryLine(summary: GoalWeekSummary): string {
  const { totalDaysShowedUp, identityPhrase } = summary;
  if (totalDaysShowedUp === 7) {
    return "You showed up every day this week.";
  }
  return `You showed up as ${identityPhrase} on ${totalDaysShowedUp} of 7 days this week.`;
}

export function WeekOverviewStep({ summary }: WeekOverviewStepProps) {
  return (
    <ZenCard>
      <Eyebrow label="Your week" />
      <Text style={styles.identity}>Become {summary.identityPhrase}</Text>

      <View style={styles.dayLabelsRow}>
        <View style={styles.dayLabelsSpacer} />
        <View style={styles.dayLabelsCells}>
          {DAY_LABELS.map((label, i) => (
            <Text key={i} style={styles.dayLabel}>
              {label}
            </Text>
          ))}
        </View>
        <View style={styles.dayLabelsSpacer} />
      </View>

      <View style={styles.stripsList}>
        {summary.habits.map((habit) => (
          <WeekStrip
            activeDayCount={habit.activeDayCount}
            days={habit.weekLogs}
            doneCount={habit.doneCount}
            habitTitle={habit.title}
            icon={habit.icon}
            key={habit.habitId}
          />
        ))}
      </View>

      <View style={styles.divider} />

      <Text style={styles.summaryLine}>{getSummaryLine(summary)}</Text>
    </ZenCard>
  );
}

const styles = StyleSheet.create({
  dayLabel: {
    color: colors.textFaint,
    fontFamily: fontFamilies.bodyBold,
    fontSize: typography.micro,
    letterSpacing: 0.6,
    textAlign: "center",
    width: 20,
  },
  dayLabelsCells: {
    flexDirection: "row",
    gap: spacing.xs,
  },
  dayLabelsRow: {
    alignItems: "center",
    flexDirection: "row",
  },
  dayLabelsSpacer: {
    flex: 1,
  },
  divider: {
    backgroundColor: colors.surface,
    height: 1,
    width: "100%",
  },
  identity: {
    color: colors.text,
    fontFamily: fontFamilies.displaySemi,
    fontSize: typography.headlineMd,
  },
  stripsList: {
    gap: spacing.md,
  },
  summaryLine: {
    color: colors.textMuted,
    fontFamily: fontFamilies.body,
    fontSize: typography.bodyLg,
    fontStyle: "italic",
    lineHeight: 24,
  },
});
