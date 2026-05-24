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
import { CleanWeekAffirmationStep } from "@/features/reviews/components/CleanWeekAffirmationStep";
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
  | { type: "clean_week_affirmation" }
  | { type: "complete" };

function getStepSequence(summary: GoalWeekSummary): Step[] {
  const steps: Step[] = [{ type: "week_overview" }];
  if (summary.strongHabits.length > 0) {
    steps.push({ type: "whats_working" });
  }
  if (summary.attentionHabits.length === 0) {
    // Clean week (or zero-active-day brand-new week) — no per-habit
    // Tune-Ups to render. Insert a single affirmation screen so the
    // user lands on a calm "your week was on track" beat before
    // Complete, instead of jumping straight from What's Working to
    // Complete. The Complete catch-up effect writes empty rows for
    // every habit when the user advances through this step.
    steps.push({ type: "clean_week_affirmation" });
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
  // interaction inside the active step (Tune-Up Y/N or text edit).
  // The beforeRemove guard reads this to decide whether to prompt
  // before exit. Resets on every step transition. Earlier-step
  // types (week_overview, whats_working, clean_week_affirmation,
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

  // beforeRemove guard. Two distinct dirty states:
  //   1. Tune-up step with unsaved edits ⇒ alert with the per-habit copy.
  //   2. Complete step where the catch-up batch hasn't finished ⇒ silent
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
      const onComplete = currentStep.type === "complete";

      const tuneUpDirty = onTuneUp && currentStepInteracted;
      const stepWriting = onTuneUp && isWriting;
      const completeWriting = onComplete && catchUpState === "pending";
      const completeFailed = onComplete && catchUpState === "error";

      const shouldBlock =
        tuneUpDirty ||
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

  // Step-entry analytics. Fires once per step transition (effect deps
  // intentionally narrow — `currentStep.type` + `currentStep.habitId` for
  // tune-up — so re-renders within the same step don't re-fire). The
  // `tune_up_started` event captures the user reaching a per-habit
  // diagnostic; `weekly_review_completed` is the natural funnel anchor
  // at the end of the flow (counts the user's outcomes from the
  // session — applied / skipped / whether any habit was mutated). The
  // three uninstrumented steps (week_overview / whats_working /
  // clean_week_affirmation) get a generic `weekly_review_step_viewed`
  // event so the funnel covers every step type without double-firing
  // alongside the specialized tune_up_started / completed events.
  const tuneUpHabitIdForEffect =
    currentStep.type === "tune_up" ? currentStep.habitId : null;
  // Track whether the flow reached the natural Complete-step terminus
  // and the last step the user was on. Used by the unmount cleanup
  // below to decide whether to fire weekly_review_abandoned.
  const hasCompletedRef = useRef(false);
  const lastStepRef = useRef<typeof currentStep.type | null>(null);
  // "Real review on screen" guard — mirrors the early-return conditions
  // below (loading / missing identity / error / no habits). Without it,
  // the fallback step (`week_overview` while `summary` is null at line
  // 200) would seed lastStepRef and fire step_viewed before any visible
  // step renders, inflating both step_viewed counts and the abandoned
  // cohort on transient loading sessions. Cheap to compute; deliberately
  // recomputed each render so the refs flip the moment the summary
  // resolves into a reviewable goal.
  const isReviewReady =
    Boolean(identityPhrase) &&
    firstRunCompletedLoaded &&
    summary !== null &&
    summary.habits.length > 0;
  useEffect(() => {
    if (!isReviewReady) return;
    lastStepRef.current = currentStep.type;
  }, [currentStep.type, isReviewReady]);
  useEffect(() => {
    if (!isReviewReady) return;
    if (currentStep.type === "tune_up" && tuneUpHabitIdForEffect) {
      trackEvent("weekly_review_tune_up_started", {
        habit_id: tuneUpHabitIdForEffect,
      });
    } else if (currentStep.type === "complete" && summary) {
      hasCompletedRef.current = true;
      trackEvent("weekly_review_completed", {
        // `attentionCount` / `strongCount` let us segment outcomes by
        // week shape (clean vs mixed vs all-attention). Without these,
        // a low tunedCount looks identical whether the goal had zero
        // attention habits (clean week) or three (user skipped all).
        attentionCount: summary.attentionHabits.length,
        strongCount: summary.strongHabits.length,
        tunedCount: appliedCount,
        skippedCount,
        hasMutation,
      });
    } else if (
      currentStep.type === "week_overview" ||
      currentStep.type === "whats_working" ||
      currentStep.type === "clean_week_affirmation"
    ) {
      trackEvent("weekly_review_step_viewed", { step: currentStep.type });
    }
    // Effect intentionally fires once per step entry — re-renders that
    // change appliedCount mid-Complete are downstream of the user
    // already landing on Complete and would double-fire if included.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [currentStep.type, tuneUpHabitIdForEffect, isReviewReady]);

  // Unmount cleanup: if the user navigates away mid-flow without ever
  // reaching the Complete step, fire weekly_review_abandoned with the
  // last step they were on. Empty deps + cleanup-only fn means this
  // runs exactly once when the screen unmounts. We read from refs (not
  // state) so the cleanup closure sees the latest values, not the
  // snapshot at mount. lastStepRef stays null until isReviewReady, so
  // unmounting during loading / error / no-habits correctly skips the
  // event (the guard `lastStepRef.current === null` returns early).
  useEffect(() => {
    return () => {
      if (hasCompletedRef.current) return;
      if (lastStepRef.current === null) return;
      trackEvent("weekly_review_abandoned", { step: lastStepRef.current });
    };
  }, []);

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
      // Enriched event payload — needed downstream to understand:
      //   - Which suggestion paths produce mutations (`mutatedFields`).
      //   - Whether users accept the pre-filled cue/tinyAction or
      //     rewrite it (`textKept`). When all patched fields match the
      //     habit's current values, the user accepted the suggestion
      //     default verbatim — useful for tuning the suggestion copy.
      //     `null` when no habitPatch (the suggestion was free-text-only
      //     so the cue/tinyAction-vs-default comparison is meaningless).
      const mutatedFields: ("cue" | "tiny_action")[] = [];
      if (payload.habitPatch?.cue !== undefined) mutatedFields.push("cue");
      if (payload.habitPatch?.tinyAction !== undefined) {
        mutatedFields.push("tiny_action");
      }
      let textKept: boolean | null = null;
      if (payload.habitPatch) {
        const habit = summary?.habits.find((h) => h.habitId === payload.habitId);
        if (habit) {
          const cueKept =
            payload.habitPatch.cue === undefined ||
            payload.habitPatch.cue.trim() === habit.cue.trim();
          const tinyKept =
            payload.habitPatch.tinyAction === undefined ||
            payload.habitPatch.tinyAction.trim() === habit.tinyAction.trim();
          textKept = cueKept && tinyKept;
        }
      }
      trackEvent("weekly_review_tune_up_applied", {
        habit_id: payload.habitId,
        hasHabitPatch: Boolean(payload.habitPatch),
        mutated_fields: mutatedFields,
        textKept,
        // Y/N answers in coarse form — useful to bucket which
        // suggestion type the apply corresponds to without leaking
        // raw cue/tinyAction text into the analytics warehouse.
        triggerWorked: payload.triggerWorked,
        tinyActionTooHard: payload.tinyActionTooHard,
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
        habit_id: payload.habitId,
        // Y/N state at the moment of skip — distinguishes "skipped
        // without engaging" (both null) from "answered diagnostically
        // but chose not to commit a change" (both non-null).
        triggerWorked: payload.triggerWorked,
        tinyActionTooHard: payload.tinyActionTooHard,
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
    if (currentStep.type === "clean_week_affirmation") {
      trackEvent("weekly_review_clean_week_affirmation_continued");
    }
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
    const dirty = onTuneUp && currentStepInteracted;
    if (dirty) {
      // Don't silently discard in-progress edits — same prompt as the
      // beforeRemove exit guard. On Leave: step back (edits lost). On
      // Keep going: stay on the dirty step.
      Alert.alert(
        "Leave this tune-up?",
        "Your changes to this habit won't be saved. The tune-ups you've already applied are saved.",
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

  // Steps 1, 2, and the clean-week affirmation get a Continue button
  // in the fixed footer. Tune-up steps own their own primary/secondary
  // button stacks inline. Complete has its own Done button.
  const showFooterContinue =
    currentStep.type === "week_overview" ||
    currentStep.type === "whats_working" ||
    currentStep.type === "clean_week_affirmation";

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
        {currentStep.type === "clean_week_affirmation" ? (
          <CleanWeekAffirmationStep
            hasActiveDays={summary.overallActiveDayCount > 0}
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
