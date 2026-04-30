import { useRef } from "react";
import { Pressable, ScrollView, StyleSheet, Text, View } from "react-native";
import { router } from "expo-router";
import { useQueryClient } from "@tanstack/react-query";

import { Heatmap } from "@/components/Heatmap";
import { IdentityStreakDisplay } from "@/components/IdentityStreakDisplay";
import { RecoveryModal } from "@/components/RecoveryModal";
import { PrimaryButton } from "@/components/buttons/PrimaryButton";
import { SecondaryButton } from "@/components/buttons/SecondaryButton";
import { EmptyState } from "@/components/feedback/EmptyState";
import { ErrorState } from "@/components/feedback/ErrorState";
import { LoadingState } from "@/components/feedback/LoadingState";
import { extractIdentityNoun } from "@/features/onboarding/identityNoun";
import { useArchiveHabitMutation } from "@/features/habits/hooks";
import {
  useHabitLogsForRange,
  useTodayHabits,
  useUpsertTodayHabitStatusMutation,
} from "@/features/today/hooks";
import {
  useRecoveryCheck,
  useSingleMissBanner,
} from "@/features/recovery/hooks";
import {
  recoveryModalPreferenceKey,
  singleMissBannerPreferenceKey,
} from "@/features/recovery/api";
import { setPreference } from "@/lib/db/repositories/preferences";
import { colors } from "@/theme/colors";
import { radius } from "@/theme/radius";
import { spacing } from "@/theme/spacing";
import { typography } from "@/theme/typography";
import { todayDateString } from "@/utils/clock";
import {
  getLoadHabitsErrorMessage,
  getSaveTodayStatusErrorMessage,
} from "@/utils/userFacingErrors";

import type { TodayHabitCardData } from "@/features/today/types";
import type { HabitLogStatus } from "@/features/habits/types";
import type { HabitLog } from "@/lib/db/repositories/habit_logs";

function SubtleDateHeader() {
  const label = new Date().toLocaleDateString(undefined, {
    day: "numeric",
    month: "long",
    weekday: "long",
  });
  return (
    <Text selectable style={styles.dateHeader}>
      {label}
    </Text>
  );
}

type FocusCardProps = {
  habit: TodayHabitCardData;
  mutation: ReturnType<typeof useUpsertTodayHabitStatusMutation>;
  onLog: (habitId: string, status: HabitLogStatus) => void;
  showBanner: boolean;
  onDismissBanner: () => void;
};

function FocusCard({
  habit,
  mutation,
  onLog,
  showBanner,
  onDismissBanner,
}: FocusCardProps) {
  const identityNoun = extractIdentityNoun(habit.identityPhrase);
  const isFirstDay =
    habit.startDate === todayDateString() &&
    habit.todayStatus === null &&
    habit.streak === 0;

  const logsQuery = useHabitLogsForRange(habit.id, 30);

  return (
    <View style={styles.card}>
      {habit.identityPhrase ? (
        <Text selectable style={styles.becomingHeader}>
          Become {habit.identityPhrase}
        </Text>
      ) : null}

      <Text selectable style={styles.cueAction}>
        After {habit.cue}, {habit.tinyAction}
      </Text>

      {isFirstDay ? (
        <Text selectable style={styles.firstDayCopy}>
          Your first day. Start small.
        </Text>
      ) : (
        <IdentityStreakDisplay
          identityNoun={identityNoun}
          streak={habit.streak}
        />
      )}

      {showBanner ? (
        <View style={styles.missBanner}>
          <Text selectable style={styles.missBannerText}>
            Yesterday was a miss. The science says it didn&apos;t matter. Keep going.
          </Text>
          <Pressable
            accessibilityLabel="Dismiss"
            accessibilityRole="button"
            onPress={onDismissBanner}
            style={styles.missBannerClose}
          >
            <Text selectable style={styles.missBannerCloseText}>
              ×
            </Text>
          </Pressable>
        </View>
      ) : null}

      <View style={styles.actionsRow}>
        <PrimaryButton
          disabled={mutation.isPending}
          label={habit.todayStatus === "done" ? "Done ✓" : "Done"}
          onPress={() => onLog(habit.id, "done")}
        />
        <SecondaryButton
          disabled={mutation.isPending}
          label={habit.todayStatus === "skipped" ? "Skipped ✓" : "Skip"}
          onPress={() => onLog(habit.id, "skipped")}
        />
      </View>

      <Heatmap days={30} logs={logsQuery.data ?? []} />
    </View>
  );
}

