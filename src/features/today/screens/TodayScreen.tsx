import { useRef } from "react";
import { Pressable, ScrollView, StyleSheet, Text, View } from "react-native";
import { router } from "expo-router";

import { PrimaryButton } from "@/components/buttons/PrimaryButton";
import { SecondaryButton } from "@/components/buttons/SecondaryButton";
import { HabitCard } from "@/components/cards/HabitCard";
import { EmptyState } from "@/components/feedback/EmptyState";
import { ErrorState } from "@/components/feedback/ErrorState";
import { LoadingState } from "@/components/feedback/LoadingState";
import {
  HABIT_LOG_STATUS_LABELS,
  HABIT_LOG_STATUSES,
} from "@/features/habits/contract";
import {
  useTodayHabits,
  useUpsertTodayHabitStatusMutation,
} from "@/features/today/hooks";
import { colors } from "@/theme/colors";
import { radius } from "@/theme/radius";
import { spacing } from "@/theme/spacing";
import {
  getLoadHabitsErrorMessage,
  getSaveTodayStatusErrorMessage,
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

function formatStreak(streak: number) {
  return `${streak} day${streak === 1 ? "" : "s"}`;
}

function formatStartDateLabel(startDate: string) {
  return `Starts on ${new Date(`${startDate}T12:00:00`).toLocaleDateString(
    undefined,
    {
      day: "numeric",
      month: "long",
    },
  )}`;
}

export default function TodayScreen() {
  const { error, habits, isLoading, upcomingHabits } = useTodayHabits();
  const upsertTodayHabitStatusMutation = useUpsertTodayHabitStatusMutation();
  const statusSubmitLockRef = useRef(false);

  function openHabitDetail(habitId: string) {
    router.push(`/(app)/habits/${habitId}`);
  }

  function openWeeklyReview(habitId: string) {
    router.push({
      params: {
        habitId,
        returnTo: "today",
      },
      pathname: "/(app)/reviews/[habitId]",
    });
  }

  async function handleStatusPress(habitId: string, status: HabitLogStatus) {
    if (
      statusSubmitLockRef.current ||
      upsertTodayHabitStatusMutation.isPending
    ) {
      return;
    }

    statusSubmitLockRef.current = true;

    try {
      await upsertTodayHabitStatusMutation.mutateAsync({
        habitId,
        status,
      });
    } finally {
      statusSubmitLockRef.current = false;
    }
  }

  if (isLoading) {
    return <LoadingState message="Loading your Today view..." />;
  }

  if (error) {
    return <ErrorState message={getLoadHabitsErrorMessage()} />;
  }

  return (
    <ScrollView
      contentContainerStyle={styles.content}
      contentInsetAdjustmentBehavior="automatic"
      style={styles.screen}
    >
      <View style={styles.header}>
        <Text selectable style={styles.title}>
          Today
        </Text>
        <Text selectable style={styles.body}>
          Log what happened today. Done, skipped, or missed - honesty helps you
          improve.
        </Text>
      </View>

      {upsertTodayHabitStatusMutation.error ? (
        <ErrorState message={getSaveTodayStatusErrorMessage()} />
      ) : null}

      {habits.length === 0 && upcomingHabits.length === 0 ? (
        <View style={styles.emptySection}>
          <EmptyState
            body="Create your first active habit and it will show up here right away."
            title="No active habits yet"
          />
          <PrimaryButton
            label="Create your first habit"
            onPress={() => router.push("/(app)/habits/create")}
          />
        </View>
      ) : habits.length === 0 ? (
        <View style={styles.upcomingSection}>
          <EmptyState
            body="Your active habits are scheduled to begin soon."
            title="Nothing starts today yet"
          />
          {upcomingHabits.map((habit) => (
            <HabitCard
              formula={habit.formula}
              key={habit.id}
              metaText={formatStartDateLabel(habit.startDate)}
              name={habit.name}
              onPress={() => openHabitDetail(habit.id)}
            />
          ))}
          <SecondaryButton
            label="Create another habit"
            onPress={() => router.push("/(app)/habits/create")}
          />
        </View>
      ) : (
        habits.map((habit) => (
          <HabitCard
            formula={habit.formula}
            key={habit.id}
            metaText={formatTodayStatus(habit.todayStatus)}
            name={habit.name}
            onPress={() => openHabitDetail(habit.id)}
          >
            <View style={styles.progressGrid}>
              <View style={styles.progressItem}>
                <Text selectable style={styles.progressLabel}>
                  30-day skips
                </Text>
                <Text selectable style={styles.progressValue}>
                  {habit.skipCount}
                </Text>
              </View>
              <View style={styles.progressItem}>
                <Text selectable style={styles.progressLabel}>
                  Consistency
                </Text>
                <Text selectable style={styles.progressValue}>
                  {formatConsistency(habit.consistencyRate)}
                </Text>
              </View>
              <View style={styles.progressItem}>
                <Text selectable style={styles.progressLabel}>
                  Streak
                </Text>
                <Text selectable style={styles.progressValue}>
                  {formatStreak(habit.streak)}
                </Text>
              </View>
            </View>
            {habit.isWeeklyReviewDue ? (
              <View style={styles.reviewPrompt}>
                <View style={styles.reviewPromptCopy}>
                  <Text selectable style={styles.reviewPromptTitle}>
                    Weekly review due
                  </Text>
                  <Text selectable style={styles.reviewPromptBody}>
                    Reflect on what worked and what needs adjusting.
                  </Text>
                </View>
                <SecondaryButton
                  label="Start review"
                  onPress={() => openWeeklyReview(habit.id)}
                />
              </View>
            ) : null}
            <View style={styles.actionsRow}>
              {HABIT_LOG_STATUSES.map((status) => {
                const isSelected = habit.todayStatus === status;

                return (
                  <Pressable
                    accessibilityRole="button"
                    disabled={upsertTodayHabitStatusMutation.isPending}
                    key={status}
                    onPress={() => void handleStatusPress(habit.id, status)}
                    style={[
                      styles.statusButton,
                      isSelected && styles.statusButtonSelected,
                    ]}
                  >
                    <Text
                      selectable
                      style={[
                        styles.statusButtonLabel,
                        isSelected && styles.statusButtonLabelSelected,
                      ]}
                    >
                      {HABIT_LOG_STATUS_LABELS[status]}
                    </Text>
                  </Pressable>
                );
              })}
            </View>
          </HabitCard>
        ))
      )}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  actionsRow: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: spacing.sm,
  },
  body: {
    color: colors.textMuted,
    fontSize: 16,
    lineHeight: 24,
  },
  content: {
    gap: spacing.xl,
    padding: spacing.xl,
  },
  emptySection: {
    gap: spacing.lg,
  },
  header: {
    gap: spacing.sm,
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
  reviewPrompt: {
    backgroundColor: colors.accentSoft,
    borderRadius: radius.lg,
    gap: spacing.md,
    padding: spacing.lg,
  },
  reviewPromptBody: {
    color: colors.textMuted,
    fontSize: 14,
    lineHeight: 20,
  },
  reviewPromptCopy: {
    gap: spacing.xs,
  },
  reviewPromptTitle: {
    color: colors.accent,
    fontSize: 16,
    fontWeight: "700",
  },
  upcomingSection: {
    gap: spacing.lg,
  },
  screen: {
    backgroundColor: colors.background,
    flex: 1,
  },
  statusButton: {
    backgroundColor: colors.background,
    borderColor: colors.border,
    borderRadius: radius.pill,
    borderWidth: 1,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
  },
  statusButtonLabel: {
    color: colors.text,
    fontSize: 14,
    fontWeight: "600",
  },
  statusButtonLabelSelected: {
    color: colors.white,
  },
  statusButtonSelected: {
    backgroundColor: colors.accent,
    borderColor: colors.accent,
  },
  title: {
    color: colors.text,
    fontSize: 28,
    fontWeight: "800",
  },
});
