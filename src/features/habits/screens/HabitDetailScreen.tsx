import { useEffect, useRef, useState } from "react";
import { Pressable, ScrollView, StyleSheet, Text, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Bell, ChevronLeft, Pencil } from "lucide-react-native";
import { router, useLocalSearchParams } from "expo-router";

import { CalendarGrid } from "@/components/CalendarGrid";
import type { HeatmapLog } from "@/components/CalendarGrid";
import { ReadOnlyBanner } from "@/components/ReadOnlyBanner";
import { PrimaryButton } from "@/components/buttons/PrimaryButton";
import { SecondaryButton } from "@/components/buttons/SecondaryButton";
import { ZenCard } from "@/components/cards/ZenCard";
import { ErrorState } from "@/components/feedback/ErrorState";
import { LoadingState } from "@/components/feedback/LoadingState";
import { Eyebrow } from "@/components/text/Eyebrow";
import { LucideIcon } from "@/components/LucideIconPicker";
import { isWithinRetroWindow } from "@/features/habits/api";
import { isActiveDay, parseActiveDays } from "@/features/habits/activeDays";
import { getFrequencyLabel } from "@/features/habits/formatters";
import { checkGraduationEligibility } from "@/features/graduation/eligibility";
import { useLatestSRHIQuery } from "@/features/graduation/hooks";
import { ConsistencyDonut } from "@/features/today/components/ConsistencyDonut";
import { cancelReminder, requestPermission } from "@/features/reminders/notifications";
import { RetroLogSelector } from "@/features/habits/components/RetroLogSelector";
import {
  useArchiveHabitMutation,
  useHabitDetail,
  useUpsertHabitLogMutation,
} from "@/features/habits/hooks";
import { getStreakCopy } from "@/features/today/streakCopy";
import { isWeeklyReviewDue } from "@/features/reviews/due";
import { useLatestWeeklyReviewQuery } from "@/features/reviews/hooks";
import { useTrialValidation } from "@/features/trial/hooks";
import { useHabitLogsForRange } from "@/features/today/hooks";
import { getReminderByHabitId } from "@/lib/db/repositories/reminders";
import { useAuthSession } from "@/features/auth/hooks";
import { now } from "@/utils/clock";
import { getWeekStartDateString, toDeviceDateString } from "@/utils/dates";
import { colors } from "@/theme/colors";
import { fontFamilies } from "@/theme/fontFamilies";
import { radius } from "@/theme/radius";
import { spacing } from "@/theme/spacing";
import { typography } from "@/theme/typography";
import {
  getLoadHabitDetailErrorMessage,
  getUpdateHabitActiveStateErrorMessage,
} from "@/utils/userFacingErrors";

import type { HabitLogStatus, HabitRecord } from "@/features/habits/types";
import type { ReminderType } from "@/lib/db/repositories/reminders";

function formatDisplayTime(hhmm: string): string {
  const [h, m] = hhmm.split(":").map(Number);
  const ampm = h < 12 ? "AM" : "PM";
  const displayH = h === 0 ? 12 : h > 12 ? h - 12 : h;
  return `${displayH}:${String(m).padStart(2, "0")} ${ampm}`;
}

function formatGraduationDate(isoString: string): string {
  const date = new Date(isoString);
  return date.toLocaleDateString("en-US", { month: "long", year: "numeric" });
}