export default function TodayScreen() {
  const queryClient = useQueryClient();
  const { error, habits, isLoading } = useTodayHabits();
  const upsertTodayHabitStatusMutation = useUpsertTodayHabitStatusMutation();
  const archiveHabitMutation = useArchiveHabitMutation();
  const statusSubmitLockRef = useRef(false);
  const recoveryActionLockRef = useRef(false);

  const focusHabit = habits.find((h) => h.habitState === "focus") ?? null;

  // Adapter: TodayHabitCardData (camelCase) → RecoveryHabitRef (snake_case)
  const focusHabitRef = focusHabit
    ? {
        id: focusHabit.id,
        habit_state: focusHabit.habitState,
        start_date: focusHabit.startDate,
      }
    : null;

  const { shouldShowModal, breakRunStartDate, logs } =
    useRecoveryCheck(focusHabitRef);
  const { showBanner, missDate } = useSingleMissBanner(
    focusHabitRef,
    logs as HabitLog[],
    shouldShowModal,
  );

  async function markRecoveryModalShown() {
    if (!focusHabit || !breakRunStartDate) return;
    const key = recoveryModalPreferenceKey(focusHabit.id, breakRunStartDate);
    await setPreference(key, "true");
    await queryClient.invalidateQueries({ queryKey: ["preferences", key] });
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

  async function handleRecoveryRestart() {
    await markRecoveryModalShown();
  }

  async function handleRecoveryMakeItSmaller() {
    if (!focusHabit) return;
    await markRecoveryModalShown();
    router.push({
      pathname: "/(app)/habits/[habitId]/edit",
      params: { habitId: focusHabit.id, from: "recovery" },
    });
  }

  async function handleRecoveryPauseForNow() {
    if (
      recoveryActionLockRef.current ||
      archiveHabitMutation.isPending ||
      !focusHabit
    ) {
      return;
    }
    recoveryActionLockRef.current = true;
    try {
      await archiveHabitMutation.mutateAsync({ habitId: focusHabit.id });
      await markRecoveryModalShown();
    } finally {
      recoveryActionLockRef.current = false;
    }
  }

  async function handleRecoveryClose() {
    await markRecoveryModalShown();
  }

  async function handleBannerDismiss() {
    if (!focusHabit || !missDate) return;
    const key = singleMissBannerPreferenceKey(focusHabit.id, missDate);
    await setPreference(key, "true");
    await queryClient.invalidateQueries({ queryKey: ["preferences", key] });
  }

  if (isLoading) {
    return <LoadingState message="Loading your Today view..." />;
  }

  if (error) {
    return <ErrorState message={getLoadHabitsErrorMessage()} />;
  }

  if (!focusHabit) {
    return (
      <ScrollView
        contentContainerStyle={styles.content}
        contentInsetAdjustmentBehavior="automatic"
        style={styles.screen}
      >
        <SubtleDateHeader />
        <View style={styles.emptySection}>
          <EmptyState
            body="Start with one Focus habit. Small, repeatable, sized to your worst day."
            title="No active habits yet"
          />
          <PrimaryButton
            label="Create your first habit"
            onPress={() => router.push("/(app)/habits/create")}
          />
        </View>
      </ScrollView>
    );
  }

  return (
    <ScrollView
      contentContainerStyle={styles.content}
      contentInsetAdjustmentBehavior="automatic"
      style={styles.screen}
    >
      <SubtleDateHeader />
      {upsertTodayHabitStatusMutation.error ? (
        <ErrorState message={getSaveTodayStatusErrorMessage()} />
      ) : null}
      <FocusCard
        habit={focusHabit}
        mutation={upsertTodayHabitStatusMutation}
        onDismissBanner={() => void handleBannerDismiss()}
        onLog={handleStatusPress}
        showBanner={showBanner}
      />
      <RecoveryModal
        habitTitle={focusHabit.name}
        onClose={() => void handleRecoveryClose()}
        onMakeItSmaller={() => void handleRecoveryMakeItSmaller()}
        onPauseForNow={() => void handleRecoveryPauseForNow()}
        onRestart={() => void handleRecoveryRestart()}
        visible={shouldShowModal}
      />
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  actionsRow: {
    flexDirection: "row",
    gap: spacing.sm,
  },
  becomingHeader: {
    color: colors.text,
    fontSize: typography.heading,
    fontWeight: "700",
  },
  card: {
    backgroundColor: colors.surface,
    borderRadius: radius.lg,
    gap: spacing.lg,
    padding: spacing.xl,
  },
  content: {
    gap: spacing.xl,
    padding: spacing.xl,
  },
  cueAction: {
    color: colors.textMuted,
    fontSize: typography.body,
    lineHeight: 24,
  },
  dateHeader: {
    color: colors.textMuted,
    fontSize: typography.body,
  },
  emptySection: {
    gap: spacing.lg,
  },
  firstDayCopy: {
    color: colors.text,
    fontSize: typography.body,
    fontStyle: "italic",
    lineHeight: 24,
  },
  missBanner: {
    alignItems: "center",
    backgroundColor: colors.surfaceMuted,
    borderRadius: radius.md,
    flexDirection: "row",
    gap: spacing.sm,
    padding: spacing.md,
  },
  missBannerClose: {
    paddingHorizontal: spacing.xs,
  },
  missBannerCloseText: {
    color: colors.textMuted,
    fontSize: 20,
    fontWeight: "300",
    lineHeight: 22,
  },
  missBannerText: {
    color: colors.textMuted,
    flex: 1,
    fontSize: 14,
    lineHeight: 20,
  },
  screen: {
    backgroundColor: colors.background,
    flex: 1,
  },
});
