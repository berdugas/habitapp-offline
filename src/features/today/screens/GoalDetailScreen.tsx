import { ScrollView, StyleSheet, Text, View, Pressable } from "react-native";
import { ChevronLeft } from "lucide-react-native";
import { router, useLocalSearchParams } from "expo-router";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { MiniHeatmapStrip } from "@/components/MiniHeatmapStrip";
import { ReadOnlyBanner } from "@/components/ReadOnlyBanner";
import { SecondaryButton } from "@/components/buttons/SecondaryButton";
import { TertiaryButton } from "@/components/buttons/TertiaryButton";
import { ZenCard } from "@/components/cards/ZenCard";
import { ErrorState } from "@/components/feedback/ErrorState";
import { LoadingState } from "@/components/feedback/LoadingState";
import { Eyebrow } from "@/components/text/Eyebrow";
import { LucideIcon } from "@/components/LucideIconPicker";
import { ConsistencyDonut } from "@/features/today/components/ConsistencyDonut";
import { GoalStreakStrip } from "@/features/today/components/GoalStreakStrip";
import { WeeklyConsistencyChart } from "@/features/today/components/WeeklyConsistencyChart";
import { getGoalNarrative } from "@/features/today/goalNarrativeCopy";
import { PrimaryButton } from "@/components/buttons/PrimaryButton";
import { useGoalReviewStatusQuery } from "@/features/reviews/hooks";
import { useGoalDetail } from "@/features/today/hooks";
import { getStreakCopy } from "@/features/today/streakCopy";
import { useTrialValidation } from "@/features/trial/hooks";
import { colors } from "@/theme/colors";
import { fontFamilies } from "@/theme/fontFamilies";
import { spacing } from "@/theme/spacing";
import { typography } from "@/theme/typography";

export default function GoalDetailScreen() {
  const { identityPhrase: rawParam } = useLocalSearchParams<{ identityPhrase?: string }>();
  const identityPhrase = rawParam ? decodeURIComponent(rawParam as string) : undefined;
  const insets = useSafeAreaInsets();

  const { accessMode, isValidating, refresh } = useTrialValidation();
  const isReadOnly = accessMode === "read_only";

  const {
    error,
    goalConsistencyRate,
    goalDailyStates,
    goalGraduated,
    goalStreak,
    habits,
    isLoading,
    oldestActiveDaysCount,
    weeklyData,
  } = useGoalDetail(identityPhrase);

  const goalReviewStatus = useGoalReviewStatusQuery(identityPhrase);

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
        <TertiaryButton label="Back to Today" onPress={() => router.push("/(app)/(tabs)/today")} />
      </ScrollView>
    );
  }

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
      <View style={[styles.header, { paddingTop: insets.top }]}>
        <Pressable hitSlop={12} onPress={() => router.back()} style={styles.backButton}>
          <ChevronLeft color={colors.textMuted} size={22} strokeWidth={1.75} />
        </Pressable>
        <Text
          style={[styles.headlineText, goalGraduated && styles.headlineTextGraduated]}
        >
          Become {identityPhrase ?? ""}
          {goalGraduated ? (
            <Text style={styles.graduatedSuffix}> (Graduated)</Text>
          ) : null}
        </Text>
        <Text style={styles.streakCopyText}>{getStreakCopy(goalStreak)}</Text>
      </View>

      {/* Journey Card */}
      <ZenCard style={styles.journeyCard}>
        <View style={styles.journeyTop}>
          <ConsistencyDonut
            rate={goalConsistencyRate ?? 0}
            size={56}
            label=""
            tint={goalGraduated ? colors.graduatedCircle : undefined}
          />
          <Text style={styles.narrativeText}>
            {getGoalNarrative(goalConsistencyRate, oldestActiveDaysCount)}
          </Text>
        </View>

        {weeklyData.length >= 1 ? (
          <WeeklyConsistencyChart weeklyData={weeklyData} />
        ) : null}

        <GoalStreakStrip dailyStates={goalDailyStates} streak={goalStreak} />
      </ZenCard>

      {/* Weekly Review prompt */}
      {!isReadOnly && goalReviewStatus.isError ? (
        <ZenCard>
          <Eyebrow label="Weekly Review" />
          <Text style={styles.reviewErrorText}>
            We couldn't check your review status.
          </Text>
          <SecondaryButton
            disabled={goalReviewStatus.isFetching}
            label={goalReviewStatus.isFetching ? "Retrying..." : "Retry"}
            onPress={() => void goalReviewStatus.refetch()}
          />
        </ZenCard>
      ) : !isReadOnly && identityPhrase && goalReviewStatus.data?.isDue ? (
        <ZenCard>
          <Eyebrow label="Weekly Review" />
          <Text style={styles.reviewPromptText}>
            Time to reflect on your week as {identityPhrase}.
          </Text>
          <PrimaryButton
            label="Start review"
            onPress={() =>
              router.push({
                params: {
                  identityPhrase: encodeURIComponent(identityPhrase),
                  returnTo: "goalDetail",
                },
                pathname: "/(app)/reviews/goal/[identityPhrase]",
              })
            }
          />
        </ZenCard>
      ) : !isReadOnly && goalReviewStatus.data?.allReviewed ? (
        <ZenCard>
          <Eyebrow label="Weekly Review" />
          <Text style={styles.reviewCompletedText}>Reviewed this week ✓</Text>
        </ZenCard>
      ) : null}

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
                    cellSize={12}
                    logs={habit.logs}
                    maxDays={14}
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
    fontFamily: fontFamilies.bodyMedium,
    fontSize: 21,
    fontWeight: "500",
  },
  headlineTextGraduated: {
    color: colors.graduatedCircle,
  },
  graduatedSuffix: {
    color: colors.graduatedCircle,
    fontFamily: fontFamilies.body,
    fontSize: typography.micro,
    fontStyle: "italic",
    fontWeight: "400",
  },
  journeyCard: {
    borderRadius: 24,
    gap: spacing.md,
  },
  journeyTop: {
    alignItems: "flex-start",
    flexDirection: "row",
    gap: spacing.md,
  },
  narrativeText: {
    color: colors.textMuted,
    flex: 1,
    fontFamily: fontFamilies.body,
    fontSize: typography.bodyMd,
    lineHeight: 22,
    paddingTop: 4,
  },
  screen: {
    backgroundColor: colors.bg,
    flex: 1,
  },
  reviewCompletedText: {
    color: colors.primary,
    fontFamily: fontFamilies.bodySemi,
    fontSize: typography.bodyMd,
  },
  reviewErrorText: {
    color: colors.danger,
    fontFamily: fontFamilies.body,
    fontSize: typography.bodyMd,
    lineHeight: 20,
  },
  reviewPromptText: {
    color: colors.text,
    fontFamily: fontFamilies.body,
    fontSize: typography.bodyMd,
    lineHeight: 20,
  },
  streakCopyText: {
    color: colors.primary,
    fontFamily: fontFamilies.body,
    fontStyle: "italic",
    fontSize: typography.bodyMd,
  },
});
