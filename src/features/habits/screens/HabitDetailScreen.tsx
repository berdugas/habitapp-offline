import { useEffect, useMemo, useRef, useState } from "react";
import { Pressable, ScrollView, StyleSheet, Text, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Bell, ChevronLeft, Pencil } from "lucide-react-native";
import { router, useLocalSearchParams } from "expo-router";

import type { HeatmapLog } from "@/components/CalendarGrid";
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
import { HabitDetailActions } from "@/features/habits/components/HabitDetailActions";
import { isArchiveIntroSeen } from "@/features/habits/onboardingStorage";
import { ConsistencyDonut } from "@/features/today/components/ConsistencyDonut";
import { GoalStreakStrip } from "@/features/today/components/GoalStreakStrip";
import { WeeklyConsistencyChart } from "@/features/today/components/WeeklyConsistencyChart";
import {
  computeGoalDailyStates,
  computeWeeklyConsistency,
} from "@/features/today/goalMetrics";
import { getGoalNarrative } from "@/features/today/goalNarrativeCopy";
import { RetroLogSelector } from "@/features/habits/components/RetroLogSelector";
import {
  useArchiveHabitMutation,
  useHabitDetail,
  useUpsertHabitLogMutation,
} from "@/features/habits/hooks";
import { getStreakCopy } from "@/features/today/streakCopy";
import { isWeeklyReviewDue } from "@/features/reviews/due";
import { useLatestWeeklyReviewQuery } from "@/features/reviews/hooks";
import { openGoalWeeklyReview } from "@/features/reviews/openReview";
import { AccessGateBanner } from "@/features/trial/AccessGateBanner";
import { isReadOnly as computeIsReadOnly } from "@/features/trial/accessMode";
import { useTrialValidation } from "@/features/trial/hooks";
import { useHabitLogsForRange } from "@/features/today/hooks";
import { getReminderByHabitId } from "@/lib/db/repositories/reminders";
import { useAuthSession } from "@/features/auth/hooks";
import { trackEvent } from "@/services/analytics";
import { now } from "@/utils/clock";
import { useTodayAnchorDate, useTodayDateString } from "@/utils/dayBoundary";
import { daysBetweenDates, getWeekStartDateString, toDeviceDateString } from "@/utils/dates";
import { useTheme } from "@/theme/useTheme";
import { useThemedStyles } from "@/theme/useThemedStyles";
import { getLoadHabitDetailErrorMessage } from "@/utils/userFacingErrors";

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
  const theme = useTheme();
  const styles = useThemedStyles((theme) =>
    StyleSheet.create({
      backButton: {
        alignItems: "center",
        height: 36,
        justifyContent: "center",
        width: 36,
      },
      backRow: {
        marginBottom: theme.spacing.sm,
      },
      formulaText: {
        color: theme.colors.textMuted,
        fontFamily: theme.fontFamilies.body,
        fontSize: theme.typography.bodyLg,
        fontStyle: "italic",
        lineHeight: 19.3,
      },
      graduatedBadge: {
        alignSelf: "flex-start",
        backgroundColor: theme.colors.graduatedBadge,
        borderRadius: theme.radius.pill,
        paddingHorizontal: theme.spacing.sm + 2,
        paddingVertical: theme.spacing.xs,
      },
      graduatedBadgeText: {
        color: theme.colors.graduatedCircle,
        fontFamily: theme.fontFamilies.bodySemi,
        fontSize: theme.typography.micro,
      },
      graduationPromptText: {
        color: theme.colors.textMuted,
        fontFamily: theme.fontFamilies.body,
        fontSize: theme.typography.bodyLg,
        lineHeight: 21,
      },
      frequencyText: {
        color: theme.colors.textFaint,
        fontFamily: theme.fontFamilies.body,
        fontSize: theme.typography.bodyMd,
      },
      goalBreadcrumb: {
        color: theme.colors.textFaint,
        fontFamily: theme.fontFamilies.body,
        fontSize: theme.typography.bodyMd,
        textAlign: "center",
      },
      journeyCard: {
        gap: theme.spacing.md,
      },
      journeyTop: {
        alignItems: "flex-start",
        flexDirection: "row",
        gap: theme.spacing.md,
      },
      narrativeText: {
        color: theme.colors.textMuted,
        flex: 1,
        fontFamily: theme.fontFamilies.body,
        fontSize: theme.typography.bodyMd,
        lineHeight: 20.4,
        paddingTop: 4,
      },
      content: {
        gap: theme.spacing.xl,
        padding: theme.spacing.xl,
      },
      editButton: {
        alignItems: "center",
        height: 32,
        justifyContent: "center",
        width: 32,
      },
      goalLabel: {
        color: theme.colors.primary,
        fontFamily: theme.fontFamilies.bodySemi,
        fontSize: theme.typography.labelMd,
        letterSpacing: 0.5,
        marginBottom: theme.spacing.xs,
      },
      habitTitle: {
        color: theme.colors.text,
        fontFamily: theme.fontFamilies.displayBold,
        fontSize: theme.typography.headlineLg,
        flex: 1,
      },
      habitTitleRow: {
        alignItems: "center",
        flexDirection: "row",
        gap: theme.spacing.sm,
        marginBottom: theme.spacing.xs,
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
        fontFamily: theme.fontFamilies.body,
        fontSize: 12,
        color: theme.colors.textFaint,
      },
      editReminderButton: {
        marginTop: theme.spacing.xs,
      },
      editReminderLabel: {
        color: theme.colors.primary,
        fontFamily: theme.fontFamilies.bodyMedium,
        fontSize: theme.typography.bodyMd,
      },
      reminderEditor: {
        gap: theme.spacing.md,
        marginTop: theme.spacing.sm,
      },
      reminderHeader: {
        alignItems: "center",
        flexDirection: "row",
        justifyContent: "space-between",
        marginBottom: theme.spacing.xs,
      },
      reminderPlaceholder: {
        color: theme.colors.textFaint,
        fontFamily: theme.fontFamilies.body,
        fontSize: theme.typography.bodyMd,
      },
      reminderSaveButton: {
        alignItems: "center",
        backgroundColor: theme.colors.primary,
        borderRadius: theme.radius.md,
        paddingVertical: theme.spacing.sm + 2,
      },
      reminderSaveLabel: {
        color: theme.colors.primaryText,
        fontFamily: theme.fontFamilies.bodySemi,
        fontSize: 15,
      },
      reminderTimeChip: {
        borderColor: theme.colors.surfaceHigh,
        borderRadius: theme.radius.pill,
        borderWidth: 1,
        paddingHorizontal: theme.spacing.sm + 2,
        paddingVertical: theme.spacing.xs + 1,
      },
      reminderTimeChipSelected: {
        backgroundColor: theme.colors.primarySoft,
        borderColor: theme.colors.primary,
      },
      reminderTimeLabel: {
        color: theme.colors.textMuted,
        fontFamily: theme.fontFamilies.body,
        fontSize: theme.typography.labelMd,
      },
      reminderTimeLabelSelected: {
        color: theme.colors.primary,
        fontFamily: theme.fontFamilies.bodySemi,
      },
      reminderTimeRow: {
        flexDirection: "row",
        flexWrap: "wrap",
        gap: theme.spacing.xs,
      },
      reminderTypeChip: {
        borderColor: theme.colors.surfaceHigh,
        borderRadius: theme.radius.pill,
        borderWidth: 1,
        paddingHorizontal: theme.spacing.md,
        paddingVertical: theme.spacing.xs + 1,
      },
      reminderTypeChipSelected: {
        backgroundColor: theme.colors.primarySoft,
        borderColor: theme.colors.primary,
      },
      reminderTypeLabel: {
        color: theme.colors.textMuted,
        fontFamily: theme.fontFamilies.body,
        fontSize: theme.typography.bodyMd,
      },
      reminderTypeLabelSelected: {
        color: theme.colors.primary,
        fontFamily: theme.fontFamilies.bodySemi,
      },
      reminderTypeRow: {
        flexDirection: "row",
        gap: theme.spacing.sm,
      },
      screen: {
        backgroundColor: theme.colors.bg,
        flex: 1,
      },
      setupHeader: {
        alignItems: "center",
        flexDirection: "row",
        justifyContent: "space-between",
        marginBottom: theme.spacing.xs,
      },
      reviewPromptText: {
        color: theme.colors.textMuted,
        fontFamily: theme.fontFamilies.body,
        fontSize: theme.typography.bodyLg,
        lineHeight: 21,
      },
      reviewCompletedText: {
        color: theme.colors.primary,
        fontFamily: theme.fontFamilies.bodySemi,
        fontSize: theme.typography.bodyLg,
      },
      reviewAgainLink: {
        color: theme.colors.textFaint,
        fontFamily: theme.fontFamilies.bodyMedium,
        fontSize: theme.typography.bodyMd,
      },
      reviewErrorText: {
        color: theme.colors.danger,
        fontFamily: theme.fontFamilies.body,
        fontSize: theme.typography.bodyMd,
        lineHeight: 18.6,
      },
    }),
  );

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
  // Suppresses the archived-status redirect during an in-flight archive on
  // this screen. Set true synchronously inside handleArchivePress before
  // mutateAsync runs — the post-mutation refetch flips habit.status to
  // 'archived', which would otherwise fire the redirect effect and race with
  // the handler's own imperative router.replace. Reset on mutation failure so
  // retries work and the fallback remains live for deep-link/stale cases.
  const isExitingRef = useRef(false);
  const upsertHabitLogMutation = useUpsertHabitLogMutation();
  const retroLogSubmitLockRef = useRef(false);
  const [selectorState, setSelectorState] = useState<{
    visible: boolean;
    date: string;
    currentStatus: HabitLogStatus | null;
    canEdit: boolean;
    readOnlyReason?: "window" | "app";
  } | null>(null);
  const todayAnchor = useTodayAnchorDate();
  const todayDate = useTodayDateString();
  const currentWeekStart = getWeekStartDateString(todayAnchor);
  // Fetch logs covering the full range from start_date (or 35 days minimum)
  const calendarDays = (() => {
    if (!habit?.start_date) return 35;
    const start = new Date(`${habit.start_date}T12:00:00`);
    const diff = Math.ceil((todayAnchor.getTime() - start.getTime()) / (1000 * 60 * 60 * 24)) + 1;
    return Math.max(diff, 35);
  })();
  const calendarLogs = useHabitLogsForRange(habit?.id, calendarDays).data ?? [];
  const { accessMode, isValidating, refresh } = useTrialValidation();
  const isReadOnly = computeIsReadOnly(accessMode);

  // Archive intro onboarding: tri-state (null = not yet loaded). The flag is
  // only written by the banner's dismiss on BacklogScreen — never here — so
  // archiving repeatedly before dismiss keeps re-triggering the onboarding.
  // On read failure we behave as if seen (conservative: don't bounce the user
  // to Backlog if storage is broken).
  const [archiveIntroSeen, setArchiveIntroSeen] = useState<boolean | null>(
    null,
  );
  useEffect(() => {
    isArchiveIntroSeen()
      .then(setArchiveIntroSeen)
      .catch(() => setArchiveIntroSeen(true));
  }, []);

  // Archived habits live on their own screen. If a user lands here for an
  // archived habit (deep link, stale route, or in-flight refetch after
  // archive), redirect to ArchivedHabitDetailScreen. Gated on isExitingRef
  // so the handler's imperative router.replace path stays authoritative
  // during the brief in-flight window of the archive mutation.
  useEffect(() => {
    if (isExitingRef.current) return;
    if (isLoading || error) return;
    if (habit && habit.status === "archived") {
      router.replace({
        pathname: "/(app)/habits/archived/[habitId]",
        params: { habitId: habit.id },
      });
    }
  }, [habit?.id, habit?.status, isLoading, error]);

  // Weekly review state
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
  // Orphan habits (no identity_phrase) fall back to the legacy per-habit
  // route. Per docs/tech-handoff-core-v1.md, identity_phrase is nullable
  // in the schema and via habits/api.ts; orphans can still exist until
  // every habit is explicitly migrated to a goal.
  function openReview(habitForReview: HabitRecord, _source: string) {
    if (habitForReview.identity_phrase) {
      void openGoalWeeklyReview({
        identityPhrase: habitForReview.identity_phrase,
        returnTo: "habitDetail",
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
      : todayAnchor;
    const today = new Date(todayAnchor);
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

  // Journey Card data — reuses the goal-level helpers with a one-element
  // habit array, which degenerates to single-habit aggregation.
  //
  // todayAnchor is reference-stable until local-day rollover (see
  // useTodayAnchorDate), so including it in deps does not churn memoization
  // on normal re-renders but correctly invalidates the chart at rollover.
  const weeklyData = useMemo(() => {
    if (!habit) return [];
    // Snap to the Monday of the habit's start week. `computeWeeklyConsistency`
    // requires the top-level startDate to be a week-start, otherwise the
    // first-iteration loop guard fails for habits started mid-week.
    const chartStartIso = getWeekStartDateString(
      new Date(`${habit.start_date}T12:00:00`),
    );
    return computeWeeklyConsistency(
      [
        {
          activeDays,
          logs: (calendarLogs as HeatmapLog[]).map((l) => ({
            log_date: l.log_date,
            status: l.status as "done" | "skipped" | "missed",
          })),
          startDate: habit.start_date,
        },
      ],
      chartStartIso,
      todayAnchor,
    );
  }, [habit, calendarLogs, activeDays, todayAnchor]);

  const habitDailyStates = useMemo(() => {
    if (!habit) return [];
    return computeGoalDailyStates(
      [
        {
          activeDays,
          logs: (calendarLogs as HeatmapLog[]).map((l) => ({
            log_date: l.log_date,
            status: l.status as "done" | "skipped" | "missed",
          })),
          startDate: habit.start_date,
        },
      ],
      28,
    );
  }, [habit, calendarLogs, activeDays]);

  const narrativeText = getGoalNarrative(progress.consistencyRate, activeDaysCount);

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

  function handleCellPress(date: string) {
    if (!habit) return;
    if (date < habit.start_date) return;
    // Telemetry: fired before the start-date / window guards above so
    // that "tapped a cell" measures actual user intent, regardless of
    // whether the tap leads to an editable retro-log dialog. days_back
    // is derived from (today - date); helper signature is
    // (from, to) → to - from in days, so the past `date` comes first.
    trackEvent("heatmap_day_tapped", {
      habit_id: habit.id,
      days_back: daysBetweenDates(date, todayDate),
    });
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
    // Belt-and-suspenders: the Archive button is already disabled while
    // archiveIntroSeen === null (see HabitDetailActions). Guarding here too
    // ensures a first-time archive never slips through without the Backlog
    // redirect that drives the onboarding banner.
    if (archiveIntroSeen === null) return;
    activeStateSubmitLockRef.current = true;
    // Suppress the archived-status redirect effect; this handler owns the
    // post-archive navigation imperatively.
    isExitingRef.current = true;
    try {
      // api.ts archiveHabit cancels the OS reminder for status='active' rows
      // — every archive entry point gets reminder teardown, not just this
      // screen. No extra cancelReminder call needed here.
      await archiveHabitMutation.mutateAsync({ habitId: habit.id });
      // First-time archive: route to Backlog so the user discovers where
      // archived habits live (and that delete now lives there). The intro
      // flag is written by the banner's dismiss on Backlog, NOT here.
      // Subsequent archives skip the onboarding and land on the archived
      // habit detail screen with the Restore affordance.
      if (archiveIntroSeen === false) {
        router.replace("/(app)/habits/backlog");
      } else {
        router.replace({
          pathname: "/(app)/habits/archived/[habitId]",
          params: { habitId: habit.id },
        });
      }
    } catch {
      // Mutation failed — re-arm the redirect fallback so the user can retry
      // or back out without being stuck on a stale archived view.
      isExitingRef.current = false;
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
        contentContainerStyle={[styles.content, { paddingTop: top + theme.spacing.lg }]}
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
            <ChevronLeft color={theme.colors.textMuted} size={22} strokeWidth={1.75} />
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
      contentContainerStyle={[styles.content, { paddingTop: top + theme.spacing.lg }]}
      style={styles.screen}
    >
      <AccessGateBanner
        accessMode={accessMode}
        isReconnecting={isValidating}
        onReconnect={() => void refresh()}
      />

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
          <ChevronLeft color={theme.colors.textMuted} size={22} strokeWidth={1.75} />
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
            <LucideIcon name={habit.icon} size={22} color={theme.colors.primary} strokeWidth={1.75} />
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
            <Pencil color={isReadOnly ? theme.colors.textFaint : theme.colors.primary} size={16} strokeWidth={1.75} />
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
            <Bell color={theme.colors.textFaint} size={12} strokeWidth={1.75} />
            <Text style={styles.reminderSummaryText}>
              {reminderType === "backup" ? "Backup reminder" : "Daily reminder"}{" · "}{formatDisplayTime(reminderTime)}
            </Text>
          </View>
        ) : null}
      </View>

      {/* Journey Card — mirrors GoalDetailScreen's pattern at the habit level */}
      {!isUpcoming ? (
        <ZenCard style={styles.journeyCard}>
          <View style={styles.journeyTop}>
            <ConsistencyDonut rate={progress.consistencyRate} size={56} label="" />
            <Text style={styles.narrativeText}>{narrativeText}</Text>
          </View>

          {weeklyData.length >= 1 ? (
            <WeeklyConsistencyChart scope="habit" weeklyData={weeklyData} />
          ) : null}

          <GoalStreakStrip
            dailyStates={habitDailyStates}
            scope="habit"
            streak={progress.streak}
            startDate={habit.start_date}
            onCellPress={handleCellPress}
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
              <Pressable onPress={() => openReview(habit, "View this week's review")}>
                <Text style={styles.reviewAgainLink}>View this week's review</Text>
              </Pressable>
            </>
          )}
        </ZenCard>
      ) : null}



      <HabitDetailActions
        habit={habit}
        isReadOnly={isReadOnly}
        archivePending={archiveHabitMutation.isPending}
        archiveIntroLoading={archiveIntroSeen === null}
        archiveError={Boolean(archiveHabitMutation.error)}
        onArchivePress={() => void handleArchivePress()}
        onBackPress={() => router.push("/(app)/habits/backlog")}
      />

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
