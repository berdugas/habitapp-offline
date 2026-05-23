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
import { ChevronLeft } from "lucide-react-native";
import { useQuery } from "@tanstack/react-query";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { PrimaryButton } from "@/components/buttons/PrimaryButton";
import { ErrorState } from "@/components/feedback/ErrorState";
import { LoadingState } from "@/components/feedback/LoadingState";
import { useAuthSession } from "@/features/auth/hooks";
import { GoalReflectionStep } from "@/features/reviews/components/GoalReflectionStep";
import { ReviewStepIndicator } from "@/features/reviews/components/ReviewStepIndicator";
import { TuneUpStep } from "@/features/reviews/components/TuneUpStep";
import { WeekCompleteStep } from "@/features/reviews/components/WeekCompleteStep";
import { WeekOverviewStep } from "@/features/reviews/components/WeekOverviewStep";
import { WhatsWorkingStep } from "@/features/reviews/components/WhatsWorkingStep";
import { getLatestWeeklyReviewsForHabits } from "@/features/reviews/api";
import {
  useApplyTuneUpMutation,
  useUpsertGoalReviewsMutation,
} from "@/features/reviews/hooks";
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
import { SCREEN_TOP_PADDING, spacing } from "@/theme/spacing";
import { typography } from "@/theme/typography";
import { getWeekStartDateString } from "@/utils/dates";

import type { ApplyTuneUpForHabitPayload } from "@/features/reviews/api";
import type { GoalWeekSummary } from "@/features/reviews/buildGoalWeekSummary";
import type { UpsertWeeklyReviewPayload } from "@/features/reviews/types";

type Step =
  | { type: "week_overview" }
  | { type: "whats_working" }
  | { type: "tune_up"; habitId: string }
  | { type: "goal_reflection" }
  | { type: "complete" };

