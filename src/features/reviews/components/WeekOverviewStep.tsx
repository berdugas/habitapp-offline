import { StyleSheet, Text, View } from "react-native";

import { ZenCard } from "@/components/cards/ZenCard";
import { Eyebrow } from "@/components/text/Eyebrow";
import { WeekStrip } from "@/features/reviews/components/WeekStrip";
import { useThemedStyles } from "@/theme/useThemedStyles";

import type {
  GoalWeekSummary,
  HabitWeekSummary,
} from "@/features/reviews/buildGoalWeekSummary";

type WeekOverviewStepProps = {
  summary: GoalWeekSummary;
};

const DAY_LABELS = ["M", "T", "W", "T", "F", "S", "S"];

// Cap habit names so the interpretation line doesn't sprawl when several
// habits are strong or struggling. We fall back to a count-only phrasing
// when the list exceeds this.
const MAX_NAMED_HABITS = 3;

export function getHeadline(summary: GoalWeekSummary): string {
  const strong = summary.strongHabits.length;
  const attention = summary.attentionHabits.length;
  const total = summary.habits.length;

  if (total === 0) return "Your week.";
  if (strong === total) return "Steady all week.";
  if (attention === total) return "A reset week.";
  if (strong > 0 && attention === 0) return "Steady all week."; // mid-band rolls into the calm read
  if (strong > attention) return "Mostly steady.";
  if (attention > strong && strong > 0) return "A few to tune up.";
  if (attention > 0 && strong === 0) return "A few to tune up.";
  return "A mixed week.";
}

function joinNames(names: string[]): string {
  if (names.length === 0) return "";
  if (names.length === 1) return names[0]!;
  if (names.length === 2) return `${names[0]} and ${names[1]}`;
  const last = names[names.length - 1]!;
  const rest = names.slice(0, -1);
  return `${rest.join(", ")} and ${last}`;
}

function describeBucket(
  habits: HabitWeekSummary[],
  predicate: "strong" | "attention",
): string {
  if (habits.length === 0) return "";
  if (habits.length <= MAX_NAMED_HABITS) {
    return joinNames(habits.map((h) => h.title));
  }
  return predicate === "strong"
    ? `${habits.length} habits`
    : `${habits.length} habits`;
}

function tweakVerb(count: number): string {
  return count === 1 ? "needs" : "need";
}

export function getInterpretationLine(summary: GoalWeekSummary): string {
  const strong = summary.strongHabits;
  const attention = summary.attentionHabits;

  if (strong.length === 0 && attention.length === 0) {
    return "Everything held this week.";
  }
  if (strong.length === 0) {
    if (attention.length <= MAX_NAMED_HABITS) {
      const names = joinNames(attention.map((h) => h.title));
      return `${names} ${tweakVerb(attention.length)} a tweak.`;
    }
    return `${attention.length} habits need adjusting.`;
  }
  if (attention.length === 0) {
    const names = describeBucket(strong, "strong");
    return `You held ${names}.`;
  }
  const heldText =
    strong.length <= MAX_NAMED_HABITS
      ? `You held ${joinNames(strong.map((h) => h.title))}.`
      : `You held ${strong.length} habits.`;
  const adjustText =
    attention.length <= MAX_NAMED_HABITS
      ? `${joinNames(attention.map((h) => h.title))} ${tweakVerb(attention.length)} a tweak.`
      : `${attention.length} need adjusting.`;
  return `${heldText} ${adjustText}`;
}

export function getAgendaLine(summary: GoalWeekSummary): string {
  const attention = summary.attentionHabits.length;
  if (attention === 0) return "Everything's in good shape this week.";
  const habitWord = attention === 1 ? "habit" : "habits";
  if (summary.strongHabits.length === 0) {
    return `Next: let's adjust ${attention} ${habitWord} together.`;
  }
  return `Next: see what worked, then adjust ${attention} ${habitWord}.`;
}

export function WeekOverviewStep({ summary }: WeekOverviewStepProps) {
  const styles = useThemedStyles((theme) =>
    StyleSheet.create({
      agenda: {
        color: theme.colors.textMuted,
        fontFamily: theme.fontFamilies.body,
        fontSize: theme.typography.bodyMd,
        fontStyle: "italic",
        lineHeight: 20.4,
      },
      container: {
        gap: theme.spacing.lg,
      },
      dayLabel: {
        color: theme.colors.textFaint,
        fontFamily: theme.fontFamilies.bodyBold,
        fontSize: theme.typography.micro,
        letterSpacing: 0.6,
        textAlign: "center",
        width: 20,
      },
      dayLabelsCells: {
        flexDirection: "row",
        gap: theme.spacing.xs,
      },
      dayLabelsRow: {
        alignItems: "center",
        flexDirection: "row",
      },
      dayLabelsSpacer: {
        flex: 1,
      },
      headline: {
        color: theme.colors.text,
        fontFamily: theme.fontFamilies.displaySemi,
        fontSize: theme.typography.headlineMd,
      },
      interpretation: {
        color: theme.colors.textMuted,
        fontFamily: theme.fontFamilies.body,
        fontSize: theme.typography.bodyLg,
        lineHeight: 21,
      },
      intro: {
        gap: theme.spacing.sm,
      },
      stripsList: {
        gap: theme.spacing.md,
      },
    }),
  );

  return (
    <View style={styles.container}>
      <View style={styles.intro}>
        <Eyebrow label="Your week" />
        <Text style={styles.headline}>{getHeadline(summary)}</Text>
        <Text style={styles.interpretation}>
          {getInterpretationLine(summary)}
        </Text>
      </View>

      <ZenCard>
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
      </ZenCard>

      <Text style={styles.agenda}>{getAgendaLine(summary)}</Text>
    </View>
  );
}

