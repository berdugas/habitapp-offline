import { useRef } from "react";
import { ScrollView, StyleSheet, Text, View } from "react-native";
import { router } from "expo-router";

import { Heatmap } from "@/components/Heatmap";
import { IdentityStreakDisplay } from "@/components/IdentityStreakDisplay";
import { PrimaryButton } from "@/components/buttons/PrimaryButton";
import { SecondaryButton } from "@/components/buttons/SecondaryButton";
import { EmptyState } from "@/components/feedback/EmptyState";
import { ErrorState } from "@/components/feedback/ErrorState";
import { LoadingState } from "@/components/feedback/LoadingState";
import { extractIdentityNoun } from "@/features/onboarding/identityNoun";
import {
  useHabitLogsForRange,
  useTodayHabits,
  useUpsertTodayHabitStatusMutation,
} from "@/features/today/hooks";
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
};

function FocusCard({ habit, mutation, onLog }: FocusCardProps) {
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
  const { error, habits, isLoading } = useTodayHabits();
  const upsertTodayHabitStatusMutation = useUpsertTodayHabitStatusMutation();
  const statusSubmitLockRef = useRef(false);

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

  const focusHabit = habits.find((h) => h.habitState === "focus") ?? null;

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
        onLog={handleStatusPress}
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
  screen: {
    backgroundColor: colors.background,
    flex: 1,
  },
});
