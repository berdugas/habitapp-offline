import { ScrollView, StyleSheet, Text, View, Pressable } from "react-native";
import { ChevronLeft } from "lucide-react-native";
import { router, useLocalSearchParams } from "expo-router";

import { MiniHeatmapStrip } from "@/components/MiniHeatmapStrip";
import { ReadOnlyBanner } from "@/components/ReadOnlyBanner";
import { SecondaryButton } from "@/components/buttons/SecondaryButton";
import { ZenCard } from "@/components/cards/ZenCard";
import { ErrorState } from "@/components/feedback/ErrorState";
import { LoadingState } from "@/components/feedback/LoadingState";
import { Eyebrow } from "@/components/text/Eyebrow";
import { LucideIcon } from "@/components/LucideIconPicker";
import { ConsistencyDonut } from "@/features/today/components/ConsistencyDonut";
import { useGoalDetail } from "@/features/today/hooks";
import { getStreakCopy } from "@/features/today/streakCopy";
import { isActiveDay } from "@/features/habits/activeDays";
import { useTrialValidation } from "@/features/trial/hooks";
import { now } from "@/utils/clock";
import { colors } from "@/theme/colors";
import { fontFamilies } from "@/theme/fontFamilies";
import { spacing } from "@/theme/spacing";
import { typography } from "@/theme/typography";