export default function HabitDetailScreen() {
  const { habitId, goalConsistency } = useLocalSearchParams<{
    habitId?: string | string[];
    goalConsistency?: string;
  }>();
  const { top } = useSafeAreaInsets();
  const activeStateSubmitLockRef = useRef(false);
  const { user } = useAuthSession();
  const {
    error,
    formula,
    habit,
    isLoading,
    isUpcoming,
    progress,
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
  // Fetch logs covering the full range from start_date (or 35 days minimum)
  const calendarDays = (() => {
    if (!habit?.start_date) return 35;
    const start = new Date(`${habit.start_date}T12:00:00`);
    const diff = Math.ceil((now().getTime() - start.getTime()) / (1000 * 60 * 60 * 24)) + 1;
    return Math.max(diff, 35);
  })();
  const calendarLogs = useHabitLogsForRange(habit?.id, calendarDays).data ?? [];
  const { accessMode, isValidating, refresh } = useTrialValidation();
  const isReadOnly = accessMode === "read_only";

  // Weekly review state
  const todayDate = toDeviceDateString(now());
  const currentWeekStart = getWeekStartDateString(now());
  const latestReviewQuery = useLatestWeeklyReviewQuery(habitId);
  const latestReview = latestReviewQuery.data ?? null;
  const latestReviewErrored = Boolean(latestReviewQuery.error);
  // Fail closed on read errors: if we can't confirm whether a review exists
  // for this week, do NOT show "Start review" (which would let the user write
  // a duplicate review row over an already-saved one). The goal-level surfaces
  // make the same choice.
  const isReviewDue =
    habit && !latestReviewErrored
      ? isWeeklyReviewDue({ currentWeekStart, habit, latestReview, todayDate })
      : false;
  const isReviewedThisWeek =
    !latestReviewErrored && latestReview?.week_start === currentWeekStart;

  // Habits with an identity_phrase open the goal-level review flow.
  // Orphan habits fall back to the legacy per-habit review route.
  function openReview(habitForReview: HabitRecord, _source: string) {
    if (habitForReview.identity_phrase) {
      router.push({
        params: {
          identityPhrase: encodeURIComponent(habitForReview.identity_phrase),
          returnTo: "habitDetail",
        },
        pathname: "/(app)/reviews/goal/[identityPhrase]",
      });
      return;
    }
    router.push({
      params: { habitId: habitForReview.id, returnTo: "habitDetail" },
      pathname: "/(app)/reviews/[habitId]",
    });
  }

  // Reminder state
  const [reminderEnabled, setReminderEnabled] = useState(false);
  const [reminderType, setReminderType] = useState<ReminderType>("backup");
  const [reminderTime, setReminderTime] = useState("09:00");

  useEffect(() => {
    if (!habit) return;
    getReminderByHabitId(habit.id).then((r) => {
      if (r && r.reminder_type !== "none") {
        setReminderEnabled(true);
        setReminderType(r.reminder_type);
        setReminderTime(r.reminder_time ?? "09:00");
      }
    });
  }, [habit?.id]);


  const activeDays = habit ? parseActiveDays(habit.active_days) : [1,2,3,4,5,6,7];
  const frequencyLabel = getFrequencyLabel(activeDays);
  const goalConsistencyPct = goalConsistency ? Math.round(Number(goalConsistency) * 100) : null;

  // Count active days from start_date to today for consistency suppression
  const activeDaysCount = (() => {
    if (!habit) return 0;
    const start = habit.start_date
      ? new Date(`${habit.start_date}T12:00:00`)
      : now();
    const today = now();
    today.setHours(0, 0, 0, 0);
    let count = 0;
    const d = new Date(start);
    d.setHours(0, 0, 0, 0);
    while (d <= today) {
      if (isActiveDay(d, activeDays)) count++;
      d.setDate(d.getDate() + 1);
    }
    return count;
  })();

  // Gate on isSuccess: a loading/errored SRHI query would otherwise skip the cooldown branch and flash the prompt for a cooldown habit.
  const latestSRHIQuery = useLatestSRHIQuery(habit?.id);
  const graduationEligibility =
    habit && latestSRHIQuery.isSuccess
      ? checkGraduationEligibility({
          activeDaysElapsed: activeDaysCount,
          consistencyRate: progress.consistencyRate,
          habit,
          latestSRHI: latestSRHIQuery.data ?? null,
          todayDate,
        })
      : null;

  // Count done/active days from start_date to today for the header counter
  const calendarDoneCount = (calendarLogs as HeatmapLog[]).filter((l) => l.status === "done").length;
  const calendarActiveDayCount = (() => {
    if (!habit) return 0;
    const start = habit.start_date
      ? new Date(`${habit.start_date}T12:00:00`)
      : (() => { const d = now(); d.setDate(d.getDate() - 29); return d; })();
    const today = now();
    today.setHours(0, 0, 0, 0);
    let count = 0;
    const d = new Date(start);
    d.setHours(0, 0, 0, 0);
    while (d <= today) {
      if (isActiveDay(d, activeDays)) count++;
      d.setDate(d.getDate() + 1);
    }
    return count;
  })();

  function handleCellPress(date: string) {
    if (!habit) return;
    if (date < habit.start_date) return;
    const existing = (calendarLogs as HeatmapLog[]).find((log) => log.log_date === date);
    const currentStatus = existing?.status ?? null;
    const withinWindow = isWithinRetroWindow(date, now());
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
    if (!habit || activeStateSubmitLockRef.current || archiveHabitMutation.isPending) return;
    activeStateSubmitLockRef.current = true;
    try {
      await archiveHabitMutation.mutateAsync({ habitId: habit.id });
      // Cancel any scheduled reminder after archive (non-fatal)
      await cancelReminder(habit.id).catch(() => {});
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
        contentContainerStyle={[styles.content, { paddingTop: top + spacing.xl }]}
        style={styles.screen}
      >
        <View style={styles.backRow}>
          <Pressable
            hitSlop={12}
            onPress={() => {
              if (router.canGoBack()) router.back();
              else router.replace("/(app)/(tabs)/today");
            }}
            style={styles.backButton}
          >
            <ChevronLeft color={colors.textMuted} size={22} strokeWidth={1.75} />
          </Pressable>
        </View>
        <ErrorState message={getLoadHabitDetailErrorMessage()} />
        <SecondaryButton
          label="Back to Today"
          onPress={() => router.push("/(app)/(tabs)/today")}
        />
      </ScrollView>
    );
  }

  return (
    <ScrollView
      contentContainerStyle={[styles.content, { paddingTop: top + spacing.xl }]}
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
        <Pressable
          hitSlop={12}
          onPress={() => {
            if (router.canGoBack()) router.back();
            else router.replace("/(app)/(tabs)/today");
          }}
          style={styles.backButton}
        >
          <ChevronLeft color={colors.textMuted} size={22} strokeWidth={1.75} />
        </Pressable>
        {habit.identity_phrase ? (
          <Pressable
            onPress={() =>
              router.push({
                pathname: "/(app)/goals/[identityPhrase]",
                params: { identityPhrase: encodeURIComponent(habit.identity_phrase!) },
              })
            }
          >
            <Text selectable style={styles.goalLabel}>
              Become {habit.identity_phrase}
            </Text>
          </Pressable>
        ) : null}
        <View style={styles.habitTitleRow}>
          {habit.icon ? (
            <LucideIcon name={habit.icon} size={22} color={colors.primary} strokeWidth={1.75} />
          ) : null}
          <Text selectable style={styles.habitTitle}>{habit.title}</Text>
          <Pressable
            disabled={isReadOnly}
            hitSlop={12}
            onPress={() =>
              router.push({
                pathname: "/(app)/habits/[habitId]/edit",
                params: { habitId: habit.id },
              })
            }
          >
            <Pencil color={isReadOnly ? colors.textFaint : colors.primary} size={16} strokeWidth={1.75} />
          </Pressable>
        </View>
        {habit.habit_state === "automatic" ? (
          <View style={styles.graduatedBadge}>
            <Text style={styles.graduatedBadgeText}>
              {habit.automated_at
                ? `Automatic since ${formatGraduationDate(habit.automated_at)}`
                : "Automatic"}
            </Text>
          </View>
        ) : null}
        <Text selectable style={styles.formulaText}>{formula}</Text>
        <Text selectable style={styles.frequencyText}>{frequencyLabel}</Text>
        {habit.preferred_time_window ? (
          <Text selectable style={styles.frequencyText}>{habit.preferred_time_window}</Text>
        ) : null}
        {reminderEnabled ? (
          <View style={styles.reminderSummary}>
            <Bell color={colors.textFaint} size={12} strokeWidth={1.75} />
            <Text style={styles.reminderSummaryText}>
              {reminderType === "backup" ? "Backup reminder" : "Daily reminder"}{" · "}{formatDisplayTime(reminderTime)}
            </Text>
          </View>
        ) : null}
      </View>

      {/* Metric cards */}
      {!isUpcoming ? (
        <View style={styles.metricsRow}>
          <ZenCard gap={spacing.sm} style={styles.metricCard}>
            <Eyebrow label="Habit consistency" />
            <View style={styles.metricCenter}>
              {activeDaysCount >= 7 ? (
                <ConsistencyDonut rate={progress.consistencyRate} size={36} label="" />
              ) : (
                <Text style={styles.tooEarlyText}>
                  Too early to tell — keep showing up
                </Text>
              )}
            </View>
          </ZenCard>
          <ZenCard gap={spacing.sm} style={styles.metricCard}>
            <Eyebrow label="Habit streak" />
            <View style={styles.metricCenter}>
              {progress.streak === 0 && activeDaysCount === 0 ? (
                <Text style={styles.metricEmpty}>—</Text>
              ) : (
                <>
                  <Text style={styles.streakLargeNumber}>{progress.streak}</Text>
                  {progress.skipCount > 0 ? (
                    <Text style={styles.skipCountText}>{progress.skipCount} skips</Text>
                  ) : null}
                </>
              )}
            </View>
          </ZenCard>
        </View>
      ) : null}

      {/* 30-day calendar */}
      {!isUpcoming ? (
        <ZenCard>
          <View style={styles.calendarHeader}>
            <Eyebrow label="Activity" />
            <Text style={styles.calendarCounter}>
              {calendarDoneCount} of {calendarActiveDayCount} active days
            </Text>
          </View>
          <CalendarGrid
            activeDays={activeDays}
            logs={calendarLogs as HeatmapLog[]}
            onCellPress={handleCellPress}
            startDate={habit.start_date}
          />
        </ZenCard>
      ) : null}

      {/* Graduation prompt card */}
      {!isReadOnly && habit && graduationEligibility?.eligible ? (
        <ZenCard>
          <Eyebrow label="Graduation" />
          <Text style={styles.graduationPromptText}>
            This habit has been with you for a while. Ready to check if it&apos;s become automatic?
          </Text>
          <PrimaryButton
            label="Start reflection"
            onPress={() =>
              router.push({
                pathname: "/(app)/graduation/[habitId]",
                params: { habitId: habit.id },
              })
            }
          />
        </ZenCard>
      ) : null}

      {/* Weekly Review card */}
      {!isReadOnly && habit?.status === "active" && latestReviewErrored ? (
        <ZenCard>
          <Eyebrow label="Weekly Review" />
          <Text style={styles.reviewErrorText}>
            We couldn't check your review status.
          </Text>
          <SecondaryButton
            disabled={latestReviewQuery.isFetching}
            label={latestReviewQuery.isFetching ? "Retrying..." : "Retry"}
            onPress={() => void latestReviewQuery.refetch()}
          />
        </ZenCard>
      ) : null}
      {!isReadOnly && habit?.status === "active" && (isReviewDue || isReviewedThisWeek) ? (
        <ZenCard>
          <Eyebrow label="Weekly Review" />
          {isReviewDue ? (
            <>
              <Text style={styles.reviewPromptText}>
                Time for a quick reflection on this habit.
              </Text>
              <PrimaryButton
                label="Start review"
                onPress={() => openReview(habit, "Start review")}
              />
            </>
          ) : (
            <>
              <Text style={styles.reviewCompletedText}>Reviewed this week ✓</Text>
              <Pressable onPress={() => openReview(habit, "Review again")}>
                <Text style={styles.reviewAgainLink}>Review again</Text>
              </Pressable>
            </>
          )}
        </ZenCard>
      ) : null}



      {/* Archive */}
      <View style={styles.actions}>
        {archiveHabitMutation.error ? (
          <ErrorState message={getUpdateHabitActiveStateErrorMessage()} />
        ) : null}
        {habit.status === "active" ? (
          <>
            <View style={styles.actionHelperCard}>
              <Text selectable style={styles.actionHelperTitle}>Archive habit</Text>
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
            <Text selectable style={styles.actionHelperTitle}>Archived</Text>
            <Text selectable style={styles.actionHelperBody}>
              This habit is archived. Reactivation coming in a future release.
            </Text>
          </View>
        )}
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

const styles = StyleSheet.create({
  actionHelperBody: {
    color: colors.textMuted,
    fontFamily: fontFamilies.body,
    fontSize: 14,
    lineHeight: 20,
  },
  actionHelperCard: {
    backgroundColor: colors.surface,
    borderRadius: 12,
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
  backButton: {
    alignItems: "center",
    height: 36,
    justifyContent: "center",
    width: 36,
  },
  calendarCounter: {
    color: colors.textFaint,
    fontFamily: fontFamilies.body,
    fontSize: 12,
  },
  calendarHeader: {
    alignItems: "center",
    flexDirection: "row",
    justifyContent: "space-between",
    marginBottom: spacing.sm,
  },
  backRow: {
    marginBottom: spacing.sm,
  },
  formulaText: {
    color: colors.textMuted,
    fontFamily: fontFamilies.body,
    fontSize: typography.bodyLg,
    fontStyle: "italic",
    lineHeight: 22,
  },
  graduatedBadge: {
    alignSelf: "flex-start",
    backgroundColor: colors.graduatedBadge,
    borderRadius: radius.pill,
    paddingHorizontal: spacing.sm + 2,
    paddingVertical: spacing.xs,
  },
  graduatedBadgeText: {
    color: colors.graduatedCircle,
    fontFamily: fontFamilies.bodySemi,
    fontSize: typography.micro,
  },
  graduationPromptText: {
    color: colors.textMuted,
    fontFamily: fontFamilies.body,
    fontSize: typography.bodyLg,
    lineHeight: 24,
  },
  frequencyText: {
    color: colors.textFaint,
    fontFamily: fontFamilies.body,
    fontSize: typography.bodyMd,
  },
  goalBreadcrumb: {
    color: colors.textFaint,
    fontFamily: fontFamilies.body,
    fontSize: typography.bodyMd,
    textAlign: "center",
  },
  metricsRow: {
    flexDirection: "row",
    gap: spacing.md,
  },
  metricCard: {
    flex: 1,
  },
  metricCenter: {
    alignItems: "center",
    justifyContent: "center",
    minHeight: 36,
  },
  metricEmpty: {
    fontFamily: fontFamilies.displayBold,
    fontSize: 22,
    color: colors.textFaint,
  },
  tooEarlyText: {
    color: colors.textFaint,
    fontFamily: fontFamilies.body,
    fontSize: typography.bodyMd,
    lineHeight: 18,
    textAlign: "center",
  },
  streakLargeNumber: {
    color: colors.text,
    fontFamily: fontFamilies.displayBold,
    fontSize: typography.headlineLg,
  },
  skipCountText: {
    color: colors.textFaint,
    fontFamily: fontFamilies.body,
    fontSize: typography.micro,
    marginTop: 2,
  },
  content: {
    gap: spacing.xl,
    padding: spacing.xl,
  },
  editButton: {
    alignItems: "center",
    height: 32,
    justifyContent: "center",
    width: 32,
  },
  goalLabel: {
    color: colors.primary,
    fontFamily: fontFamilies.bodySemi,
    fontSize: 13,
    letterSpacing: 0.5,
    marginBottom: spacing.xs,
  },
  habitTitle: {
    color: colors.text,
    fontFamily: fontFamilies.displayBold,
    fontSize: typography.headlineLg,
    flex: 1,
  },
  habitTitleRow: {
    alignItems: "center",
    flexDirection: "row",
    gap: spacing.sm,
    marginBottom: spacing.xs,
    justifyContent: "space-between",
  },
  header: {
    gap: 4,
  },
  reminderSummary: {
    flexDirection: "row",
    alignItems: "center",
    gap: 5,
    marginTop: 2,
  },
  reminderSummaryText: {
    fontFamily: fontFamilies.body,
    fontSize: 12,
    color: colors.textFaint,
  },
  editReminderButton: {
    marginTop: spacing.xs,
  },
  editReminderLabel: {
    color: colors.primary,
    fontFamily: fontFamilies.bodyMedium,
    fontSize: 14,
  },
  reminderEditor: {
    gap: spacing.md,
    marginTop: spacing.sm,
  },
  reminderHeader: {
    alignItems: "center",
    flexDirection: "row",
    justifyContent: "space-between",
    marginBottom: spacing.xs,
  },
  reminderPlaceholder: {
    color: colors.textFaint,
    fontFamily: fontFamilies.body,
    fontSize: 14,
  },
  reminderSaveButton: {
    alignItems: "center",
    backgroundColor: colors.primary,
    borderRadius: radius.md,
    paddingVertical: spacing.sm + 2,
  },
  reminderSaveLabel: {
    color: colors.primaryText,
    fontFamily: fontFamilies.bodySemi,
    fontSize: 15,
  },
  reminderTimeChip: {
    borderColor: colors.surfaceHigh,
    borderRadius: radius.pill,
    borderWidth: 1,
    paddingHorizontal: spacing.sm + 2,
    paddingVertical: spacing.xs + 1,
  },
  reminderTimeChipSelected: {
    backgroundColor: colors.primarySoft,
    borderColor: colors.primary,
  },
  reminderTimeLabel: {
    color: colors.textMuted,
    fontFamily: fontFamilies.body,
    fontSize: 13,
  },
  reminderTimeLabelSelected: {
    color: colors.primary,
    fontFamily: fontFamilies.bodySemi,
  },
  reminderTimeRow: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: spacing.xs,
  },
  reminderTypeChip: {
    borderColor: colors.surfaceHigh,
    borderRadius: radius.pill,
    borderWidth: 1,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.xs + 1,
  },
  reminderTypeChipSelected: {
    backgroundColor: colors.primarySoft,
    borderColor: colors.primary,
  },
  reminderTypeLabel: {
    color: colors.textMuted,
    fontFamily: fontFamilies.body,
    fontSize: 14,
  },
  reminderTypeLabelSelected: {
    color: colors.primary,
    fontFamily: fontFamilies.bodySemi,
  },
  reminderTypeRow: {
    flexDirection: "row",
    gap: spacing.sm,
  },
  screen: {
    backgroundColor: colors.bg,
    flex: 1,
  },
  setupHeader: {
    alignItems: "center",
    flexDirection: "row",
    justifyContent: "space-between",
    marginBottom: spacing.xs,
  },
  reviewPromptText: {
    color: colors.textMuted,
    fontFamily: fontFamilies.body,
    fontSize: typography.bodyLg,
    lineHeight: 24,
  },
  reviewCompletedText: {
    color: colors.primary,
    fontFamily: fontFamilies.bodySemi,
    fontSize: typography.bodyLg,
  },
  reviewAgainLink: {
    color: colors.textFaint,
    fontFamily: fontFamilies.bodyMedium,
    fontSize: typography.bodyMd,
  },
  reviewErrorText: {
    color: colors.danger,
    fontFamily: fontFamilies.body,
    fontSize: typography.bodyMd,
    lineHeight: 20,
  },
});
