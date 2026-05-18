import { useEffect, useRef } from "react";
import { Alert, ScrollView, StyleSheet, Text, View, Pressable } from "react-native";
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
import { getArchiveGoalErrorMessage } from "@/utils/userFacingErrors";
import { Eyebrow } from "@/components/text/Eyebrow";
import { LucideIcon } from "@/components/LucideIconPicker";
import { ConsistencyDonut } from "@/features/today/components/ConsistencyDonut";
import { GoalStreakStrip } from "@/features/today/components/GoalStreakStrip";
import { WeeklyConsistencyChart } from "@/features/today/components/WeeklyConsistencyChart";
import { getGoalNarrative } from "@/features/today/goalNarrativeCopy";
import { PrimaryButton } from "@/components/buttons/PrimaryButton";
import {
  useArchiveGoalMutation,
  useGoalCascadeCountQuery,
  useGoalHabitCountQuery,
} from "@/features/habits/hooks";
import { useGoalReviewStatusQuery } from "@/features/reviews/hooks";
import { openGoalWeeklyReview } from "@/features/reviews/openReview";
import { useGoalDetail } from "@/features/today/hooks";
import { getStreakCopy } from "@/features/today/streakCopy";
import { useTrialValidation } from "@/features/trial/hooks";
import { colors } from "@/theme/colors";
import { fontFamilies } from "@/theme/fontFamilies";
import { SCREEN_TOP_PADDING, spacing } from "@/theme/spacing";
import { typography } from "@/theme/typography";