export default function GoalDetailScreen() {
  const { identityPhrase: rawParam } = useLocalSearchParams<{ identityPhrase?: string }>();
  const identityPhrase = rawParam ? decodeURIComponent(rawParam as string) : undefined;

  const { accessMode, isValidating, refresh } = useTrialValidation();
  const isReadOnly = accessMode === "read_only";

  const { error, goalConsistencyRate, goalStreak, habits, isLoading } = useGoalDetail(identityPhrase);

  if (isLoading) {
    return <LoadingState message="Loading goal..." />;
  }

  if (error) {
    return (
      <ScrollView contentContainerStyle={styles.content} style={styles.screen}>
        <View style={styles.backRow}>
          <Pressable onPress={() => router.back()} style={styles.backButton}>
            <ChevronLeft color={colors.textMuted} size={22} strokeWidth={1.75} />
          </Pressable>
        </View>
        <ErrorState message="We couldn't load this goal right now. Try again." />
        <SecondaryButton label="Back to Today" onPress={() => router.push("/(app)/(tabs)/today")} />
      </ScrollView>
    );
  }

  // Determine consistency suppression: oldest habit's active day count
  const oldestActiveDaysCount = (() => {
    if (habits.length === 0) return 0;
    const oldest = [...habits].sort((a, b) => a.startDate.localeCompare(b.startDate))[0];
    if (!oldest) return 0;
    const start = new Date(`${oldest.startDate}T12:00:00`);
    const today = now();
    today.setHours(0, 0, 0, 0);
    let count = 0;
    const d = new Date(start);
    d.setHours(0, 0, 0, 0);
    while (d <= today) {
      if (isActiveDay(d, oldest.activeDays)) count++;
      d.setDate(d.getDate() + 1);
    }
    return count;
  })();

  return (
    <ScrollView
      contentContainerStyle={styles.content}
      contentInsetAdjustmentBehavior="automatic"
      style={styles.screen}
    >
      {isReadOnly ? (
        <ReadOnlyBanner
          isReconnecting={isValidating}
          onReconnect={() => void refresh()}
        />
      ) : null}

      {/* Header */}
      <View style={styles.header}>
        <Pressable onPress={() => router.back()} style={styles.backButton}>
          <ChevronLeft color={colors.textMuted} size={22} strokeWidth={1.75} />
        </Pressable>
        <Text style={styles.headlineText}>
          Become {identityPhrase ?? ""}
        </Text>
        <Text style={styles.streakCopyText}>{getStreakCopy(goalStreak)}</Text>
      </View>

      {/* Goal metrics */}
      <View style={styles.metricsRow}>
        <ZenCard style={styles.metricCard}>
          <Eyebrow label="Goal consistency" />
          <View style={styles.metricCenter}>
            {oldestActiveDaysCount >= 7 ? (
              <ConsistencyDonut rate={goalConsistencyRate} size={40} label="" />
            ) : (
              <Text style={styles.tooEarlyText}>
                Too early to tell — keep showing up
              </Text>
            )}
          </View>
        </ZenCard>
        <ZenCard style={styles.metricCard}>
          <Eyebrow label="Goal streak" />
          <View style={styles.metricCenter}>
            <Text style={styles.streakLargeNumber}>{goalStreak}</Text>
          </View>
        </ZenCard>
      </View>

      {/* Habits in this goal */}
      {habits.length > 0 ? (
        <View>
          <Eyebrow label="Habits in this goal" />
          <ZenCard style={styles.habitsCard} gap={0}>
            {habits.map((habit, i) => (
              <Pressable
                key={habit.id}
                onPress={() =>
                  router.push({
                    pathname: "/(app)/habits/[habitId]",
                    params: {
                      habitId: habit.id,
                      goalConsistency: String(goalConsistencyRate),
                    },
                  })
                }
                style={({ pressed }) => [
                  styles.habitRow,
                  i > 0 && styles.habitRowBorder,
                  pressed && styles.habitRowPressed,
                ]}
              >
                <View style={styles.habitRowContent}>
                  <View style={styles.habitNameRow}>
                    {habit.icon ? (
                      <LucideIcon name={habit.icon} size={16} color={colors.primary} strokeWidth={1.75} />
                    ) : null}
                    <Text style={styles.habitName}>{habit.name}</Text>
                  </View>
                  <Text style={styles.habitSubtitle}>
                    {Math.round(habit.consistencyRate * 100)}% · {habit.streak} days
                  </Text>
                  <MiniHeatmapStrip
                    activeDays={habit.activeDays}
                    logs={habit.logs}
                    startDate={habit.startDate}
                  />
                </View>
                <Text style={styles.chevron}>›</Text>
              </Pressable>
            ))}
          </ZenCard>
        </View>
      ) : (
        <ZenCard>
          <Text style={styles.emptyText}>No habits found for this goal.</Text>
        </ZenCard>
      )}

      <SecondaryButton
        label="Back to Today"
        onPress={() => router.push("/(app)/(tabs)/today")}
      />
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  backButton: {
    alignItems: "center",
    height: 36,
    justifyContent: "center",
    width: 36,
  },
  backRow: {
    marginBottom: spacing.sm,
  },
  chevron: {
    color: colors.textFaint,
    fontFamily: fontFamilies.body,
    fontSize: 20,
  },
  content: {
    gap: spacing.xl,
    padding: spacing.xl,
  },
  emptyText: {
    color: colors.textMuted,
    fontFamily: fontFamilies.body,
    fontSize: typography.bodyMd,
    textAlign: "center",
  },
  habitName: {
    color: colors.text,
    flexShrink: 1,
    fontFamily: fontFamilies.bodySemi,
    fontSize: typography.bodyMd,
  },
  habitNameRow: {
    alignItems: "center",
    flexDirection: "row",
    gap: spacing.xs,
  },
  habitRow: {
    alignItems: "center",
    flexDirection: "row",
    justifyContent: "space-between",
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.md,
  },
  habitRowBorder: {
    borderTopColor: colors.surface,
    borderTopWidth: StyleSheet.hairlineWidth,
  },
  habitRowContent: {
    flex: 1,
    gap: spacing.xs,
    paddingRight: spacing.sm,
  },
  habitRowPressed: {
    backgroundColor: colors.surface,
  },
  habitsCard: {
    marginTop: spacing.sm,
    overflow: "hidden",
  },
  habitSubtitle: {
    color: colors.textMuted,
    fontFamily: fontFamilies.body,
    fontSize: typography.micro,
  },
  header: {
    gap: spacing.xs,
  },
  headlineText: {
    color: colors.text,
    fontFamily: fontFamilies.displayBold,
    fontSize: typography.headlineLg,
  },
  metricCard: {
    flex: 1,
  },
  metricCenter: {
    alignItems: "center",
    justifyContent: "center",
    marginTop: spacing.sm,
    minHeight: 60,
  },
  metricsRow: {
    flexDirection: "row",
    gap: spacing.md,
  },
  screen: {
    backgroundColor: colors.bg,
    flex: 1,
  },
  streakCopyText: {
    color: colors.primary,
    fontFamily: fontFamilies.body,
    fontStyle: "italic",
    fontSize: typography.bodyMd,
  },
  streakLargeNumber: {
    color: colors.text,
    fontFamily: fontFamilies.displayBold,
    fontSize: typography.headlineLg,
  },
  tooEarlyText: {
    color: colors.textMuted,
    fontFamily: fontFamilies.body,
    fontSize: typography.bodyMd,
    fontStyle: "italic",
    textAlign: "center",
  },
});
