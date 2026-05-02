import { useRef, useState } from "react";
import { ScrollView, StyleSheet, Text, View } from "react-native";
import { router, useLocalSearchParams } from "expo-router";

import { Heatmap } from "@/components/Heatmap";
import type { HeatmapLog } from "@/components/Heatmap";
import { IdentityStreakDisplay } from "@/components/IdentityStreakDisplay";
import { ReadOnlyBanner } from "@/components/ReadOnlyBanner";
import { SecondaryButton } from "@/components/buttons/SecondaryButton";
import { ZenCard } from "@/components/cards/ZenCard";
import { RowLV } from "@/components/cards/RowLV";
import { EmptyState } from "@/components/feedback/EmptyState";
import { ErrorState } from "@/components/feedback/ErrorState";
import { LoadingState } from "@/components/feedback/LoadingState";
import { Eyebrow } from "@/components/text/Eyebrow";
import {
  HABIT_LOG_STATUS_LABELS,
} from "@/features/habits/contract";
import { isWithinRetroWindow } from "@/features/habits/api";
import { RetroLogSelector } from "@/features/habits/components/RetroLogSelector";
import {
  useArchiveHabitMutation,
  useHabitDetail,
  useUpsertHabitLogMutation,
} from "@/features/habits/hooks";
import { extractIdentityNoun } from "@/features/onboarding/identityNoun";
import { getHabitAdjustmentSuggestions } from "@/features/recommendations/habitAdjustmentEngine";
import { useTrialValidation } from "@/features/trial/hooks";
import { useHabitLogsForRange } from "@/features/today/hooks";
import { now } from "@/utils/clock";
import { colors } from "@/theme/colors";
import { fontFamilies } from "@/theme/fontFamilies";
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
  const upsertHabitLogMutation = useUpsertHabitLogMutation();
  const retroLogSubmitLockRef = useRef(false);
  const [selectorState, setSelectorState] = useState<{
    visible: boolean;
    date: string;
    currentStatus: HabitLogStatus | null;
    canEdit: boolean;
    readOnlyReason?: "window" | "app";
  } | null>(null);
  const heatmapLogs = useHabitLogsForRange(habit?.id, 90).data ?? [];
  const { accessMode, isValidating, refresh } = useTrialValidation();
  const isReadOnly = accessMode === "read_only";

  function handleCellPress(date: string) {
    if (!habit) return;
    if (date < habit.start_date) return;
    const existing = heatmapLogs.find((log) => log.log_date === date);
    const currentStatus = existing?.status ?? null;
    const withinWindow = isWithinRetroWindow(date, now());
    // Window-beats-app: reconnecting won't unlock an out-of-window day.
    let canEdit: boolean;
    let readOnlyReason: "window" | "app" | undefined;
    if (!withinWindow) {
      canEdit = false;
      readOnlyReason = "window";
    } else if (isReadOnly) {
      canEdit = false;
      readOnlyReason = "app";
    } else {
      canEdit = true;
      readOnlyReason = undefined;
    }
    setSelectorState({ visible: true, date, currentStatus, canEdit, readOnlyReason });
  }

  async function handleSelectorSubmit(status: HabitLogStatus) {
    if (!habit || !selectorState || retroLogSubmitLockRef.current) return;
    if (upsertHabitLogMutation.isPending) return;
    retroLogSubmitLockRef.current = true;
    try {
      await upsertHabitLogMutation.mutateAsync({
        habitId: habit.id,
        logDate: selectorState.date,
        status,
      });
    } finally {
      retroLogSubmitLockRef.current = false;
    }
  }

  function handleSelectorClose() {
    setSelectorState(null);
  }

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

  const adjustmentSuggestions = latestReview
    ? getHabitAdjustmentSuggestions({
        habit,
        latestReview,
        progress,
      })
    : [];

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
        <ZenCard>
          <Text selectable style={styles.infoTitle}>
            Starts on {formatDateLabel(habit.start_date)}
          </Text>
          <Text selectable style={styles.infoBody}>
            {getUpcomingHabitMessage()}
          </Text>
        </ZenCard>
      ) : null}

      <ZenCard>
        <Eyebrow label="Setup" />
        {habit.identity_phrase ? (
          <RowLV label="Identity" value={habit.identity_phrase} />
        ) : null}
        <RowLV label="Formula" value={formula} />
        {habit.preferred_time_window ? (
          <RowLV label="Preferred time" value={habit.preferred_time_window} />
        ) : null}
        {/* TODO(S15): reminder settings row */}
      </ZenCard>

      {!isUpcoming ? (
        <ZenCard>
          <HabitDetailHeatmap logs={heatmapLogs} onCellPress={handleCellPress} />
        </ZenCard>
      ) : null}

      <ZenCard>
        <Eyebrow label="Today" />
        <Text selectable style={styles.statusText}>
          {formatTodayStatus(progress.todayStatus)}
        </Text>
      </ZenCard>

      <ZenCard>
        <Eyebrow label="Progress" />
        <IdentityStreakDisplay
          identityNoun={extractIdentityNoun(habit.identity_phrase ?? "")}
          streak={progress.streak}
        />
        <RowLV label="30-day skips" value={String(progress.skipCount)} />
        <RowLV
          label="Consistency"
          value={`${formatConsistency(progress.consistencyRate)} over the last 30 days`}
        />
      </ZenCard>

      <ZenCard>
        <Eyebrow label="Recent history" />
        {recentLogs.length === 0 ? (
          <EmptyState
            body="This habit has no recent logs yet."
            title="No recent history yet"
          />
        ) : (
          recentLogs.map((log) => (
            <View key={log.id}>
              <RowLV
                label={formatDateLabel(log.log_date)}
                value={HABIT_LOG_STATUS_LABELS[log.status]}
              />
              {log.note ? (
                <Text selectable style={styles.logNote}>
                  {log.note}
                </Text>
              ) : null}
            </View>
          ))
        )}
      </ZenCard>

      <ZenCard>
        <Eyebrow label={latestReview ? "Latest weekly review" : "Weekly review"} />
        {latestReview ? (
          <View style={styles.reviewContent}>
            <Text selectable style={styles.reviewWeek}>
              {formatWeekLabel(latestReview.week_start)}
            </Text>
            {latestReview.went_well ? (
              <RowLV label="What went well" value={latestReview.went_well} />
            ) : null}
            {latestReview.was_hard ? (
              <RowLV label="What was hard" value={latestReview.was_hard} />
            ) : null}
            <RowLV label="Trigger worked" value={formatBooleanAnswer(latestReview.trigger_worked)} />
            <RowLV label="Tiny action too hard" value={formatBooleanAnswer(latestReview.tiny_action_too_hard)} />
            {latestReview.adjustment_note ? (
              <RowLV label="Adjustment" value={latestReview.adjustment_note} />
            ) : null}
          </View>
        ) : (
          <Text selectable style={styles.reviewPlaceholder}>
            Reflect on what worked and what to adjust for this habit.
          </Text>
        )}
        <SecondaryButton
          label={latestReview ? "Update weekly review" : "Start weekly review"}
          onPress={() => router.push(`/(app)/reviews/${habit.id}`)}
        />
      </ZenCard>

      {adjustmentSuggestions.map((suggestion) => (
        <ZenCard key={suggestion.type} gap={spacing.sm}>
          <Eyebrow label="Suggested adjustment" />
          <Text selectable style={styles.suggestionTitle}>
            {suggestion.title}
          </Text>
          <Text selectable style={styles.suggestionBody}>
            {suggestion.body}
          </Text>
          <Text selectable style={styles.suggestionReasonLabel}>
            Why this suggestion
          </Text>
          <Text selectable style={styles.suggestionReason}>
            {suggestion.reason}
          </Text>
          <SecondaryButton
            label="Review suggestion"
            onPress={() =>
              router.push({
                pathname: "/(app)/habits/[habitId]/edit",
                params: {
                  habitId: habit.id,
                  suggestionType: suggestion.type,
                },
              })
            }
          />
        </ZenCard>
      ))}

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
              disabled={archiveHabitMutation.isPending || isReadOnly}
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
          disabled={isReadOnly}
          label="Edit habit"
          onPress={() => router.push(`/(app)/habits/${habit.id}/edit`)}
        />
        <SecondaryButton
          label="Back to Today"
          onPress={() => router.push("/(app)/(tabs)/today")}
        />
      </View>
      {selectorState ? (
        <RetroLogSelector
          canEdit={selectorState.canEdit}
          currentStatus={selectorState.currentStatus}
          date={selectorState.date}
          isVisible={selectorState.visible}
          isPending={upsertHabitLogMutation.isPending}
          onClose={handleSelectorClose}
          onSubmit={handleSelectorSubmit}
          readOnlyReason={selectorState.readOnlyReason}
        />
      ) : null}
    </ScrollView>
  );
}

