import { useRef } from "react";
import { ScrollView, StyleSheet, Text, View } from "react-native";
import { router, useLocalSearchParams } from "expo-router";

import { Heatmap } from "@/components/Heatmap";
import { IdentityStreakDisplay } from "@/components/IdentityStreakDisplay";
import { SecondaryButton } from "@/components/buttons/SecondaryButton";
import { EmptyState } from "@/components/feedback/EmptyState";
import { ErrorState } from "@/components/feedback/ErrorState";
import { LoadingState } from "@/components/feedback/LoadingState";
import {
  HABIT_LOG_STATUS_LABELS,
} from "@/features/habits/contract";
import {
  useArchiveHabitMutation,
  useHabitDetail,
} from "@/features/habits/hooks";
import { extractIdentityNoun } from "@/features/onboarding/identityNoun";
import { getHabitAdjustmentSuggestion } from "@/features/recommendations/habitAdjustmentEngine";
import { useHabitLogsForRange } from "@/features/today/hooks";
import { colors } from "@/theme/colors";
import { radius } from "@/theme/radius";
import { spacing } from "@/theme/spacing";
import { typography } from "@/theme/typography";
import {
  getLoadHabitDetailErrorMessage,
  getUpdateHabitActiveStateErrorMessage,
} from "@/utils/userFacingErrors";

import type { HabitLogStatus } from "@/features/habits/types";

function formatTodayStatus(status: HabitLogStatus | null) {
  if (!status) {
    return "Today not logged yet";
  }

  return `Today: ${status[0].toUpperCase()}${status.slice(1)}`;
}

function formatConsistency(consistencyRate: number) {
  return `${Math.round(consistencyRate * 100)}%`;
}

function formatDateLabel(dateString: string) {
  return new Date(`${dateString}T12:00:00`).toLocaleDateString(undefined, {
    day: "numeric",
    month: "short",
  });
}

function formatWeekLabel(weekStart: string) {
  return `Week of ${new Date(`${weekStart}T12:00:00`).toLocaleDateString(
    undefined,
    {
      day: "numeric",
      month: "short",
    },
  )}`;
}

function formatBooleanAnswer(value: boolean | null) {
  if (value === null) {
    return "Not answered";
  }

  return value ? "Yes" : "No";
}

function getUpcomingHabitMessage() {
  return "This habit is scheduled and will become loggable on its start date.";
}

