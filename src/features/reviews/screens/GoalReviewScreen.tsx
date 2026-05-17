import { useEffect, useMemo, useRef, useState } from "react";
import {
  Alert,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { router, useLocalSearchParams, useNavigation } from "expo-router";
import { X } from "lucide-react-native";
import { useQueryClient } from "@tanstack/react-query";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { PrimaryButton } from "@/components/buttons/PrimaryButton";
import { ErrorState } from "@/components/feedback/ErrorState";
import { LoadingState } from "@/components/feedback/LoadingState";
import { useAuthSession } from "@/features/auth/hooks";
import {
  getHabitAdjustmentSuggestions,
  getKeepGoingSuggestion,
} from "@/features/recommendations/habitAdjustmentEngine";
import { AdjustmentStep } from "@/features/reviews/components/AdjustmentStep";
import { NeedsAttentionStep } from "@/features/reviews/components/NeedsAttentionStep";
import { ReviewStepIndicator } from "@/features/reviews/components/ReviewStepIndicator";
import { WeekCompleteStep } from "@/features/reviews/components/WeekCompleteStep";
import { WeekOverviewStep } from "@/features/reviews/components/WeekOverviewStep";
import { WhatsWorkingStep } from "@/features/reviews/components/WhatsWorkingStep";
import { useUpsertGoalReviewsMutation } from "@/features/reviews/hooks";
import {
  isWeeklyReviewFirstRunCompleted,
  markWeeklyReviewFirstRunCompleted,
} from "@/features/reviews/onboardingStorage";
import { normalizeReturnTo } from "@/features/reviews/reviewRoutes";
import { useGoalWeekSummary } from "@/features/reviews/useGoalWeekSummary";
import { trackEvent } from "@/services/analytics";
import { logger } from "@/services/logger";
import { colors } from "@/theme/colors";
import { fontFamilies } from "@/theme/fontFamilies";
import { spacing } from "@/theme/spacing";
import { typography } from "@/theme/typography";
import { getWeekStartDateString } from "@/utils/dates";

import type {
  GoalWeekSummary,
  HabitWeekSummary,
} from "@/features/reviews/buildGoalWeekSummary";
import type {
  HabitAdjustmentSuggestion,
  HabitAdjustmentSuggestionType,
} from "@/features/recommendations/types";

type ReviewStep =
  | "week_overview"
  | "whats_working"
  | "needs_attention"
  | "adjustment"
  | "complete";

type HabitDiagnosticData = {
  habitId: string;
  triggerWorked: boolean | null;
  tinyActionTooHard: boolean | null;
};

function getStepSequence(summary: GoalWeekSummary): ReviewStep[] {
  const steps: ReviewStep[] = ["week_overview"];
  if (summary.strongHabits.length > 0) steps.push("whats_working");
  if (summary.attentionHabits.length > 0) steps.push("needs_attention");
  steps.push("adjustment");
  steps.push("complete");
  return steps;
}

function buildDiagnosticAsReview(d: HabitDiagnosticData) {
  return {
    trigger_worked: d.triggerWorked,
    tiny_action_too_hard: d.tinyActionTooHard,
    was_hard: "",
  };
}

function selectPrimarySuggestion(
  attentionHabits: HabitWeekSummary[],
  diagnostics: Map<string, HabitDiagnosticData>,
): {
  suggestion: HabitAdjustmentSuggestion | null;
  targetHabit: HabitWeekSummary | null;
} {
  for (const h of attentionHabits) {
    const d = diagnostics.get(h.habitId);
    if (!d) continue;
    const suggestions = getHabitAdjustmentSuggestions({
      latestReview: buildDiagnosticAsReview(d),
      progress: {
        consistencyRate: h.weekConsistency,
        skipCount: h.skipCount,
        streak: 0,
      },
    });
    if (suggestions.length > 0) {
      return { suggestion: suggestions[0]!, targetHabit: h };
    }
  }
  return { suggestion: null, targetHabit: null };
}

function getAdjustmentNoteForHabit(
  habit: HabitWeekSummary,
  targetHabit: HabitWeekSummary | null,
  suggestion: HabitAdjustmentSuggestion | null,
  useCustom: boolean,
  customAdjustment: string,
): string {
  // When there is a target habit (an attention habit drove the suggestion),
  // the note only applies to that habit. Other habits in the goal get no note.
  if (targetHabit) {
    if (habit.habitId !== targetHabit.habitId) return "";
    if (useCustom) return customAdjustment.trim();
    if (suggestion) return `${suggestion.title}: ${suggestion.body}`;
    return "";
  }
  // No target habit means the all-strong path: the keep-going suggestion (or
  // a custom note the user typed) is a goal-level reflection. Persist it onto
  // every habit's review row so the input isn't silently dropped.
  if (useCustom) return customAdjustment.trim();
  if (suggestion) return `${suggestion.title}: ${suggestion.body}`;
  return "";
}

function suggestionTypeForKeepGoing(): HabitAdjustmentSuggestionType {
  return "keep_going";
}

export default function GoalReviewScreen() {
  const params = useLocalSearchParams<{
    identityPhrase?: string;
    returnTo?: string | string[];
  }>();
  const identityPhrase = params.identityPhrase
    ? decodeURIComponent(params.identityPhrase as string)
    : undefined;
  const returnTo = normalizeReturnTo(params.returnTo);
  const insets = useSafeAreaInsets();
  const navigation = useNavigation();
  const queryClient = useQueryClient();
  const { user } = useAuthSession();

  const weekStart = getWeekStartDateString();
  const summaryQuery = useGoalWeekSummary(identityPhrase, weekStart);
  const upsertGoalReviews = useUpsertGoalReviewsMutation();

  const [currentStep, setCurrentStep] = useState<ReviewStep>("week_overview");
  const [diagnostics, setDiagnostics] = useState<
    Map<string, HabitDiagnosticData>
  >(new Map());
  const [useCustom, setUseCustom] = useState(false);
  const [customAdjustment, setCustomAdjustment] = useState("");
  const [isSaving, setIsSaving] = useState(false);
  const [saveError, setSaveError] = useState(false);
  const saveLockRef = useRef(false);

  // First-run banner gating. The screen renders a loading state until the
  // flag has been read (success OR failure), so we never hit the "user
  // taps past week_overview before .then resolves" race that would skip
  // banners entirely. The save-path write does NOT trust the in-memory
  // mirror — it re-reads storage authoritatively at save time so a fast
  // user can't beat the mount-effect read and skip the persistence.
  const [firstRunCompletedLoaded, setFirstRunCompletedLoaded] = useState(false);
  const [isFirstRunIncomplete, setIsFirstRunIncomplete] = useState(false);
  const [needsAttentionTipDismissed, setNeedsAttentionTipDismissed] =
    useState(false);
  const [adjustmentTipDismissed, setAdjustmentTipDismissed] = useState(false);

  useEffect(() => {
    isWeeklyReviewFirstRunCompleted()
      .then((completed) => {
        setIsFirstRunIncomplete(!completed);
        setFirstRunCompletedLoaded(true);
      })
      .catch((err) => {
        logger.warn("GoalReviewScreen: first-run read failed on mount", {
          err,
        });
        // Failure case: still proceed past the loading gate with banners
        // hidden (safe default). The save-path re-read will retry the
        // read at the moment that matters for persistence.
        setFirstRunCompletedLoaded(true);
      });
  }, []);

  // Intercept Android hardware back and iOS swipe-back so the same
  // unsaved-work / in-flight-save guards apply that the X button enforces.
  // Without this, gesture / system back would bypass handleClose entirely.
  useEffect(() => {
    const unsub = navigation.addListener("beforeRemove", (e) => {
      const isDirty = diagnostics.size > 0 || customAdjustment.length > 0;
      // A retry clears saveError at the start of the batch write, but the
      // write hasn't settled yet — isSaving is the authoritative signal.
      // "Successfully saved" requires the write to have actually returned.
      const savedSuccessfully =
        currentStep === "complete" && !saveError && !isSaving;
      const hasUnsavedWork = isDirty || saveError;
      if (savedSuccessfully || (!hasUnsavedWork && !isSaving)) {
        return;
      }
      e.preventDefault();
      if (isSaving) return; // wait until the write settles
      Alert.alert(
        "Leave review?",
        "Your reflection so far will not be saved.",
        [
          { style: "cancel", text: "Keep reflecting" },
          {
            onPress: () => navigation.dispatch(e.data.action),
            style: "destructive",
            text: "Leave",
          },
        ],
      );
    });
    return unsub;
  }, [
    currentStep,
    customAdjustment,
    diagnostics,
    isSaving,
    navigation,
    saveError,
  ]);

  const summary = summaryQuery.data ?? null;
  const stepSequence = useMemo<ReviewStep[]>(
    () => (summary ? getStepSequence(summary) : ["week_overview"]),
    [summary],
  );
  const currentStepIndex = stepSequence.indexOf(currentStep);

  const { suggestion: primarySuggestion, targetHabit } = useMemo(() => {
    if (!summary) return { suggestion: null, targetHabit: null };
    if (summary.attentionHabits.length === 0) {
      return {
        suggestion: getKeepGoingSuggestion(),
        targetHabit: null,
      };
    }
    return selectPrimarySuggestion(summary.attentionHabits, diagnostics);
  }, [summary, diagnostics]);

  function updateDiagnostic(
    habitId: string,
    field: "triggerWorked" | "tinyActionTooHard",
    value: boolean | null,
  ) {
    setDiagnostics((prev) => {
      const next = new Map(prev);
      const existing = next.get(habitId) ?? {
        habitId,
        triggerWorked: null,
        tinyActionTooHard: null,
      };
      next.set(habitId, { ...existing, [field]: value });
      return next;
    });
  }

  function allDiagnosticsAnswered(): boolean {
    if (!summary) return false;
    return summary.attentionHabits.every((h) => {
      const d = diagnostics.get(h.habitId);
      return d && d.triggerWorked !== null && d.tinyActionTooHard !== null;
    });
  }

  function isContinueEnabled(): boolean {
    if (currentStep === "needs_attention") return allDiagnosticsAnswered();
    return true;
  }

  function advanceToNextStep() {
    const next = stepSequence[currentStepIndex + 1];
    if (next) setCurrentStep(next);
  }

  async function saveAllReviews() {
    if (!summary || !user?.id || saveLockRef.current) return;
    saveLockRef.current = true;
    setIsSaving(true);
    setSaveError(false);
    try {
      const payloads = summary.habits.map((habit) => {
        const diag = diagnostics.get(habit.habitId);
        return {
          adjustmentNote: getAdjustmentNoteForHabit(
            habit,
            targetHabit,
            primarySuggestion,
            useCustom,
            customAdjustment,
          ),
          habitId: habit.habitId,
          tinyActionTooHard: diag?.tinyActionTooHard ?? null,
          triggerWorked: diag?.triggerWorked ?? null,
          wasHard: "",
          weekStart,
          wentWell: "",
        };
      });
      await upsertGoalReviews.mutateAsync(payloads);

      await Promise.all([
        queryClient.invalidateQueries({
          queryKey: ["habits", "eligible", user.id],
        }),
        queryClient.invalidateQueries({
          queryKey: ["habits", "upcoming", user.id],
        }),
        queryClient.invalidateQueries({ queryKey: ["habit-logs"] }),
      ]);

      // First-run completion: re-read storage authoritatively (not the
      // in-memory mirror, which may not have resolved yet) so a fast user
      // can't beat the mount read and end up stuck in first-run state.
      // Only emit "completed" analytics and flip the local mirror when
      // the write actually persisted — otherwise the user is still in
      // first-run state and a future review should still mark/track.
      void (async () => {
        try {
          const completed = await isWeeklyReviewFirstRunCompleted();
          if (!completed) {
            const persisted = await markWeeklyReviewFirstRunCompleted();
            if (persisted) {
              trackEvent("weekly_review_first_run_completed");
              setIsFirstRunIncomplete(false);
            }
          }
        } catch (err) {
          logger.warn("GoalReviewScreen: first-run save-path read failed", {
            err,
          });
        }
      })();

      setCurrentStep("complete");
    } catch {
      // Per S18b-07, surface the error on Step 5 with a Retry button rather
      // than stranding the user on Step 4. The batch write is transactional,
      // so a failure leaves no partial state — retrying is always safe.
      setSaveError(true);
      setCurrentStep("complete");
    } finally {
      setIsSaving(false);
      saveLockRef.current = false;
    }
  }

  function handleContinuePress() {
    if (!isContinueEnabled()) return;
    if (currentStep === "adjustment") {
      void saveAllReviews();
      return;
    }
    advanceToNextStep();
  }

  function handleClose() {
    // beforeRemove is the single source of truth for exit policy: it handles
    // the unsaved-work confirmation, the in-flight-save guard, and the
    // successful-save instant-exit, identically for X / hardware back /
    // gesture / programmatic. Trigger the navigation here and let the
    // listener decide.
    router.back();
  }

  function handleDone() {
    if (returnTo === "today") {
      router.replace("/(app)/(tabs)/today");
    } else if (returnTo === "habitDetail") {
      router.back();
    } else {
      router.back();
    }
  }

  if (!identityPhrase) {
    return <ErrorState message="No goal selected for review." />;
  }

  // Gate the multi-step UI on BOTH the summary query AND the first-run flag
  // read. Without the second condition, a fast user could advance past
  // week_overview before .then resolves and never see the first-run banners
  // on needs_attention/adjustment — defeating the onboarding entirely.
  if (summaryQuery.isLoading || !firstRunCompletedLoaded) {
    return <LoadingState message="Loading your week..." />;
  }

  if (summaryQuery.error || !summary) {
    return <ErrorState message="We couldn't load your week. Try again." />;
  }

  if (summary.habits.length === 0) {
    return (
      <ScrollView
        contentContainerStyle={styles.content}
        style={styles.screen}
      >
        <Text style={styles.body}>
          No habits to review for {identityPhrase} yet.
        </Text>
        <PrimaryButton label="Go back" onPress={() => router.back()} />
      </ScrollView>
    );
  }

  const continueLabel =
    currentStep === "adjustment"
      ? isSaving
        ? "Saving..."
        : "Save & finish"
      : "Continue";
  const showContinue = currentStep !== "complete";

  return (
    <View style={[styles.screen, { paddingTop: insets.top }]}>
      <View style={styles.header}>
        <Pressable
          accessibilityLabel="Close review"
          accessibilityRole="button"
          hitSlop={12}
          onPress={handleClose}
          style={styles.closeButton}
        >
          <X color={colors.textMuted} size={22} strokeWidth={1.75} />
        </Pressable>
        <ReviewStepIndicator
          currentIndex={Math.max(0, currentStepIndex)}
          total={stepSequence.length}
        />
        <View style={styles.closeButton} />
      </View>

      <ScrollView
        contentContainerStyle={styles.scrollContent}
        style={styles.scroll}
      >
        {currentStep === "week_overview" ? (
          <WeekOverviewStep summary={summary} />
        ) : null}
        {currentStep === "whats_working" ? (
          <WhatsWorkingStep strongHabits={summary.strongHabits} />
        ) : null}
        {currentStep === "needs_attention" ? (
          <NeedsAttentionStep
            attentionHabits={summary.attentionHabits}
            diagnostics={diagnostics}
            onDismissFirstRunTip={() => {
              setNeedsAttentionTipDismissed(true);
              trackEvent("weekly_review_tip_dismissed", {
                step: "needs_attention",
              });
            }}
            onUpdateDiagnostic={updateDiagnostic}
            showFirstRunTip={
              isFirstRunIncomplete && !needsAttentionTipDismissed
            }
          />
        ) : null}
        {currentStep === "adjustment" ? (
          <AdjustmentStep
            customAdjustment={customAdjustment}
            onCustomAdjustmentChange={setCustomAdjustment}
            onDismissFirstRunTip={() => {
              setAdjustmentTipDismissed(true);
              trackEvent("weekly_review_tip_dismissed", {
                step: "adjustment",
              });
            }}
            onToggleCustom={() => setUseCustom((v) => !v)}
            showFirstRunTip={isFirstRunIncomplete && !adjustmentTipDismissed}
            suggestion={primarySuggestion}
            targetHabit={targetHabit}
            useCustom={useCustom}
          />
        ) : null}
        {currentStep === "complete" ? (
          <WeekCompleteStep
            daysOnJourney={summary.oldestActiveDaysCount}
            identityPhrase={identityPhrase}
            isSaving={isSaving}
            onDone={handleDone}
            onRetry={() => void saveAllReviews()}
            saveError={saveError}
            totalDaysShowedUp={summary.totalDaysShowedUp}
          />
        ) : null}
      </ScrollView>

      {showContinue ? (
        <View style={[styles.footer, { paddingBottom: insets.bottom || spacing.lg }]}>
          <PrimaryButton
            disabled={!isContinueEnabled() || isSaving}
            label={continueLabel}
            onPress={handleContinuePress}
          />
        </View>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  body: {
    color: colors.textMuted,
    fontFamily: fontFamilies.body,
    fontSize: typography.bodyLg,
    lineHeight: 24,
  },
  closeButton: {
    height: 36,
    width: 36,
    alignItems: "center",
    justifyContent: "center",
  },
  content: {
    gap: spacing.xl,
    padding: spacing.xl,
  },
  footer: {
    backgroundColor: colors.bg,
    paddingHorizontal: spacing.xl,
    paddingTop: spacing.md,
  },
  header: {
    alignItems: "center",
    flexDirection: "row",
    justifyContent: "space-between",
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.sm,
  },
  scroll: {
    flex: 1,
  },
  scrollContent: {
    gap: spacing.xl,
    padding: spacing.xl,
  },
  screen: {
    backgroundColor: colors.bg,
    flex: 1,
  },
});

// Silence unused-warning during incremental build; Step 4 helper used inline.
void suggestionTypeForKeepGoing;