function HabitDetailHeatmap({
  logs,
  onCellPress,
}: {
  logs: HeatmapLog[];
  onCellPress?: (date: string) => void;
}) {
  return <Heatmap days={90} logs={logs} onCellPress={onCellPress} />;
}

const styles = StyleSheet.create({
  actionHelperBody: {
    color: colors.textMuted,
    fontFamily: fontFamilies.body,
    fontSize: 14,
    lineHeight: 20,
  },
  actionHelperCard: {
    backgroundColor: colors.surface,
    borderColor: 'transparent',
    borderRadius: 12,
    borderWidth: 1,
    gap: spacing.xs,
    padding: spacing.lg,
  },
  actionHelperTitle: {
    color: colors.text,
    fontFamily: fontFamilies.bodySemi,
    fontSize: 16,
  },
  actions: {
    gap: spacing.md,
  },
  becomingHeader: {
    color: colors.text,
    fontFamily: fontFamilies.bodySemi,
    fontSize: typography.headlineMd,
    lineHeight: 30,
  },
  content: {
    gap: spacing.xl,
    padding: spacing.xl,
  },
  formula: {
    color: colors.textMuted,
    fontFamily: fontFamilies.body,
    fontSize: 16,
    lineHeight: 24,
  },
  header: {
    gap: spacing.sm,
  },
  infoBody: {
    color: colors.textMuted,
    fontFamily: fontFamilies.body,
    fontSize: 15,
    lineHeight: 22,
  },
  infoTitle: {
    color: colors.text,
    fontFamily: fontFamilies.bodySemi,
    fontSize: typography.bodyLg,
  },
  logNote: {
    color: colors.textMuted,
    fontFamily: fontFamilies.body,
    fontSize: 14,
    lineHeight: 20,
  },
  reviewContent: {
    gap: spacing.md,
  },
  reviewPlaceholder: {
    color: colors.text,
    fontFamily: fontFamilies.body,
    fontSize: 16,
    lineHeight: 24,
  },
  reviewWeek: {
    color: colors.textMuted,
    fontFamily: fontFamilies.bodySemi,
    fontSize: 14,
  },
  screen: {
    backgroundColor: colors.bg,
    flex: 1,
  },
  statusText: {
    color: colors.text,
    fontFamily: fontFamilies.body,
    fontSize: 18,
  },
  suggestionBody: {
    color: colors.textMuted,
    fontFamily: fontFamilies.body,
    fontSize: 14,
    lineHeight: 20,
  },
  suggestionReason: {
    color: colors.textMuted,
    fontFamily: fontFamilies.body,
    fontSize: 14,
    lineHeight: 20,
  },
  suggestionReasonLabel: {
    color: colors.text,
    fontFamily: fontFamilies.bodySemi,
    fontSize: 13,
  },
  suggestionTitle: {
    color: colors.text,
    fontFamily: fontFamilies.displaySemi,
    fontSize: typography.titleMd,
  },
  title: {
    color: colors.text,
    fontFamily: fontFamilies.displayBold,
    fontSize: typography.headlineLg,
  },
});
