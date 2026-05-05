import { useEffect, useRef, useState } from "react";
import { Pressable, ScrollView, StyleSheet, Switch, Text, View } from "react-native";
import { ChevronLeft, Pencil } from "lucide-react-native";
import { router, useLocalSearchParams } from "expo-router";

import { CalendarGrid } from "@/components/CalendarGrid";
import type { HeatmapLog } from "@/components/CalendarGrid";
import { ReadOnlyBanner } from "@/components/ReadOnlyBanner";
import { PrimaryButton } from "@/components/buttons/PrimaryButton";
import { SecondaryButton } from "@/components/buttons/SecondaryButton";
import { ZenCard } from "@/components/cards/ZenCard";
import { RowLV } from "@/components/cards/RowLV";
import { ErrorState } from "@/components/feedback/ErrorState";
import { LoadingState } from "@/components/feedback/LoadingState";
import { Eyebrow } from "@/components/text/Eyebrow";
import { LucideIcon } from "@/components/LucideIconPicker";
import { isWithinRetroWindow } from "@/features/habits/api";
import { getActiveDaysLabel, isActiveDay, parseActiveDays } from "@/features/habits/activeDays";
import { getFrequencyLabel } from "@/features/habits/formatters";
import { ConsistencyDonut } from "@/features/today/components/ConsistencyDonut";
import { cancelReminder, hasBeenPrompted, markPrompted, requestPermission, scheduleReminder } from "@/features/reminders/notifications";
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

import type { HabitLogStatus } from "@/features/habits/types";
import type { ReminderType } from "@/lib/db/repositories/reminders";