export default function HabitDetailScreen() {
  const { habitId } = useLocalSearchParams<{ habitId?: string | string[] }>();
  const activeStateSubmitLockRef = useRef(false);
  const {
    error,
    formula,
    habit,
    isLoading,
    isUpcoming,
    latestReview,
    progress,
    recentLogs,
  } = useHabitDetail(habitId);
  const archiveHabitMutation = useArchiveHabitMutation();

  async function handleArchivePress() {
    if (
      !habit ||
      activeStateSubmitLockRef.current ||
      archiveHabitMutation.isPending
    ) {
      return;
    }

    activeStateSubmitLockRef.current = true;

    try {
      await archiveHabitMutation.mutateAsync({ habitId: habit.id });
    } finally {
      activeStateSubmitLockRef.current = false;
    }
  }

  if (isLoading) {
    return <LoadingState message="Loading habit details..." />;
  }

  if (error || !habit) {
    return (
      <ScrollView
        contentContainerStyle={styles.content}
        contentInsetAdjustmentBehavior="automatic"
        style={styles.screen}
      >
        <Text selectable style={styles.title}>
          Habit Detail
        </Text>
        <ErrorState message={getLoadHabitDetailErrorMessage()} />
        <SecondaryButton
          label="Back to Today"
          onPress={() => router.push("/(app)/(tabs)/today")}
        />
      </ScrollView>
    );
  }

  const adjustmentSuggestion = latestReview
    ? getHabitAdjustmentSuggestion({
        habit,
        latestReview,
        progress,
      })
    : null;

  return (
    <ScrollView
      contentContainerStyle={styles.content}
      contentInsetAdjustmentBehavior="automatic"
      style={styles.screen}
    >
      <View style={styles.header}>
        {habit.identity_phrase ? (
          <Text selectable style={styles.becomingHeader}>
            Become {habit.identity_phrase}
          </Text>
        ) : null}
        <Text selectable style={styles.title}>
          {habit.title}
        </Text>
        <Text selectable style={styles.formula}>
          {formula}
        </Text>
      </View>

      {isUpcoming ? (
        <View style={styles.infoCard}>
          <Text selectable style={styles.infoTitle}>
            Starts on {formatDateLabel(habit.start_date)}
          </Text>
          <Text selectable style={styles.infoBody}>
            {getUpcomingHabitMessage()}
          </Text>
        </View>
      ) : null}

      <View style={styles.sectionCard}>
        <Text selectable style={styles.sectionTitle}>
          Setup
        </Text>
        {habit.identity_phrase ? (
          <View style={styles.row}>
            <Text selectable style={styles.label}>
              Identity
            </Text>
            <Text selectable style={styles.value}>
              {habit.identity_phrase}
            </Text>
          </View>
        ) : null}
        <View style={styles.row}>
          <Text selectable style={styles.label}>
            Formula
          </Text>
          <Text selectable style={styles.value}>
            {formula}
          </Text>
        </View>
        {habit.preferred_time_window ? (
          <View style={styles.row}>
            <Text selectable style={styles.label}>
              Preferred time
            </Text>
            <Text selectable style={styles.value}>
              {habit.preferred_time_window}
            </Text>
          </View>
        ) : null}
        {/* TODO(S15): reminder settings row */}
      </View>

      {!isUpcoming ? (
        <View style={styles.sectionCard}>
          <HabitDetailHeatmap habitId={habit.id} />
        </View>
      ) : null}

      <View style={styles.sectionCard}>
        <Text selectable style={styles.sectionTitle}>
          Today
        </Text>
        <Text selectable style={styles.statusText}>
          {formatTodayStatus(progress.todayStatus)}
        </Text>
      </View>

      <View style={styles.sectionCard}>
        <Text selectable style={styles.sectionTitle}>
          Progress
        </Text>
        <IdentityStreakDisplay
          identityNoun={extractIdentityNoun(habit.identity_phrase ?? "")}
          streak={progress.streak}
        />
        <View style={styles.progressGrid}>
          <View style={styles.progressItem}>
            <Text selectable style={styles.progressLabel}>
              30-day skips
            </Text>
            <Text selectable style={styles.progressValue}>
              {progress.skipCount}
            </Text>
          </View>
          <View style={styles.progressItem}>
            <Text selectable style={styles.progressLabel}>
              Consistency
            </Text>
            <Text selectable style={styles.progressValue}>
              {formatConsistency(progress.consistencyRate)} over the last 30 days
            </Text>
          </View>
        </View>
      </View>

      <View style={styles.sectionCard}>
        <Text selectable style={styles.sectionTitle}>
          Recent history
        </Text>
        {recentLogs.length === 0 ? (
          <EmptyState
            body="This habit has no recent logs yet."
            title="No recent history yet"
          />
        ) : (
          recentLogs.map((log) => (
            <View key={log.id} style={styles.logRow}>
              <Text selectable style={styles.logPrimary}>
                {formatDateLabel(log.log_date)} -{" "}
                {HABIT_LOG_STATUS_LABELS[log.status]}
              </Text>
              {log.note ? (
                <Text selectable style={styles.logSecondary}>
                  {log.note}
                </Text>
              ) : null}
            </View>
          ))
        )}
      </View>

      <View style={styles.sectionCard}>
        <Text selectable style={styles.sectionTitle}>
          {latestReview ? "Latest weekly review" : "Weekly review"}
        </Text>
        {latestReview ? (
          <View style={styles.reviewContent}>
            <Text selectable style={styles.reviewWeek}>
              {formatWeekLabel(latestReview.week_start)}
            </Text>
            {latestReview.went_well ? (
              <View style={styles.row}>
                <Text selectable style={styles.label}>
                  What went well
                </Text>
                <Text selectable style={styles.value}>
                  {latestReview.went_well}
                </Text>
              </View>
            ) : null}
            {latestReview.was_hard ? (
              <View style={styles.row}>
                <Text selectable style={styles.label}>
                  What was hard
                </Text>
                <Text selectable style={styles.value}>
                  {latestReview.was_hard}
                </Text>
              </View>
            ) : null}
            <View style={styles.row}>
              <Text selectable style={styles.label}>
                Trigger worked
              </Text>
              <Text selectable style={styles.value}>
                {formatBooleanAnswer(latestReview.trigger_worked)}
              </Text>
            </View>
            <View style={styles.row}>
              <Text selectable style={styles.label}>
                Tiny action too hard
              </Text>
              <Text selectable style={styles.value}>
                {formatBooleanAnswer(latestReview.tiny_action_too_hard)}
              </Text>
            </View>
            {latestReview.adjustment_note ? (
              <View style={styles.row}>
                <Text selectable style={styles.label}>
                  Adjustment
                </Text>
                <Text selectable style={styles.value}>
                  {latestReview.adjustment_note}
                </Text>
              </View>
            ) : null}
          </View>
        ) : (
          <Text selectable style={styles.value}>
            Reflect on what worked and what to adjust for this habit.
          </Text>
        )}
        <SecondaryButton
          label={latestReview ? "Update weekly review" : "Start weekly review"}
          onPress={() => router.push(`/(app)/reviews/${habit.id}`)}
        />
      </View>

      {adjustmentSuggestion ? (
        <View style={styles.suggestionCard}>
          <Text selectable style={styles.suggestionEyebrow}>
            Suggested adjustment
          </Text>
          <Text selectable style={styles.suggestionTitle}>
            {adjustmentSuggestion.title}
          </Text>
          <Text selectable style={styles.suggestionBody}>
            {adjustmentSuggestion.body}
          </Text>
          <Text selectable style={styles.suggestionReasonLabel}>
            Why this suggestion
          </Text>
          <Text selectable style={styles.suggestionReason}>
            {adjustmentSuggestion.reason}
          </Text>
          <SecondaryButton
            label="Review suggestion"
            onPress={() =>
              router.push({
                pathname: "/(app)/habits/[habitId]/edit",
                params: {
                  habitId: habit.id,
                  suggestionType: adjustmentSuggestion.type,
                },
              })
            }
          />
        </View>
      ) : null}

      <View style={styles.actions}>
        {archiveHabitMutation.error ? (
          <ErrorState message={getUpdateHabitActiveStateErrorMessage()} />
        ) : null}
        {habit.status === "active" ? (
          <>
            <View style={styles.actionHelperCard}>
              <Text selectable style={styles.actionHelperTitle}>
                Archive habit
              </Text>
              <Text selectable style={styles.actionHelperBody}>
                This removes the habit from Today, but keeps its history.
              </Text>
            </View>
            <SecondaryButton
              disabled={archiveHabitMutation.isPending}
              label="Archive habit"
              onPress={() => void handleArchivePress()}
            />
          </>
        ) : (
          <View style={styles.actionHelperCard}>
            <Text selectable style={styles.actionHelperTitle}>
              Archived
            </Text>
            <Text selectable style={styles.actionHelperBody}>
              This habit is archived. Reactivation coming in a future release.
            </Text>
          </View>
        )}
        <SecondaryButton
          label="Edit habit"
          onPress={() => router.push(`/(app)/habits/${habit.id}/edit`)}
        />
        <SecondaryButton
          label="Back to Today"
          onPress={() => router.push("/(app)/(tabs)/today")}
        />
      </View>
    </ScrollView>
  );
}

