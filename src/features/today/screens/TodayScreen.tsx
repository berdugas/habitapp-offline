import React, { useRef } from "react";
import { Target } from "lucide-react-native";
import { Pressable, ScrollView, StyleSheet, Text, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { router } from "expo-router";
import { useQueryClient } from "@tanstack/react-query";

import { AppLogo } from "@/components/branding/AppLogo";
import { ReadOnlyBanner } from "@/components/ReadOnlyBanner";
import { RecoveryModal } from "@/components/RecoveryModal";
import { PrimaryButton } from "@/components/buttons/PrimaryButton";
import { ZenCard } from "@/components/cards/ZenCard";
import { ErrorState } from "@/components/feedback/ErrorState";
import { LoadingState } from "@/components/feedback/LoadingState";
import { MissBanner } from "@/components/feedback/MissBanner";
import { GoalContainer } from "@/features/today/components/GoalContainer";
import { HabitRow } from "@/features/today/components/HabitRow";
import {
  useDeleteTodayHabitLogMutation,
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
import { useArchiveHabitMutation } from "@/features/habits/hooks";
import { useTrialValidation } from "@/features/trial/hooks";
import { setPreference } from "@/lib/db/repositories/preferences";
import { colors } from "@/theme/colors";
import { fontFamilies } from "@/theme/fontFamilies";
import { spacing } from "@/theme/spacing";
import { typography } from "@/theme/typography";
import { avgConsistencyRate } from "@/features/today/goalMetrics";
import { NO_GOAL_KEY } from "@/features/today/constants";
import {
  getLoadHabitsErrorMessage,
  getSaveTodayStatusErrorMessage,
} from "@/utils/userFacingErrors";

import type { TodayHabitCardData } from "@/features/today/types";
import type { HabitLogStatus } from "@/features/habits/types";
import type { HabitLog } from "@/lib/db/repositories/habit_logs";

type GoalGroup = {
  identityPhrase: string;
  habits: TodayHabitCardData[];
};

function groupByIdentity(habits: TodayHabitCardData[]): GoalGroup[] {
  const map = new Map<string, TodayHabitCardData[]>();
  for (const habit of habits) {
    const key = habit.identityPhrase || NO_GOAL_KEY;
    const group = map.get(key) ?? [];
    group.push(habit);
    map.set(key, group);
  }
  return Array.from(map.entries()).map(([identityPhrase, groupHabits]) => ({
    identityPhrase,
    habits: groupHabits,
  }));
}


function AppHeader() {
  const label = new Date().toLocaleDateString(undefined, {
    day: "numeric",
    month: "long",
    weekday: "long",
  });
  return (
    <View style={styles.header}>
      <View style={styles.headerBrand}>
        <AppLogo size={28} animated={false} />
        <Text style={styles.appName}>Habitapp</Text>
      </View>
      <Text selectable style={styles.dateText}>
        {label}
      </Text>
    </View>
  );
}

export default function TodayScreen() {
  const insets = useSafeAreaInsets();
  const queryClient = useQueryClient();
  const {
    error,
    goalGraduatedByIdentity,
    goalStreaks,
    habits,
    isLoading,
    reviewDueByIdentity,
    reviewStatusErrorByIdentity,
  } = useTodayHabits();
  const upsertTodayHabitStatusMutation = useUpsertTodayHabitStatusMutation();
  const deleteTodayHabitLogMutation = useDeleteTodayHabitLogMutation();
  const archiveHabitMutation = useArchiveHabitMutation();
  const statusSubmitLockRef = useRef(false);
  const recoveryActionLockRef = useRef(false);
  const { accessMode, isValidating, refresh } = useTrialValidation();
  const isReadOnly = accessMode === "read_only";

  const habitRefs = habits.map((h) => ({
    id: h.id,
    start_date: h.startDate,
    title: h.name,
  }));

  const { shouldShowModal, triggeringHabit, breakRunStartDate, logs } =
    useRecoveryCheck(habitRefs);
  const { showBanner, missDate, missingHabitId } = useSingleMissBanner(
    habitRefs,
    logs as HabitLog[],
    shouldShowModal,
  );

  async function markRecoveryModalShown() {
    if (!triggeringHabit || !breakRunStartDate) return;
    const key = recoveryModalPreferenceKey(triggeringHabit.id, breakRunStartDate);
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
      await upsertTodayHabitStatusMutation.mutateAsync({ habitId, status });
    } finally {
      statusSubmitLockRef.current = false;
    }
  }

  async function handleUndo(habitId: string) {
    if (statusSubmitLockRef.current || deleteTodayHabitLogMutation.isPending) {
      return;
    }
    statusSubmitLockRef.current = true;
    try {
      await deleteTodayHabitLogMutation.mutateAsync(habitId);
    } finally {
      statusSubmitLockRef.current = false;
    }
  }

  async function handleRecoveryRestart() {
    await markRecoveryModalShown();
  }

  async function handleRecoveryMakeItSmaller() {
    if (!triggeringHabit) return;
    await markRecoveryModalShown();
    router.push({
      pathname: "/(app)/habits/[habitId]/edit",
      params: { habitId: triggeringHabit.id, from: "recovery" },
    });
  }

  async function handleRecoveryPauseForNow() {
    if (
      recoveryActionLockRef.current ||
      archiveHabitMutation.isPending ||
      !triggeringHabit
    ) {
      return;
    }
    recoveryActionLockRef.current = true;
    try {
      await archiveHabitMutation.mutateAsync({ habitId: triggeringHabit.id });
      await markRecoveryModalShown();
    } finally {
      recoveryActionLockRef.current = false;
    }
  }

  async function handleRecoveryClose() {
    await markRecoveryModalShown();
  }

  async function handleBannerDismiss() {
    if (!missingHabitId || !missDate) return;
    const key = singleMissBannerPreferenceKey(missingHabitId, missDate);
    await setPreference(key, "true");
    await queryClient.invalidateQueries({ queryKey: ["preferences", key] });
  }

  if (isLoading) {
    return <LoadingState message="Loading your Today view..." />;
  }

  if (error) {
    return <ErrorState message={getLoadHabitsErrorMessage()} />;
  }

  if (habits.length === 0) {
    return (
      <ScrollView
        contentContainerStyle={[styles.content, { paddingTop: insets.top + spacing.xxl }]}
        style={styles.screen}
      >
        <AppHeader />
        <ZenCard>
          <Text selectable style={styles.emptyTitle}>
            No active habits yet
          </Text>
          <Text selectable style={styles.emptyBody}>
            Start with one small habit — sized to your worst day.
          </Text>
          <PrimaryButton
            label="Create your first habit"
            onPress={() => router.push("/(app)/habits/create")}
          />
        </ZenCard>
      </ScrollView>
    );
  }

  const goalGroups = groupByIdentity(habits);

  return (
    <ScrollView
      contentContainerStyle={[styles.content, { paddingTop: insets.top + spacing.xxl }]}
      style={styles.screen}
    >
      <AppHeader />
      {isReadOnly ? (
        <ReadOnlyBanner
          isReconnecting={isValidating}
          onReconnect={() => void refresh()}
        />
      ) : null}
      {upsertTodayHabitStatusMutation.error ? (
        <ErrorState message={getSaveTodayStatusErrorMessage()} />
      ) : null}
      {goalGroups.map((group) => {
        const activeHabits = group.habits.filter((h) => !h.offDay);
        const allLogged = activeHabits.length > 0 &&
          activeHabits.every((h) => h.todayStatus !== null);
        const groupHasBanner =
          showBanner && group.habits.some((h) => h.id === missingHabitId);
        const goalGraduated =
          group.identityPhrase !== NO_GOAL_KEY &&
          (goalGraduatedByIdentity?.[group.identityPhrase] ?? false);

        return (
          <React.Fragment key={group.identityPhrase}>
            <GoalContainer
              banner={
                groupHasBanner ? (
                  <MissBanner
                    onDismiss={() => void handleBannerDismiss()}
                  />
                ) : null
              }
              consistencyRate={avgConsistencyRate(group.habits)}
              goalGraduated={goalGraduated}
              identityPhrase={group.identityPhrase}
              remainingCount={group.habits.filter((h) => !h.offDay && h.todayStatus === null).length}
              onAddHabit={
                isReadOnly
                  ? undefined
                  : () =>
                      router.push({
                        pathname: "/(app)/habits/create",
                        ...(group.identityPhrase !== NO_GOAL_KEY && {
                          params: { goalIdentityPhrase: group.identityPhrase },
                        }),
                      })
              }
              onGoalPress={
                group.identityPhrase !== NO_GOAL_KEY
                  ? () =>
                      router.push({
                        pathname: "/(app)/goals/[identityPhrase]",
                        params: { identityPhrase: encodeURIComponent(group.identityPhrase) },
                      })
                  : undefined
              }
              reviewDue={
                group.identityPhrase !== NO_GOAL_KEY &&
                (reviewDueByIdentity?.[group.identityPhrase] ?? false)
              }
              reviewStatusError={
                group.identityPhrase !== NO_GOAL_KEY &&
                (reviewStatusErrorByIdentity?.[group.identityPhrase] ?? false)
              }
              streak={goalStreaks[group.identityPhrase] ?? 0}
            >
              {group.habits.map((habit) => (
                <HabitRow
                  key={habit.id}
                  disabled={
                    upsertTodayHabitStatusMutation.isPending ||
                    deleteTodayHabitLogMutation.isPending ||
                    isReadOnly
                  }
                  graduated={habit.habitState === "automatic"}
                  habit={habit}
                  offDay={habit.offDay}
                  onDone={(id) => void handleStatusPress(id, "done")}
                  onNavigate={(id) =>
                    router.push({
                      pathname: "/(app)/habits/[habitId]",
                      params: { habitId: id },
                    })
                  }
                  onSkip={(id) => void handleStatusPress(id, "skipped")}
                  onUndo={(id) => void handleUndo(id)}
                />
              ))}
            </GoalContainer>
            {allLogged ? (
              <Text style={styles.completionText}>You showed up today.</Text>
            ) : null}
          </React.Fragment>
        );
      })}
      {!isReadOnly ? (
        <Pressable
          onPress={() => router.push("/(app)/habits/create")}
          style={({ pressed }) => [
            styles.newGoalRow,
            pressed && styles.newGoalRowPressed,
          ]}
          accessibilityLabel="Start a new goal"
        >
          <Target color={colors.textMuted} size={16} strokeWidth={1.75} />
          <Text style={styles.newGoalText}>Start a new goal</Text>
        </Pressable>
      ) : null}
      <RecoveryModal
        habitTitle={triggeringHabit?.title ?? habits[0]?.name ?? ""}
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
  completionText: {
    color: colors.textMuted,
    fontFamily: fontFamilies.body,
    fontSize: typography.bodyMd,
    textAlign: "center",
  },
  content: {
    gap: spacing.xl,
    padding: spacing.xl,
  },
  dateText: {
    color: colors.textMuted,
    fontFamily: fontFamilies.body,
    fontSize: typography.bodyLg,
  },
  emptyBody: {
    color: colors.textMuted,
    fontFamily: fontFamilies.body,
    fontSize: typography.bodyLg,
    lineHeight: 24,
  },
  emptyTitle: {
    color: colors.text,
    fontFamily: fontFamilies.displaySemi,
    fontSize: typography.headlineLg,
  },
  appName: {
    color: colors.primary,
    fontFamily: fontFamilies.bodySemi,
    fontSize: 13,
    letterSpacing: 1.5,
    textTransform: "uppercase",
  },
  header: {
    alignItems: "center",
    flexDirection: "row",
    justifyContent: "space-between",
  },
  headerBrand: {
    alignItems: "center",
    flexDirection: "row",
    gap: spacing.sm,
  },
  screen: {
    backgroundColor: colors.bg,
    flex: 1,
  },
  newGoalRow: {
    alignItems: "center",
    alignSelf: "center",
    flexDirection: "row",
    gap: spacing.sm,
    paddingVertical: spacing.sm,
  },
  newGoalRowPressed: {
    opacity: 0.6,
  },
  newGoalText: {
    color: colors.textMuted,
    fontFamily: fontFamilies.body,
    fontSize: 14,
  },
});