export default function HabitDetailScreen() {
  const { habitId, goalConsistency } = useLocalSearchParams<{
    habitId?: string | string[];
    goalConsistency?: string;
  }>();
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
  const isReviewDue = habit
    ? isWeeklyReviewDue({ currentWeekStart, habit, latestReview, todayDate })
    : false;
  const isReviewedThisWeek = latestReview?.week_start === currentWeekStart;

  // Reminder state
  const [reminderEnabled, setReminderEnabled] = useState(false);
  const [reminderType, setReminderType] = useState<ReminderType>("backup");
  const [reminderTime, setReminderTime] = useState("09:00");
  const [reminderEditing, setReminderEditing] = useState(false);
  const [reminderPending, setReminderPending] = useState(false);

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

  async function handleReminderToggle(value: boolean) {
    if (!habit || !user?.id || reminderPending) return;
    setReminderPending(true);
    try {
      if (value) {
        const prompted = await hasBeenPrompted();
        if (!prompted) {
          await markPrompted();
          await requestPermission();
        }
        setReminderEnabled(true);
        setReminderEditing(true);
      } else {
        await cancelReminder(habit.id);
        setReminderEnabled(false);
        setReminderEditing(false);
      }
    } finally {
      setReminderPending(false);
    }
  }

  async function handleReminderSave() {
    if (!habit || !user?.id || reminderPending || reminderType === "none") return;
    setReminderPending(true);
    try {
      await scheduleReminder(habit.id, user.id, reminderType, reminderTime, activeDays);
      setReminderEditing(false);
    } finally {
      setReminderPending(false);
    }
  }

  const activeDays = habit ? parseActiveDays(habit.active_days) : [1,2,3,4,5,6,7];
  const schedulelabel = getActiveDaysLabel(activeDays);
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
        contentContainerStyle={styles.content}
        contentInsetAdjustmentBehavior="automatic"
        style={styles.screen}
      >
        <View style={styles.backRow}>
          <Pressable onPress={() => router.back()} style={styles.backButton}>
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
      <View style={styles.header}>
        <Pressable onPress={() => router.back()} style={styles.backButton}>
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
        </View>
        <Text selectable style={styles.formulaText}>{formula}</Text>
        <Text selectable style={styles.frequencyText}>{frequencyLabel}</Text>
      </View>

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

      {/* Metric cards */}
      {!isUpcoming ? (
        <>
          <View style={styles.metricsRow}>
            <ZenCard style={styles.metricCard}>
              <Eyebrow label="Habit consistency" />
              <View style={styles.metricCenter}>
                {activeDaysCount >= 7 ? (
                  <ConsistencyDonut rate={progress.consistencyRate} size={40} label="" />
                ) : (
                  <Text style={styles.tooEarlyText}>
                    Too early to tell — keep showing up
                  </Text>
                )}
              </View>
            </ZenCard>
            <ZenCard style={styles.metricCard}>
              <Eyebrow label="Habit streak" />
              <View style={styles.metricCenter}>
                <Text style={styles.streakLargeNumber}>{progress.streak}</Text>
                {progress.skipCount > 0 ? (
                  <Text style={styles.skipCountText}>{progress.skipCount} skips</Text>
                ) : null}
              </View>
            </ZenCard>
          </View>
          {habit.identity_phrase ? (
            <Text style={styles.goalBreadcrumb}>
              Become {habit.identity_phrase}{goalConsistencyPct != null ? ` · ${goalConsistencyPct}% overall` : ""}
            </Text>
          ) : null}
        </>
      ) : null}

      {/* Weekly Review card */}
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
                onPress={() =>
                  router.push({
                    pathname: "/(app)/reviews/[habitId]",
                    params: { habitId: habit.id, returnTo: "habitDetail" },
                  })
                }
              />
            </>
          ) : (
            <>
              <Text style={styles.reviewCompletedText}>Reviewed this week ✓</Text>
              <Pressable
                onPress={() =>
                  router.push({
                    pathname: "/(app)/reviews/[habitId]",
                    params: { habitId: habit.id, returnTo: "habitDetail" },
                  })
                }
              >
                <Text style={styles.reviewAgainLink}>Review again</Text>
              </Pressable>
            </>
          )}
        </ZenCard>
      ) : null}

      {/* Setup card */}
      <ZenCard>
        <View style={styles.setupHeader}>
          <Eyebrow label="Setup" />
          <Pressable
            disabled={isReadOnly}
            onPress={() =>
              router.push({
                pathname: "/(app)/habits/[habitId]/edit",
                params: { habitId: habit.id },
              })
            }
            style={styles.editButton}
          >
            <Pencil color={isReadOnly ? colors.textFaint : colors.primary} size={16} strokeWidth={1.75} />
          </Pressable>
        </View>
        {habit.identity_phrase ? (
          <RowLV label="Identity" value={habit.identity_phrase} />
        ) : null}
        <RowLV label="Formula" value={formula} />
        {habit.preferred_time_window ? (
          <RowLV label="Preferred time" value={habit.preferred_time_window} />
        ) : null}
        <RowLV label="Active days" value={schedulelabel} />
      </ZenCard>

      {/* Reminder card */}
      <ZenCard>
        <View style={styles.reminderHeader}>
          <Eyebrow label="Reminder" />
          <Switch
            disabled={isReadOnly || reminderPending}
            onValueChange={(v) => void handleReminderToggle(v)}
            value={reminderEnabled}
          />
        </View>
        {reminderEnabled ? (
          <>
            <RowLV
              label="Type"
              value={reminderType === "backup" ? "Backup (if not logged)" : "Daily"}
            />
            <RowLV label="Time" value={reminderTime} />
            {reminderEditing ? (
              <View style={styles.reminderEditor}>
                <View style={styles.reminderTypeRow}>
                  {(["backup", "daily"] as ReminderType[]).filter(t => t !== "none").map((t) => (
                    <Pressable
                      key={t}
                      onPress={() => setReminderType(t)}
                      style={[
                        styles.reminderTypeChip,
                        reminderType === t && styles.reminderTypeChipSelected,
                      ]}
                    >
                      <Text
                        style={[
                          styles.reminderTypeLabel,
                          reminderType === t && styles.reminderTypeLabelSelected,
                        ]}
                      >
                        {t === "backup" ? "Backup" : "Daily"}
                      </Text>
                    </Pressable>
                  ))}
                </View>
                <View style={styles.reminderTimeRow}>
                  {["07:00", "08:00", "09:00", "12:00", "17:00", "20:00", "21:00"].map((t) => (
                    <Pressable
                      key={t}
                      onPress={() => setReminderTime(t)}
                      style={[
                        styles.reminderTimeChip,
                        reminderTime === t && styles.reminderTimeChipSelected,
                      ]}
                    >
                      <Text
                        style={[
                          styles.reminderTimeLabel,
                          reminderTime === t && styles.reminderTimeLabelSelected,
                        ]}
                      >
                        {t}
                      </Text>
                    </Pressable>
                  ))}
                </View>
                <Pressable
                  disabled={reminderPending}
                  onPress={() => void handleReminderSave()}
                  style={styles.reminderSaveButton}
                >
                  <Text style={styles.reminderSaveLabel}>
                    {reminderPending ? "Saving..." : "Save reminder"}
                  </Text>
                </Pressable>
              </View>
            ) : (
              <Pressable
                onPress={() => setReminderEditing(true)}
                style={styles.editReminderButton}
              >
                <Text style={styles.editReminderLabel}>Edit reminder</Text>
              </Pressable>
            )}
          </>
        ) : (
          <Text style={styles.reminderPlaceholder}>
            Get a gentle nudge when it's time for this habit.
          </Text>
        )}
      </ZenCard>

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
    marginTop: spacing.sm,
    minHeight: 60,
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
  tooEarlyText: {
    color: colors.textMuted,
    fontFamily: fontFamilies.body,
    fontSize: typography.bodyMd,
    fontStyle: "italic",
    textAlign: "center",
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
    flexShrink: 1,
  },
  habitTitleRow: {
    alignItems: "center",
    flexDirection: "row",
    gap: spacing.sm,
    marginBottom: spacing.xs,
  },
  header: {
    gap: 4,
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
});
