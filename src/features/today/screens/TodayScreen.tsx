import React, { useRef } from "react";
import { Target } from "lucide-react-native";
import {
  LayoutAnimation,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { router } from "expo-router";
import { useQueryClient } from "@tanstack/react-query";

import { AppLogo } from "@/components/branding/AppLogo";
import { ConcentricRings } from "@/components/branding/ConcentricRings";
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
import { AccessGateBanner } from "@/features/trial/AccessGateBanner";
import { isReadOnly as computeIsReadOnly, isPaywallLocked } from "@/features/trial/accessMode";
import { useTrialValidation } from "@/features/trial/hooks";
import { usePaywall } from "@/features/paywall/PaywallController";
import { setPreference } from "@/lib/db/repositories/preferences";
import { useTheme } from "@/theme/useTheme";
import { useThemedStyles } from "@/theme/useThemedStyles";
import { useTodayAnchorDate } from "@/utils/dayBoundary";
import {
  getLoadHabitsErrorMessage,
  getSaveTodayStatusErrorMessage,
} from "@/utils/userFacingErrors";

import type { HabitLogStatus } from "@/features/habits/types";
import type { HabitLog } from "@/lib/db/repositories/habit_logs";


function AppHeader() {
  const styles = useThemedStyles((t) =>
    StyleSheet.create({
      header: {
        alignItems: "center",
        flexDirection: "row",
        justifyContent: "space-between",
      },
      headerBrand: {
        alignItems: "center",
        flexDirection: "row",
        gap: t.spacing.sm,
      },
      appName: {
        color: t.colors.primary,
        fontFamily: t.fontFamilies.bodySemi,
        fontSize: t.typography.labelMd,
        letterSpacing: 1.5,
        textTransform: "uppercase",
      },
      dateText: {
        color: t.colors.textMuted,
        fontFamily: t.fontFamilies.body,
        fontSize: t.typography.bodyLg,
      },
    }),
  );

  const today = useTodayAnchorDate();
  const label = today.toLocaleDateString(undefined, {
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
  const theme = useTheme();
  const styles = useThemedStyles((t) =>
    StyleSheet.create({
      content: {
        gap: t.spacing.xl,
        padding: t.spacing.xl,
      },
      emptyBody: {
        color: t.colors.textMuted,
        fontFamily: t.fontFamilies.body,
        fontSize: t.typography.bodyLg,
        lineHeight: 21.0,
      },
      emptyCenterWrap: {
        flex: 1,
        justifyContent: "center",
      },
      emptyContent: {
        flexGrow: 1,
        gap: t.spacing.xl,
        padding: t.spacing.xl,
      },
      emptyEmblem: {
        alignSelf: "center",
      },
      emptyTitle: {
        color: t.colors.text,
        fontFamily: t.fontFamilies.displaySemi,
        fontSize: t.typography.headlineLg,
      },
      screen: {
        backgroundColor: t.colors.bg,
        flex: 1,
      },
      newGoalRow: {
        alignItems: "center",
        alignSelf: "center",
        flexDirection: "row",
        gap: t.spacing.sm,
        paddingVertical: t.spacing.sm,
      },
      newGoalRowPressed: {
        opacity: 0.6,
      },
      newGoalText: {
        color: t.colors.textMuted,
        fontFamily: t.fontFamilies.body,
        fontSize: t.typography.bodyMd,
      },
    }),
  );

  const insets = useSafeAreaInsets();
  const queryClient = useQueryClient();
  const {
    consistencyByIdentity,
    error,
    goalGraduatedByIdentity,
    goalStreaks,
    groups,
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
  const isReadOnly = computeIsReadOnly(accessMode);
  const isFreeTierLocked = isPaywallLocked(accessMode);
  // Gate logging/undo/row-disabled on ONLY offline-stale state, not free-tier.
  // Free-tier users (expired_no_purchase) can always log their 1 habit.
  const isOfflineReadOnly = accessMode === "read_only";
  const { showCapBlockPaywall } = usePaywall();

  function handleNewGoalPress() {
    if (isFreeTierLocked) {
      showCapBlockPaywall("cap_create");
      return;
    }
    router.push("/(app)/habits/create");
  }

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
    // Arm the next layout pass to animate. The post-mutation re-render that
    // picks up the new card status is the one that animates the row sliding
    // to the resolved zone (and the goal sliding to the done zone if this is
    // the last action-needed habit). configureNext is process-wide; see the
    // design spec's "Scoping caveat" for the cross-screen-bleed trade-off.
    LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut);
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
    LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut);
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
        contentContainerStyle={[
          styles.emptyContent,
          { paddingTop: insets.top + theme.spacing.lg },
        ]}
        style={styles.screen}
      >
        <AppHeader />
        {/* Vertically center the card in the remaining space below the
            header. flex:1 + justifyContent:center inside a flexGrow:1
            scroll container puts the CTA closer to thumb reach and
            balances the negative space above and below. */}
        <View style={styles.emptyCenterWrap}>
          <ZenCard>
            {/* Halo emblem — same concentric-ring mark used on the
                onboarding Insight screen. Gives the empty state a
                design-system-native visual anchor (no icon-set
                commitment) and ties first-run continuity from
                onboarding through to the Today empty surface. */}
            <ConcentricRings size={96} style={styles.emptyEmblem} />
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
        </View>
      </ScrollView>
    );
  }

  return (
    <ScrollView
      contentContainerStyle={[styles.content, { paddingTop: insets.top + theme.spacing.lg }]}
      style={styles.screen}
    >
      <AppHeader />
      <AccessGateBanner
        accessMode={accessMode}
        isReconnecting={isValidating}
        onReconnect={() => void refresh()}
      />

      {upsertTodayHabitStatusMutation.error ? (
        <ErrorState message={getSaveTodayStatusErrorMessage()} />
      ) : null}
      {groups.map((group) => {
        const groupHasBanner =
          showBanner && group.habits.some((h) => h.id === missingHabitId);
        const goalGraduated =
          goalGraduatedByIdentity?.[group.identityPhrase] ?? false;

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
              consistencyRate={consistencyByIdentity?.[group.identityPhrase] ?? null}
              goalGraduated={goalGraduated}
              identityPhrase={group.identityPhrase}
              remainingCount={group.habits.filter((h) => !h.offDay && h.todayStatus === null).length}
              onAddHabit={
                isReadOnly
                  ? undefined
                  : isFreeTierLocked
                    ? () => showCapBlockPaywall("cap_create")
                    : () =>
                        router.push({
                          pathname: "/(app)/habits/create",
                          params: { goalIdentityPhrase: group.identityPhrase },
                        })
              }
              onGoalPress={() =>
                router.push({
                  pathname: "/(app)/goals/[identityPhrase]",
                  params: { identityPhrase: encodeURIComponent(group.identityPhrase) },
                })
              }
              reviewDue={reviewDueByIdentity?.[group.identityPhrase] ?? false}
              reviewStatusError={
                reviewStatusErrorByIdentity?.[group.identityPhrase] ?? false
              }
              streak={goalStreaks[group.identityPhrase] ?? 0}
            >
              {group.habits.map((habit) => (
                <HabitRow
                  key={habit.id}
                  disabled={
                    upsertTodayHabitStatusMutation.isPending ||
                    deleteTodayHabitLogMutation.isPending ||
                    isOfflineReadOnly
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
          </React.Fragment>
        );
      })}
      {!isReadOnly || isFreeTierLocked ? (
        <Pressable
          onPress={handleNewGoalPress}
          style={({ pressed }) => [
            styles.newGoalRow,
            pressed && styles.newGoalRowPressed,
          ]}
          accessibilityLabel="Start a new goal"
        >
          <Target color={theme.colors.textMuted} size={16} strokeWidth={1.75} />
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