function getStepSequence(summary: GoalWeekSummary): Step[] {
  const steps: Step[] = [{ type: "week_overview" }];
  if (summary.strongHabits.length > 0) {
    steps.push({ type: "whats_working" });
  }
  if (summary.attentionHabits.length === 0) {
    // Clean week (or zero-active-day brand-new week) — no per-habit
    // Tune-Ups to render. Insert a single optional reflection beat so
    // the user can still set an intention before landing on Complete.
    // The Complete catch-up effect handles empty-row backfill if the
    // user skips this step.
    steps.push({ type: "goal_reflection" });
  } else {
    for (const h of summary.attentionHabits) {
      steps.push({ type: "tune_up", habitId: h.habitId });
    }
  }
  steps.push({ type: "complete" });
  return steps;
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

  const { user } = useAuthSession();
  const weekStart = getWeekStartDateString();
  const summaryQuery = useGoalWeekSummary(identityPhrase, weekStart);
  const applyTuneUpMutation = useApplyTuneUpMutation();
  const upsertGoalReviewsMutation = useUpsertGoalReviewsMutation();

  // Load any persisted review rows for THIS week so the TuneUpStep can
  // pre-fill from saved state when the user re-opens the review across
  // sessions. The in-session `savedReviewsByHabitId` map only tracks
  // Apply/Skip writes from the current screen instance — without this
  // query, a user who completes a review, closes the screen, and re-opens
  // it would see empty Y/N + adjustment_note fields even though the
  // database has the saved answers.
  const summaryHabitIds = useMemo(
    () => summaryQuery.data?.habits.map((h) => h.habitId) ?? [],
    [summaryQuery.data],
  );
  const persistedReviewsQuery = useQuery({
    enabled: Boolean(user?.id) && summaryHabitIds.length > 0,
    queryFn: () => getLatestWeeklyReviewsForHabits(user!.id, summaryHabitIds),
    queryKey: [
      "goal-review-screen",
      "persisted-reviews",
      user?.id,
      identityPhrase,
      weekStart,
      summaryHabitIds,
    ],
  });

  const [currentStepIndex, setCurrentStepIndex] = useState(0);
  // Tracks habit ids that already have a current-week review row written
  // in this session. We use this on Complete-step entry to batch-write
  // empty rows for any reviewable habit that wasn't covered by the
  // per-Tune-Up loop. Without this, getGoalReviewStatus.isDue stays
  // true after a clean week or a mixed week (where strong habits skip
  // the loop) — the CTA wouldn't clear.
  const [coveredHabitIds, setCoveredHabitIds] = useState<Set<string>>(
    new Set(),
  );
  // Saved review rows from this session's Apply / Skip writes, keyed by
  // habit id. Used to pre-fill the TuneUpStep when the user navigates
  // BACK to a previously-Apply'd tune-up via the header chevron — the
  // step remounts (its key changes), so we need an authoritative source
  // for the saved Y/N + adjustment_note to seed `useState` with.
  const [savedReviewsByHabitId, setSavedReviewsByHabitId] = useState<
    Map<string, { triggerWorked: boolean | null; tinyActionTooHard: boolean | null; adjustmentNote: string }>
  >(new Map());
  // Catch-up persistence is async — Complete must surface its pending /
  // error state so the user doesn't tap Done and walk away while the
  // catch-up batch is still in flight or rolled back. due.ts keeps the
  // goal "due" until every reviewable habit has a current-week row.
  type CatchUpState = "idle" | "pending" | "error" | "done";
  const [catchUpState, setCatchUpState] = useState<CatchUpState>("idle");
  const hasFlushedCatchUpRef = useRef(false);
  // Per-step "dirty" signal — flips to true on the first user
  // interaction inside the active step (Tune-Up Y/N or text edit;
  // Goal Reflection text edit). The beforeRemove guard reads this
  // to decide whether to prompt before exit. Resets on every step
  // transition. Earlier-step types (week_overview, whats_working,
  // complete) carry no editable input, so we never flip it for them.
  const [currentStepInteracted, setCurrentStepInteracted] = useState(false);
  // Tracks whether the active step is mid-Apply or mid-Skip. beforeRemove
  // waits this out before deciding what to prompt.
  const [isWriting, setIsWriting] = useState(false);
  // Tracks how many Tune-Ups have committed in this session (Apply OR Skip
  // count). Surfaces in Step 5's "you tuned N habits" copy.
  const [appliedCount, setAppliedCount] = useState(0);
  const [skippedCount, setSkippedCount] = useState(0);
  const [hasMutation, setHasMutation] = useState(false);

  // First-run banner gating. The screen renders a loading state until the
  // flag has been read so a fast user can't tap past banners. The Apply
  // path re-reads storage authoritatively (per memory failure mode #6)
  // before writing the flag — the in-memory mirror below is the render
  // gate, not the write guard.
  const [firstRunCompletedLoaded, setFirstRunCompletedLoaded] = useState(false);
  const [isFirstRunIncomplete, setIsFirstRunIncomplete] = useState(false);
  const [tuneUpTipDismissed, setTuneUpTipDismissed] = useState(false);
  // Synchronous lock: first row-writing event of the session triggers
  // the flag-write attempt exactly once. The ref doesn't reset between
  // tune-ups — only the storage re-read determines whether the write
  // actually fires.
  const hasAttemptedFirstRunWriteRef = useRef(false);

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
        // Failure case: assume incomplete defensively so the Apply-path
        // gate doesn't short-circuit on `!isFirstRunIncomplete`. The
        // authoritative re-read at the moment of the first row-writing
        // event is what actually decides whether to write the flag —
        // this flag's role here is "should I attempt the re-read at
        // all." False would mean "definitely repeat user, skip"; true
        // means "maybe first-run, ask storage at the next opportunity."
        // Defensive `true` ensures storage gets one more chance.
        setIsFirstRunIncomplete(true);
        setFirstRunCompletedLoaded(true);
      });
  }, []);

  const summary = summaryQuery.data ?? null;
  const stepSequence = useMemo<Step[]>(
    () =>
      summary ? getStepSequence(summary) : [{ type: "week_overview" }],
    [summary],
  );
  const currentStep = stepSequence[currentStepIndex] ?? { type: "week_overview" };

  const scrollViewRef = useRef<ScrollView>(null);

  /**
   * Resolves the `initialReview` prop for a TuneUpStep. Session edits
   * win over DB rows so a user who Apply'd in this session and stepped
   * back sees their just-edited state (not whatever was on disk before
   * Apply). For across-session re-entry, the DB row is the only source.
   * Returns undefined when nothing is saved → TuneUpStep starts empty.
   */
  function getInitialReview(habitId: string) {
    const sessionData = savedReviewsByHabitId.get(habitId);
    if (sessionData) return sessionData;
    const dbRow = persistedReviewsQuery.data?.get(habitId);
    if (dbRow && dbRow.week_start === weekStart) {
      return {
        triggerWorked: dbRow.trigger_worked,
        tinyActionTooHard: dbRow.tiny_action_too_hard,
        adjustmentNote: dbRow.adjustment_note ?? "",
      };
    }
    return undefined;
  }

  // beforeRemove guard. Three distinct dirty states:
  //   1. Tune-up step with unsaved edits ⇒ alert with the per-habit copy.
  //   2. Goal-reflection step with typed (but unsaved) text ⇒ alert with
  //      the reflection copy.
  //   3. Complete step where the catch-up batch hasn't finished ⇒ silent
  //      wait while pending, alert while errored. Without this, the user
  //      could tap X after Apply'ing the last tune-up but before the
  //      catch-up batch resolves and walk away with the goal-review
  //      partially persisted — getGoalReviewStatus would keep the CTA
  //      "due" because non-attention habits never got their rows.
  // Saved progress from previous tune-ups is durable so we don't warn
  // about it on tune-up exit.
  useEffect(() => {
    const unsub = navigation.addListener("beforeRemove", (e) => {
      const onTuneUp = currentStep.type === "tune_up";
      const onReflection = currentStep.type === "goal_reflection";
      const onComplete = currentStep.type === "complete";

      const tuneUpDirty = onTuneUp && currentStepInteracted;
      const reflectionDirty = onReflection && currentStepInteracted;
      const stepWriting = (onTuneUp || onReflection) && isWriting;
      const completeWriting = onComplete && catchUpState === "pending";
      const completeFailed = onComplete && catchUpState === "error";

      const shouldBlock =
        tuneUpDirty ||
        reflectionDirty ||
        stepWriting ||
        completeWriting ||
        completeFailed;
      if (!shouldBlock) {
        return; // Clean exit (no dirty state, no in-flight write).
      }

      e.preventDefault();

      if (stepWriting || completeWriting) {
        // Wait until the in-flight write settles. Don't show an alert
        // for a transient saving state — the next beforeRemove fire
        // (when state transitions to done / error) routes through the
        // right branch.
        return;
      }

      if (completeFailed) {
        Alert.alert(
          "Leave without finishing the save?",
          "Your review couldn't finish saving. Tap Retry to try again, or leave — your habits may still show as needing review until you finish.",
          [
            { style: "cancel", text: "Keep going" },
            {
              onPress: () => navigation.dispatch(e.data.action),
              style: "destructive",
              text: "Leave",
            },
          ],
        );
        return;
      }

      if (reflectionDirty) {
        Alert.alert(
          "Leave this reflection?",
          "Your reflection won't be saved. Tap Save & continue to keep it.",
          [
            { style: "cancel", text: "Keep going" },
            {
              onPress: () => navigation.dispatch(e.data.action),
              style: "destructive",
              text: "Leave",
            },
          ],
        );
        return;
      }

      // tuneUpDirty fallthrough.
      Alert.alert(
        "Leave this tune-up?",
        "Your changes to this habit won't be saved. The tune-ups you've already applied are saved.",
        [
          { style: "cancel", text: "Keep going" },
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
    catchUpState,
    currentStep.type,
    currentStepInteracted,
    isWriting,
    navigation,
  ]);

  function advanceToNextStep() {
    setCurrentStepInteracted(false);
    setCurrentStepIndex((i) => Math.min(i + 1, stepSequence.length - 1));
  }

  async function maybeMarkFirstRunCompleted(): Promise<void> {
    if (hasAttemptedFirstRunWriteRef.current) return;
    if (!isFirstRunIncomplete) return;
    hasAttemptedFirstRunWriteRef.current = true;
    try {
      // Re-read storage authoritatively — the in-memory mirror may not
      // reflect a parallel write from another surface. Per memory
      // failure mode #6 the write guard must read the source of truth.
      const completed = await isWeeklyReviewFirstRunCompleted();
      if (completed) return;
      const persisted = await markWeeklyReviewFirstRunCompleted();
      if (persisted) {
        trackEvent("weekly_review_first_run_completed");
        setIsFirstRunIncomplete(false);
      }
    } catch (err) {
      logger.warn("GoalReviewScreen: first-run write failed", { err });
    }
  }

  async function handleTuneUpApply(
    payload: ApplyTuneUpForHabitPayload,
  ): Promise<void> {
    setIsWriting(true);
    try {
      await applyTuneUpMutation.mutateAsync(payload);
      setAppliedCount((n) => n + 1);
      setCoveredHabitIds((prev) => {
        const next = new Set(prev);
        next.add(payload.habitId);
        return next;
      });
      setSavedReviewsByHabitId((prev) => {
        const next = new Map(prev);
        next.set(payload.habitId, {
          triggerWorked: payload.triggerWorked,
          tinyActionTooHard: payload.tinyActionTooHard,
          adjustmentNote: payload.adjustmentNote,
        });
        return next;
      });
      if (payload.habitPatch) setHasMutation(true);
      trackEvent("weekly_review_tune_up_applied", {
        habitId: payload.habitId,
        hasHabitPatch: Boolean(payload.habitPatch),
      });
      await maybeMarkFirstRunCompleted();
      advanceToNextStep();
    } catch (err) {
      // Surface error inside TuneUpStep via its retry banner. The
      // mutation already cleared cache hydration on failure (no-op
      // there); the parent doesn't advance.
      logger.warn("GoalReviewScreen: Apply failed", { err });
      throw err;
    } finally {
      setIsWriting(false);
    }
  }

  async function handleTuneUpSkip(
    payload: ApplyTuneUpForHabitPayload,
  ): Promise<void> {
    setIsWriting(true);
    try {
      await applyTuneUpMutation.mutateAsync(payload);
      setSkippedCount((n) => n + 1);
      setCoveredHabitIds((prev) => {
        const next = new Set(prev);
        next.add(payload.habitId);
        return next;
      });
      setSavedReviewsByHabitId((prev) => {
        const next = new Map(prev);
        next.set(payload.habitId, {
          triggerWorked: payload.triggerWorked,
          tinyActionTooHard: payload.tinyActionTooHard,
          adjustmentNote: payload.adjustmentNote,
        });
        return next;
      });
      trackEvent("weekly_review_tune_up_skipped", {
        habitId: payload.habitId,
      });
      await maybeMarkFirstRunCompleted();
      advanceToNextStep();
    } catch (err) {
      logger.warn("GoalReviewScreen: Skip failed", { err });
      throw err;
    } finally {
      setIsWriting(false);
    }
  }

  /**
   * Goal Reflection Save handler — only reachable on clean-week
   * flows. Writes the user's reflection (trimmed; empty → null) to a
   * `weekly_reviews` row for every habit in the goal in one batch,
   * mirroring the legacy "all-strong week" persistence behaviour
   * (see commit 7c8dc39 for the prior single-row-per-habit treatment).
   *
   * On success: marks every habit as covered so the Complete-entry
   * catch-up effect doesn't re-write empty rows on top of the
   * reflection we just persisted; advances to Complete. On failure:
   * the parent re-throws so the step component can surface a retry
   * banner. The user stays on the reflection step until they
   * succeed or skip.
   */
  async function handleReflectionSave(text: string): Promise<void> {
    if (!summary) return;
    setIsWriting(true);
    try {
      const trimmed = text.trim();
      const payloads: UpsertWeeklyReviewPayload[] = summary.habits.map((h) => ({
        // Repo layer at weekly_reviews.ts trims and converts "" → null,
        // so we send the trimmed value directly and let the repo do
        // its own normalisation.
        adjustmentNote: trimmed,
        habitId: h.habitId,
        tinyActionTooHard: null,
        triggerWorked: null,
        weekStart,
      }));
      await upsertGoalReviewsMutation.mutateAsync(payloads);
      setCoveredHabitIds((prev) => {
        const next = new Set(prev);
        for (const h of summary.habits) next.add(h.habitId);
        return next;
      });
      await maybeMarkFirstRunCompleted();
      advanceToNextStep();
    } catch (err) {
      logger.warn("GoalReviewScreen: Reflection save failed", { err });
      throw err;
    } finally {
      setIsWriting(false);
    }
  }

  /**
   * Goal Reflection Skip handler — no write, just advance. The
   * Complete-entry catch-up effect fills empty rows for every habit
   * so getGoalReviewStatus.isDue clears on exit.
   */
  function handleReflectionSkip() {
    advanceToNextStep();
  }

  // Catch-up batch write at Complete-step entry. Per due.ts:38, every
  // reviewable habit needs a current-week review row for the CTA to
  // clear. Per-Tune-Up writes only cover attentionHabits, so strong /
  // mid-band habits in mixed weeks AND every habit on clean weeks would
  // leave the CTA stuck in "due" without this. The batch uses
  // upsertGoalReviewsBatch (idempotent via ON CONFLICT DO UPDATE) so a
  // re-render won't double-write. Guarded by a ref so the effect only
  // fires once per session even if React re-runs the effect.
  async function runCatchUpWrite(payloads: UpsertWeeklyReviewPayload[]) {
    setCatchUpState("pending");
    try {
      await upsertGoalReviewsMutation.mutateAsync(payloads);
      await maybeMarkFirstRunCompleted();
      setCatchUpState("done");
    } catch (err) {
      logger.warn("GoalReviewScreen: Complete-entry catch-up write failed", {
        err,
        uncoveredCount: payloads.length,
      });
      setCatchUpState("error");
    }
  }

  /** Returns habits in the summary that don't yet have a current-week
   * review row — either via this session's Apply/Skip writes OR a
   * previously-persisted row from an earlier session. Skipping the
   * DB-persisted habits is critical: without it, the catch-up would
   * upsert empty (null Y/N, "" adjustment_note) values and OVERWRITE
   * saved answers from a previous session. */
  function getUncoveredHabits() {
    if (!summary) return [];
    return summary.habits.filter((h) => {
      if (coveredHabitIds.has(h.habitId)) return false;
      const dbRow = persistedReviewsQuery.data?.get(h.habitId);
      if (dbRow && dbRow.week_start === weekStart) return false;
      return true;
    });
  }

  function handleCatchUpRetry() {
    const uncovered = getUncoveredHabits();
    if (uncovered.length === 0) {
      setCatchUpState("done");
      return;
    }
    const payloads = uncovered.map((h) => ({
      adjustmentNote: "",
      habitId: h.habitId,
      tinyActionTooHard: null,
      triggerWorked: null,
      weekStart,
    }));
    void runCatchUpWrite(payloads);
  }

  useEffect(() => {
    if (currentStep.type !== "complete") return;
    if (hasFlushedCatchUpRef.current) return;
    if (!summary) return;
    const uncovered = getUncoveredHabits();
    if (uncovered.length === 0) {
      hasFlushedCatchUpRef.current = true;
      setCatchUpState("done");
      return;
    }
    hasFlushedCatchUpRef.current = true;
    const payloads = uncovered.map((h) => ({
      adjustmentNote: "",
      habitId: h.habitId,
      tinyActionTooHard: null,
      triggerWorked: null,
      weekStart,
    }));
    void runCatchUpWrite(payloads);
    // Intentionally tracking only step transitions — summary identity
    // shouldn't change mid-session, and coveredHabitIds is read at the
    // moment the effect fires (closure captures latest value via React's
    // dependency tracking).
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [currentStep.type]);

  function handleContinuePress() {
    advanceToNextStep();
  }

  function stepBack() {
    setCurrentStepInteracted(false);
    // Reset catch-up state when stepping out of Complete, so re-entering
    // Complete later re-runs the effect. The ref guard prevents
    // double-fire on the same render cycle but is also reset here so a
    // subsequent forward navigation can re-trigger the write if needed.
    if (currentStep.type === "complete") {
      hasFlushedCatchUpRef.current = false;
      setCatchUpState("idle");
    }
    setCurrentStepIndex((i) => Math.max(0, i - 1));
  }

  function handleBack() {
    // From the first step, "back" means "exit the review entirely" —
    // delegate to beforeRemove for the unsaved-work / catch-up guards.
    // From any later step, step backward within the flow. Stepping back
    // remounts the prior TuneUpStep (different key); its useState
    // initializers read from `savedReviewsByHabitId` so the saved Y/N
    // and adjustment_note pre-fill. Apply uses the same atomic write
    // path as initial entry.
    if (currentStepIndex === 0) {
      router.back();
      return;
    }
    const onTuneUp = currentStep.type === "tune_up";
    const onReflection = currentStep.type === "goal_reflection";
    const dirty = (onTuneUp || onReflection) && currentStepInteracted;
    if (dirty) {
      // Don't silently discard in-progress edits — same prompt as the
      // beforeRemove exit guard. On Leave: step back (edits lost). On
      // Keep going: stay on the dirty step.
      const title = onReflection ? "Leave this reflection?" : "Leave this tune-up?";
      const message = onReflection
        ? "Your reflection won't be saved. Tap Save & continue to keep it."
        : "Your changes to this habit won't be saved. The tune-ups you've already applied are saved.";
      Alert.alert(
        title,
        message,
        [
          { style: "cancel", text: "Keep going" },
          {
            onPress: stepBack,
            style: "destructive",
            text: "Leave",
          },
        ],
      );
      return;
    }
    stepBack();
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

  if (
    summaryQuery.isLoading ||
    !firstRunCompletedLoaded ||
    // Wait for persisted-reviews to settle so TuneUpStep mounts with
    // the right `initialReview`. Without this gate, a user re-opening
    // their review across sessions would briefly see empty fields
    // before the query resolves and (if we re-key the component) lose
    // any edits they made in that window.
    (summaryHabitIds.length > 0 && persistedReviewsQuery.isLoading)
  ) {
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

  // Step 1 + 2 each get a Continue button in the fixed footer.
  // Tune-up + Goal Reflection steps own their own primary/secondary
  // button stacks inline. Complete has its own Done button.
  const showFooterContinue =
    currentStep.type === "week_overview" ||
    currentStep.type === "whats_working";

  // Build the tune-up step props if we're on a tune-up step.
  const tuneUpHabit =
    currentStep.type === "tune_up"
      ? summary.habits.find((h) => h.habitId === currentStep.habitId) ?? null
      : null;
  const tuneUpIndex =
    currentStep.type === "tune_up"
      ? summary.attentionHabits.findIndex(
          (h) => h.habitId === currentStep.habitId,
        )
      : -1;

  return (
    <View style={[styles.screen, { paddingTop: insets.top + SCREEN_TOP_PADDING }]}>
      <View style={styles.header}>
        <Pressable
          accessibilityLabel={
            currentStepIndex === 0 ? "Close review" : "Go back a step"
          }
          accessibilityRole="button"
          hitSlop={12}
          onPress={handleBack}
          style={styles.closeButton}
        >
          <ChevronLeft color={colors.textMuted} size={24} strokeWidth={1.75} />
        </Pressable>
        <ReviewStepIndicator
          currentIndex={currentStepIndex}
          total={stepSequence.length}
        />
        <View style={styles.closeButton} />
      </View>

      <ScrollView
        contentContainerStyle={styles.scrollContent}
        ref={scrollViewRef}
        style={styles.scroll}
      >
        {currentStep.type === "week_overview" ? (
          <WeekOverviewStep summary={summary} />
        ) : null}
        {currentStep.type === "whats_working" ? (
          <WhatsWorkingStep strongHabits={summary.strongHabits} />
        ) : null}
        {currentStep.type === "tune_up" && tuneUpHabit ? (
          <TuneUpStep
            habit={tuneUpHabit}
            initialReview={getInitialReview(currentStep.habitId)}
            // Key remounts the component between tune-ups so internal
            // state (Y/N answers, edited fields) doesn't leak across.
            key={currentStep.habitId}
            onApply={(payload) => {
              setCurrentStepInteracted(true);
              return handleTuneUpApply(payload);
            }}
            onDismissFirstRunTip={() => {
              setTuneUpTipDismissed(true);
              trackEvent("weekly_review_tip_dismissed", { step: "tune_up" });
            }}
            onInteraction={() => setCurrentStepInteracted(true)}
            onSkip={(payload) => {
              setCurrentStepInteracted(true);
              return handleTuneUpSkip(payload);
            }}
            scrollViewRef={scrollViewRef}
            showFirstRunTip={
              isFirstRunIncomplete && !tuneUpTipDismissed && tuneUpIndex === 0
            }
            stepNumber={tuneUpIndex + 1}
            totalSteps={summary.attentionHabits.length}
            weekStart={weekStart}
          />
        ) : null}
        {currentStep.type === "goal_reflection" ? (
          <GoalReflectionStep
            // DB-sourced identity phrase mirrors WeekCompleteStep — the
            // URL-encoded version has shown truncation bugs in production
            // (see WeekCompleteStep prop notes below). Fall back to the
            // URL value only if no habits are loaded, which can't happen
            // on this step (we route here off summary.attentionHabits === 0
            // which implies summary.habits.length > 0 — the empty-summary
            // branch returns earlier with a different screen).
            identityPhrase={
              summary.habits[0]?.identityPhrase ?? identityPhrase
            }
            onInteraction={() => setCurrentStepInteracted(true)}
            onSave={handleReflectionSave}
            onSkip={handleReflectionSkip}
          />
        ) : null}
        {currentStep.type === "complete" ? (
          <WeekCompleteStep
            catchUpState={catchUpState}
            // Suppress the percent for brand-new goals (no active
            // habit-days this week) — buildGoalWeekSummary returns
            // overallConsistency = 0 in that case, which would render
            // "0% consistent" without this guard.
            consistencyPercent={
              summary.overallActiveDayCount > 0
                ? Math.round(summary.overallConsistency * 100)
                : null
            }
            daysOnJourney={summary.oldestActiveDaysCount}
            hasMutation={hasMutation}
            // Read identity_phrase from the DB-sourced habit row, NOT
            // the URL-derived `identityPhrase`. Both should resolve to
            // the same string, but the URL round-trip
            // (encodeURIComponent → useLocalSearchParams →
            // decodeURIComponent) has shown a truncation bug in
            // production where "a reviewer" arrives as "a". The DB
            // value is the canonical source and bypasses URL encoding
            // entirely. Falls back to the URL value when no habits
            // are loaded (edge case — summary.habits.length > 0 is
            // guarded above before this render).
            identityPhrase={
              summary.habits[0]?.identityPhrase ?? identityPhrase
            }
            onDone={handleDone}
            onRetryCatchUp={handleCatchUpRetry}
            tunedCount={appliedCount}
            skippedCount={skippedCount}
          />
        ) : null}
      </ScrollView>

      {showFooterContinue ? (
        <View style={[styles.footer, { paddingBottom: insets.bottom || spacing.lg }]}>
          <PrimaryButton label="Continue" onPress={handleContinuePress} />
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
