import { StyleSheet, Text, View } from "react-native";

import { LucideIcon } from "@/components/LucideIconPicker";
import { ZenCard } from "@/components/cards/ZenCard";
import { NullableBooleanField } from "@/components/forms/NullableBooleanField";
import { WeekStrip } from "@/features/reviews/components/WeekStrip";
import { colors } from "@/theme/colors";
import { fontFamilies } from "@/theme/fontFamilies";
import { spacing } from "@/theme/spacing";
import { typography } from "@/theme/typography";
import { getDayName } from "@/utils/dates";

import type {
  DayEntry,
  HabitWeekSummary,
} from "@/features/reviews/buildGoalWeekSummary";

export type HabitDiagnosticData = {
  habitId: string;
  triggerWorked: boolean | null;
  tinyActionTooHard: boolean | null;
};

type HabitDiagnosticCardProps = {
  habit: HabitWeekSummary;
  diagnosticData: HabitDiagnosticData;
  onUpdate: (
    habitId: string,
    field: "triggerWorked" | "tinyActionTooHard",
    value: boolean | null,
  ) => void;
};

export function formatMissedDays(days: DayEntry[]): string {
  const names = days
    .filter((d) => d.status === "missed")
    .map((d) => getDayName(d.dayOfWeek));
  if (names.length === 0) return "";
  if (names.length === 1) return `You missed ${names[0]}.`;
  if (names.length === 2) return `You missed ${names[0]} and ${names[1]}.`;
  const last = names[names.length - 1]!;
  const rest = names.slice(0, -1);
  return `You missed ${rest.join(", ")} and ${last}.`;
}

export function HabitDiagnosticCard({
  habit,
  diagnosticData,
  onUpdate,
}: HabitDiagnosticCardProps) {
  const missedCallout = formatMissedDays(habit.weekLogs);
  return (
    <ZenCard>
      <View style={styles.titleRow}>
        {habit.icon ? (
          <LucideIcon color={colors.text} name={habit.icon} size={18} />
        ) : null}
        <Text style={styles.title}>{habit.title}</Text>
      </View>
      <Text style={styles.count}>
        {habit.doneCount} of {habit.activeDayCount} days
      </Text>

      <WeekStrip
        activeDayCount={habit.activeDayCount}
        compact
        days={habit.weekLogs}
        doneCount={habit.doneCount}
        habitTitle={habit.title}
        icon={null}
      />

      {missedCallout ? (
        <Text style={styles.callout}>{missedCallout}</Text>
      ) : null}

      <View style={styles.fields}>
        <NullableBooleanField
          label="Did your trigger work this week?"
          onChange={(value) =>
            onUpdate(habit.habitId, "triggerWorked", value)
          }
          value={diagnosticData.triggerWorked}
        />
        <NullableBooleanField
          label="Was the tiny action too hard?"
          onChange={(value) =>
            onUpdate(habit.habitId, "tinyActionTooHard", value)
          }
          value={diagnosticData.tinyActionTooHard}
        />
      </View>
    </ZenCard>
  );
}

const styles = StyleSheet.create({
  callout: {
    color: colors.textMuted,
    fontFamily: fontFamilies.body,
    fontSize: typography.bodyMd,
    lineHeight: 20,
  },
  count: {
    color: colors.textMuted,
    fontFamily: fontFamilies.body,
    fontSize: typography.bodyMd,
  },
  fields: {
    gap: spacing.md,
  },
  title: {
    color: colors.text,
    flexShrink: 1,
    fontFamily: fontFamilies.bodySemi,
    fontSize: typography.bodyLg,
  },
  titleRow: {
    alignItems: "center",
    flexDirection: "row",
    gap: spacing.sm,
  },
});