export default function GoalDetailScreen() {
  const { identityPhrase: rawParam } = useLocalSearchParams<{ identityPhrase?: string }>();
  const identityPhrase = rawParam ? decodeURIComponent(rawParam as string) : undefined;
  const insets = useSafeAreaInsets();

  const { accessMode, isValidating, refresh } = useTrialValidation();
  const isReadOnly = accessMode === "read_only";

  const {
    earliestStartDate,
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

  // Cascade-scope count (active + backlog only) for archive-goal copy.
  // archiveGoal's WHERE clause is `status IN ('active','backlog')`, so an
  // already-archived habit under the same identity_phrase does NOT move.
  // useGoalHabitCountQuery returns the all-status total — using it here
  // for body copy would overstate the move (e.g. "4 habits will be moved"
  // when 1 of 4 is already archived). The cascade count keeps copy and
  // hide rule aligned with what archiveGoal actually does. Both counts
  // also drive the stale-route redirect below.
  const goalCascadeCountQuery = useGoalCascadeCountQuery(identityPhrase);
  const goalHabitCountQuery = useGoalHabitCountQuery(identityPhrase);
  const cascadeCount = goalCascadeCountQuery.data ?? 0;
  const archiveGoalMutation = useArchiveGoalMutation();

  // Submit-lock for the archive flow. Set true synchronously before
  // mutateAsync runs so the post-archive query invalidation (which
  // refetches habits → empty, since all the goal's active rows just
  // flipped to archived) does not trigger the stale-route redirect and
  // race the intentional router.replace below.
  const isExitingRef = useRef(false);

  // Stale-route guard, symmetric with ArchivedGoalDetailScreen. A "live
  // goal" requires ≥1 active habit per the plan's contract; phrases that
  // don't qualify must redirect to where the data actually lives:
  //   - totalCount === 0 → no such goal → Today
  //   - cascadeCount === 0 && totalCount > 0 → fully archived → archived detail
  //   - else (backlog-only / mixed-no-active) → Today
  //     ("neither surface" per the plan; Today is the safer landing)
  const hasActiveHabits = habits.length > 0;
  const totalCount = goalHabitCountQuery.data ?? 0;
  const cascadeSettled =
    !goalCascadeCountQuery.isLoading && goalCascadeCountQuery.data !== undefined;
  const totalSettled =
    !goalHabitCountQuery.isLoading && goalHabitCountQuery.data !== undefined;
  const shouldRedirect =
    !isExitingRef.current &&
    !isLoading &&
    !error &&
    !hasActiveHabits &&
    cascadeSettled &&
    totalSettled;

  useEffect(() => {
    if (!shouldRedirect || !identityPhrase) return;
    if (totalCount === 0) {
      router.replace("/(app)/(tabs)/today");
      return;
    }
    if (cascadeCount === 0) {
      // Fully archived — route to the archived-goal surface, not Today.
      // Better UX than dumping the user on Today when their archived
      // goal still exists.
      router.replace({
        pathname: "/(app)/goals/archived/[identityPhrase]",
        params: { identityPhrase: encodeURIComponent(identityPhrase) },
      });
      return;
    }
    // Backlog-only or mixed-no-active: plan §5 puts this in "neither
    // surface". Today is the safe fallback.
    router.replace("/(app)/(tabs)/today");
  }, [shouldRedirect, identityPhrase, totalCount, cascadeCount]);

  function confirmArchiveGoal() {
    Alert.alert(
      "Archive this goal?",
      `${cascadeCount} habit${
        cascadeCount !== 1 ? "s" : ""
      } will be moved to your archive. You can restore them anytime from Settings → Archive.`,
      [
        { text: "Cancel", style: "cancel" },
        {
          text: "Archive",
          onPress: () => void handleArchiveGoal(),
        },
      ],
    );
  }

  async function handleArchiveGoal() {
    if (!identityPhrase || archiveGoalMutation.isPending) return;
    isExitingRef.current = true;
    try {
      await archiveGoalMutation.mutateAsync({ identityPhrase });
      router.replace("/(app)/(tabs)/today");
    } catch {
      // Re-arm the stale-route guard so the user can retry; failure
      // is surfaced via mutation state below.
      isExitingRef.current = false;
    }
  }

  if (isLoading) {
    return <LoadingState message="Loading goal..." />;
  }

  // Suppress the empty-active-habits shell during the redirect window so
  // the user never sees a "No habits" card or a misleading Archive CTA on
  // a stale/misrouted live route. Same suppression pattern as
  // ArchivedGoalDetailScreen.
  if (shouldRedirect) {
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
      <View style={[styles.header, { paddingTop: insets.top + SCREEN_TOP_PADDING }]}>
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
          {goalConsistencyRate !== null ? (
            <ConsistencyDonut
              rate={goalConsistencyRate}
              size={56}
              label=""
              testID="goal-consistency-donut"
              tint={goalGraduated ? colors.graduatedCircle : undefined}
            />
          ) : (
            <View style={styles.donutPlaceholder} />
          )}
          <Text style={styles.narrativeText}>
            {getGoalNarrative(goalConsistencyRate, oldestActiveDaysCount)}
          </Text>
        </View>

        {weeklyData.length >= 1 ? (
          <WeeklyConsistencyChart scope="goal" weeklyData={weeklyData} />
        ) : null}

        <GoalStreakStrip
          dailyStates={goalDailyStates}
          scope="goal"
          startDate={earliestStartDate}
          streak={goalStreak}
        />
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
              void openGoalWeeklyReview({
                identityPhrase,
                returnTo: "goalDetail",
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

      {/* Habits in this goal. The empty-state branch is unreachable: the
          shouldRedirect short-circuit above catches every habits.length===0
          case (no goal, fully-archived, backlog-only, mixed-no-active) and
          renders LoadingState while routing the user to the right surface. */}
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
      ) : null}

      {/* Archive zone — recoverable. Hard delete moved to Archived Goal
          Detail; permanent removal lives behind the Archive screen now.
          Hide rule uses cascadeCount (active+backlog only) so a goal whose
          only habits are already-archived doesn't show an Archive button
          that would do nothing. */}
      {!isReadOnly && cascadeCount > 0 ? (
        <View style={styles.archiveZoneContainer}>
          {/* Tinted card surface mirrors DangerZone's structural pattern
              (tinted zone + plain button) but in a neutral warm tone so
              the button has a surface to lift off of without signaling
              destructiveness. */}
          <ZenCard style={styles.archiveCard}>
            <Eyebrow label="Archive goal" />
            <Text style={styles.archiveBody}>
              Move this goal and its {cascadeCount} habit
              {cascadeCount !== 1 ? "s" : ""} to your archive. You can
              restore or permanently delete them later.
            </Text>
            <SecondaryButton
              disabled={archiveGoalMutation.isPending}
              label={
                archiveGoalMutation.isPending ? "Archiving…" : "Archive goal"
              }
              onPress={confirmArchiveGoal}
            />
          </ZenCard>
          {archiveGoalMutation.error ? (
            <ErrorState message={getArchiveGoalErrorMessage()} />
          ) : null}
        </View>
      ) : null}
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
  archiveBody: {
    color: colors.textMuted,
    fontFamily: fontFamilies.body,
    fontSize: 14,
    lineHeight: 20,
  },
  archiveCard: {
    backgroundColor: colors.surfaceMuted,
  },
  archiveZoneContainer: {
    gap: spacing.sm,
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
  donutPlaceholder: {
    height: 56,
    width: 56,
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