function HabitDetailHeatmap({ habitId }: { habitId: string }) {
  const logsQuery = useHabitLogsForRange(habitId, 90);
  if (!logsQuery.data) return null;
  return <Heatmap days={90} logs={logsQuery.data} />;
}

const styles = StyleSheet.create({
  actionHelperBody: {
    color: colors.textMuted,
    fontSize: 14,
    lineHeight: 20,
  },
  actionHelperCard: {
    backgroundColor: colors.surface,
    borderColor: colors.border,
    borderRadius: radius.lg,
    borderWidth: 1,
    gap: spacing.xs,
    padding: spacing.lg,
  },
  actionHelperTitle: {
    color: colors.text,
    fontSize: 16,
    fontWeight: "700",
  },
  actions: {
    gap: spacing.md,
  },
  becomingHeader: {
    color: colors.text,
    fontSize: typography.heading,
    fontWeight: "700",
    lineHeight: 30,
  },
  content: {
    gap: spacing.xl,
    padding: spacing.xl,
  },
  formula: {
    color: colors.textMuted,
    fontSize: 16,
    lineHeight: 24,
  },
  header: {
    gap: spacing.sm,
  },
  infoBody: {
    color: colors.textMuted,
    fontSize: 15,
    lineHeight: 22,
  },
  infoCard: {
    backgroundColor: colors.accentSoft,
    borderRadius: radius.lg,
    gap: spacing.sm,
    padding: spacing.xl,
  },
  infoTitle: {
    color: colors.accent,
    fontSize: 16,
    fontWeight: "700",
  },
  label: {
    color: colors.textMuted,
    fontSize: 13,
    fontWeight: "700",
    textTransform: "uppercase",
  },
  logPrimary: {
    color: colors.text,
    fontSize: 16,
    fontWeight: "600",
  },
  logRow: {
    borderColor: colors.border,
    borderTopWidth: 1,
    gap: spacing.xs,
    paddingTop: spacing.md,
  },
  logSecondary: {
    color: colors.textMuted,
    fontSize: 14,
    lineHeight: 20,
  },
  progressGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: spacing.sm,
  },
  progressItem: {
    backgroundColor: colors.surfaceMuted,
    borderRadius: radius.md,
    gap: spacing.xs,
    minWidth: 96,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
  },
  progressLabel: {
    color: colors.textMuted,
    fontSize: 12,
    fontWeight: "600",
    textTransform: "uppercase",
  },
  progressValue: {
    color: colors.text,
    fontSize: 18,
    fontWeight: "700",
  },
  row: {
    gap: spacing.xs,
  },
  reviewContent: {
    gap: spacing.md,
  },
  reviewWeek: {
    color: colors.textMuted,
    fontSize: 14,
    fontWeight: "600",
  },
  screen: {
    backgroundColor: colors.background,
    flex: 1,
  },
  sectionCard: {
    backgroundColor: colors.surface,
    borderColor: colors.border,
    borderRadius: radius.lg,
    borderWidth: 1,
    gap: spacing.md,
    padding: spacing.xl,
  },
  sectionTitle: {
    color: colors.text,
    fontSize: 18,
    fontWeight: "700",
  },
  statusText: {
    color: colors.text,
    fontSize: 18,
    fontWeight: "600",
  },
  suggestionBody: {
    color: colors.textMuted,
    fontSize: 14,
    lineHeight: 20,
  },
  suggestionCard: {
    backgroundColor: colors.surface,
    borderColor: colors.border,
    borderRadius: radius.lg,
    borderWidth: 1,
    gap: spacing.sm,
    padding: spacing.xl,
  },
  suggestionEyebrow: {
    color: colors.textMuted,
    fontSize: 12,
    fontWeight: "700",
    textTransform: "uppercase",
  },
  suggestionReason: {
    color: colors.textMuted,
    fontSize: 14,
    lineHeight: 20,
  },
  suggestionReasonLabel: {
    color: colors.text,
    fontSize: 13,
    fontWeight: "700",
  },
  suggestionTitle: {
    color: colors.text,
    fontSize: 18,
    fontWeight: "700",
  },
  title: {
    color: colors.text,
    fontSize: 28,
    fontWeight: "800",
  },
  value: {
    color: colors.text,
    fontSize: 16,
    lineHeight: 24,
  },
});
