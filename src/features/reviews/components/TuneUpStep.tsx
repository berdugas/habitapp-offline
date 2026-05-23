import { useEffect, useMemo, useRef, useState } from "react";
import type { ScrollView, LayoutChangeEvent } from "react-native";
import {
  Animated,
  Easing,
  Pressable,
  StyleSheet,
  Text,
  View,
} from "react-native";

import { LucideIcon } from "@/components/LucideIconPicker";
import { PrimaryButton } from "@/components/buttons/PrimaryButton";
import { ZenCard } from "@/components/cards/ZenCard";
import { ErrorState } from "@/components/feedback/ErrorState";
import { NullableBooleanField } from "@/components/forms/NullableBooleanField";
import { TextField } from "@/components/forms/TextField";
import { Eyebrow } from "@/components/text/Eyebrow";
import { FirstRunTipBanner } from "@/features/reviews/components/FirstRunTipBanner";
import { WeekStrip } from "@/features/reviews/components/WeekStrip";
import { formatMissedDays } from "@/features/reviews/formatMissedDays";
import { getHabitAdjustmentSuggestions } from "@/features/recommendations/habitAdjustmentEngine";
import { colors } from "@/theme/colors";
import { fontFamilies } from "@/theme/fontFamilies";
import { spacing } from "@/theme/spacing";
import { typography } from "@/theme/typography";

import type { HabitWeekSummary } from "@/features/reviews/buildGoalWeekSummary";
import type { ApplyTuneUpForHabitPayload } from "@/features/reviews/api";
import type {
  HabitAdjustmentSuggestion,
  HabitAdjustmentSuggestionType,
} from "@/features/recommendations/types";

// Stable min-height absorbs the suggestion + 1 short field. Bigger
// variants (dual-fire two-card stack) grow past this naturally, but
// the placeholder card never collapses below this so layout doesn't
// jump when the reveal swaps in.
const REVEAL_MIN_HEIGHT = 240;

const REVEAL_DURATION_MS = 250;

export type TuneUpInitialReview = {
  triggerWorked: boolean | null;
  tinyActionTooHard: boolean | null;
  adjustmentNote: string;
};

type TuneUpStepProps = {
  habit: HabitWeekSummary;
  stepNumber: number;
  totalSteps: number;
  weekStart: string;
  showFirstRunTip: boolean;
  onDismissFirstRunTip: () => void;
  /** Pre-fills Y/N and `adjustment_note` state on mount. Used when the
   * user navigates BACK into a previously-Apply'd tune-up via the header
   * chevron (or re-enters from Habit Detail per R18). Omitted on initial
   * entry — state starts fresh. */
  initialReview?: TuneUpInitialReview;
  /** Called when the user taps Apply & continue. Parent handles the
   * transactional write and advances the step on success. The Tune-Up
   * stays mounted with retry banner if the promise rejects. */
  onApply: (payload: ApplyTuneUpForHabitPayload) => Promise<void>;
  /** Called when the user taps Skip this habit. Parent writes a review
   * row (no habit patch) and advances the step. */
  onSkip: (payload: ApplyTuneUpForHabitPayload) => Promise<void>;
  /** Called the first time the user touches any field (Y/N or text).
   * Parent uses this to mark the current Tune-Up as dirty so
   * `beforeRemove` prompts before exit. Safe to call repeatedly — the
   * parent's setState is idempotent for the same Set value. */
  onInteraction: () => void;
  /** ScrollView from the parent — used to auto-scroll the reveal into
   * view when both diagnostic answers flip from null. */
  scrollViewRef?: React.RefObject<ScrollView | null>;
};

function suggestionTypeFromAnswers(args: {
  triggerWorked: boolean | null;
  tinyActionTooHard: boolean | null;
  weekConsistency: number;
  skipCount: number;
}): HabitAdjustmentSuggestion[] {
  return getHabitAdjustmentSuggestions({
    latestReview: {
      trigger_worked: args.triggerWorked,
      tiny_action_too_hard: args.tinyActionTooHard,
    },
    progress: {
      consistencyRate: args.weekConsistency,
      skipCount: args.skipCount,
      streak: 0,
    },
  });
}

function suggestionTypeSet(
  suggestions: HabitAdjustmentSuggestion[],
): Set<HabitAdjustmentSuggestionType> {
  return new Set(suggestions.map((s) => s.type));
}

export function TuneUpStep({
  habit,
  stepNumber,
  totalSteps,
  weekStart,
  showFirstRunTip,
  onDismissFirstRunTip,
  initialReview,
  onApply,
  onSkip,
  onInteraction,
  scrollViewRef,
}: TuneUpStepProps) {
  // Lazy initializers seed from initialReview when re-entering / stepping
  // back into a previously-Apply'd tune-up. On initial entry these all
  // fall back to the empty defaults.
  const [triggerWorked, setTriggerWorked] = useState<boolean | null>(
    initialReview?.triggerWorked ?? null,
  );
  const [tinyActionTooHard, setTinyActionTooHard] = useState<boolean | null>(
    initialReview?.tinyActionTooHard ?? null,
  );
  // The habit's cue / tiny_action already reflect any previous Apply
  // mutation (it's the post-mutation value on the habit row), so the
  // editor pre-fills correctly without needing a separate seed.
  const [editedCue, setEditedCue] = useState(habit.cue);
  const [editedTinyAction, setEditedTinyAction] = useState(habit.tinyAction);
  const [freeTextNote, setFreeTextNote] = useState(
    initialReview?.adjustmentNote ?? "",
  );
  const [isApplying, setIsApplying] = useState(false);
  const [isSkipping, setIsSkipping] = useState(false);
  const [applyError, setApplyError] = useState(false);

  const bothAnswered =
    triggerWorked !== null && tinyActionTooHard !== null;

  const suggestions = useMemo(
    () =>
      bothAnswered
        ? suggestionTypeFromAnswers({
            triggerWorked,
            tinyActionTooHard,
            weekConsistency: habit.weekConsistency,
            skipCount: habit.skipCount,
          })
        : [],
    [
      bothAnswered,
      triggerWorked,
      tinyActionTooHard,
      habit.weekConsistency,
      habit.skipCount,
    ],
  );

  const typeSet = suggestionTypeSet(suggestions);
  const editsCue = typeSet.has("change_trigger");
  const editsTinyAction = typeSet.has("make_tiny_action_smaller");
  const usesFreeText =
    typeSet.has("reduce_friction") ||
    (typeSet.has("keep_going") && suggestions.length === 1);
  const isMutable = editsCue || editsTinyAction;

  // Reveal animation. fade + small translateY drift.
  const opacityAnim = useRef(new Animated.Value(0)).current;
  const translateAnim = useRef(new Animated.Value(8)).current;
  useEffect(() => {
    if (bothAnswered) {
      Animated.parallel([
        Animated.timing(opacityAnim, {
          toValue: 1,
          duration: REVEAL_DURATION_MS,
          easing: Easing.out(Easing.cubic),
          useNativeDriver: true,
        }),
        Animated.timing(translateAnim, {
          toValue: 0,
          duration: REVEAL_DURATION_MS,
          easing: Easing.out(Easing.cubic),
          useNativeDriver: true,
        }),
      ]).start();
    } else {
      opacityAnim.setValue(0);
      translateAnim.setValue(8);
    }
  }, [bothAnswered, opacityAnim, translateAnim]);

  // Auto-scroll when the reveal first appears.
  const revealLayoutYRef = useRef<number | null>(null);
  const hasScrolledRef = useRef(false);
  function handleRevealLayout(e: LayoutChangeEvent) {
    revealLayoutYRef.current = e.nativeEvent.layout.y;
  }
  useEffect(() => {
    if (!bothAnswered || hasScrolledRef.current) return;
    if (revealLayoutYRef.current === null) return;
    scrollViewRef?.current?.scrollTo({
      animated: true,
      y: revealLayoutYRef.current,
    });
    hasScrolledRef.current = true;
  }, [bothAnswered, scrollViewRef]);

  // Apply-button enable rule.
  const cueChanged = editedCue.trim() !== habit.cue;
  const tinyActionChanged = editedTinyAction.trim() !== habit.tinyAction;
  const freeTextNonEmpty = freeTextNote.trim().length > 0;
  const applyEnabled =
    bothAnswered &&
    !isApplying &&
    !isSkipping &&
    (isMutable
      ? true // even a verbatim accept of the default is a valid Apply
      : usesFreeText
        ? freeTextNonEmpty
        : true);

  function buildPayload(forSkip: boolean): ApplyTuneUpForHabitPayload {
    if (forSkip) {
      return {
        adjustmentNote: "",
        habitId: habit.habitId,
        tinyActionTooHard,
        triggerWorked,
        weekStart,
        habitPatch: undefined,
      };
    }
    if (isMutable) {
      const patch: { cue?: string; tinyAction?: string } = {};
      if (editsCue && cueChanged) patch.cue = editedCue.trim();
      if (editsTinyAction && tinyActionChanged) {
        patch.tinyAction = editedTinyAction.trim();
      }
      // If the user accepted the suggestion verbatim, still send the
      // habit's existing value as the patch so the field that was the
      // subject of the suggestion is committed deliberately. This keeps
      // analytics' "textKept" flag honest at the wire layer.
      if (editsCue && !cueChanged) patch.cue = habit.cue;
      if (editsTinyAction && !tinyActionChanged) {
        patch.tinyAction = habit.tinyAction;
      }
      return {
        adjustmentNote: "",
        habitId: habit.habitId,
        tinyActionTooHard,
        triggerWorked,
        weekStart,
        habitPatch: Object.keys(patch).length > 0 ? patch : undefined,
      };
    }
    // Non-mutable: free-text note, no habit patch.
    return {
      adjustmentNote: freeTextNote.trim(),
      habitId: habit.habitId,
      tinyActionTooHard,
      triggerWorked,
      weekStart,
      habitPatch: undefined,
    };
  }

  async function handleApplyPress() {
    if (!applyEnabled) return;
    setApplyError(false);
    setIsApplying(true);
    try {
      await onApply(buildPayload(false));
      // Parent's onApply resolves when the mutation succeeds AND the
      // step has advanced. Tune-up is unmounted at that point, so the
      // state we reset here is just defensive.
    } catch {
      setApplyError(true);
    } finally {
      setIsApplying(false);
    }
  }

  async function handleSkipPress() {
    if (isApplying || isSkipping) return;
    setApplyError(false);
    setIsSkipping(true);
    try {
      await onSkip(buildPayload(true));
    } catch {
      setApplyError(true);
    } finally {
      setIsSkipping(false);
    }
  }

  const missedCallout = formatMissedDays(habit.weekLogs);

  /**
   * Renders a habit-contextual body for suggestion types where the
   * static copy from `HABIT_ADJUSTMENT_SUGGESTIONS` would feel
   * generic. Currently only `reduce_friction` overrides — it's the
   * one type that ALWAYS fires under the same user input shape
   * (trigger worked, action not too hard, but consistency low), so
   * weaving in the actual day count makes the diagnosis concrete.
   */
  function bodyForSuggestion(
    suggestion: HabitAdjustmentSuggestion,
  ): string {
    if (suggestion.type === "reduce_friction") {
      return `Your trigger held and the action isn't too hard — but you only showed up ${habit.doneCount} of ${habit.activeDayCount} days this week. Something between intention and action is failing. Name what it is, and pick one small change to make it less likely next week.`;
    }
    return suggestion.body;
  }

  /**
   * Renders the input field paired with a given suggestion — sits
   * directly below the suggestion's body inside the same card so the
   * "change to make" is co-located with the "why." On dual-fire this
   * means tiny-action edits live with the `make_tiny_action_smaller`
   * card and trigger edits live with the `change_trigger` card,
   * rather than both inputs being stacked into a separate trailing
   * card.
   */
  function renderInputForSuggestion(suggestion: HabitAdjustmentSuggestion) {
    switch (suggestion.type) {
      case "make_tiny_action_smaller":
        return (
          <TextField
            label="Your tiny action"
            onChangeText={(v) => {
              onInteraction();
              setEditedTinyAction(v);
            }}
            placeholder="Make it so small it feels effortless"
            value={editedTinyAction}
          />
        );
      case "change_trigger":
        return (
          <TextField
            label="Your trigger"
            onChangeText={(v) => {
              onInteraction();
              setEditedCue(v);
            }}
            placeholder="Anchor to a clear daily moment"
            value={editedCue}
          />
        );
      case "reduce_friction":
      case "keep_going":
        return (
          <TextField
            label="What will you try?"
            multiline
            onChangeText={(v) => {
              onInteraction();
              setFreeTextNote(v);
            }}
            placeholder="One small change for next week"
            value={freeTextNote}
          />
        );
      default:
        return null;
    }
  }

  return (
    <View style={styles.container}>
      <Eyebrow
        label={`Tune-up · ${stepNumber} of ${totalSteps}`}
        tone="primary"
      />

      {showFirstRunTip ? (
        <FirstRunTipBanner
          message="These are the habits that need a tune-up. We'll go through them one at a time — diagnose what got in the way, then write the adjustment."
          onDismiss={onDismissFirstRunTip}
          testID="tune-up-first-run-tip"
        />
      ) : null}

      <ZenCard>
        <View style={styles.titleRow}>
          {habit.icon ? (
            <LucideIcon color={colors.text} name={habit.icon} size={18} />
          ) : null}
          <Text style={styles.title}>{habit.title}</Text>
        </View>
        <Text style={styles.count}>
          {habit.doneCount} of {habit.activeDayCount} days
        </Text>

        <WeekStrip
          activeDayCount={habit.activeDayCount}
          compact
          days={habit.weekLogs}
          doneCount={habit.doneCount}
          habitTitle={habit.title}
          icon={null}
        />

        {missedCallout ? (
          <Text style={styles.callout}>{missedCallout}</Text>
        ) : null}

        <View style={styles.fields}>
          <NullableBooleanField
            label="Did your trigger work?"
            onChange={(v) => {
              onInteraction();
              setTriggerWorked(v);
            }}
            value={triggerWorked}
          />
          <NullableBooleanField
            label="Was the tiny action too hard?"
            onChange={(v) => {
              onInteraction();
              setTinyActionTooHard(v);
            }}
            value={tinyActionTooHard}
          />
        </View>
      </ZenCard>

      <View
        onLayout={handleRevealLayout}
        style={styles.revealRegion}
      >
        {!bothAnswered ? (
          <View style={[styles.placeholder, { minHeight: REVEAL_MIN_HEIGHT }]}>
            <Text style={styles.placeholderText}>
              Answer both questions to see your tune-up.
            </Text>
          </View>
        ) : (
          <Animated.View
            style={[
              styles.revealContent,
              { minHeight: REVEAL_MIN_HEIGHT },
              {
                opacity: opacityAnim,
                transform: [{ translateY: translateAnim }],
              },
            ]}
          >
            {/* Each suggestion card carries its paired input field
             * directly below the body — this used to be split into a
             * separate "input card" at the bottom that stacked both
             * fields together on dual-fire, which decoupled each
             * suggestion from the change it was asking for. Now the
             * change-to-make sits right under the explanation. */}
            {suggestions.map((suggestion, index) => (
              <ZenCard key={suggestion.type}>
                <Eyebrow
                  label={
                    suggestions.length === 1
                      ? "One thing to try"
                      : `One thing to try · ${index + 1} of ${suggestions.length}`
                  }
                />
                <Text style={styles.suggestionTitle}>{suggestion.title}</Text>
                <Text style={styles.suggestionBody}>
                  {bodyForSuggestion(suggestion)}
                </Text>
                {renderInputForSuggestion(suggestion)}
              </ZenCard>
            ))}

            <Pressable
              accessibilityLabel="Skip this habit"
              accessibilityRole="button"
              disabled={isApplying || isSkipping}
              onPress={() => void handleSkipPress()}
              style={styles.skipButton}
            >
              <Text style={styles.skipLabel}>
                {isSkipping ? "Skipping…" : "Skip this habit"}
              </Text>
            </Pressable>

            {applyError ? (
              <ErrorState message="We couldn't save your tune-up. Try again." />
            ) : null}

            <PrimaryButton
              disabled={!applyEnabled}
              label={
                isApplying
                  ? "Saving…"
                  : applyError
                    ? "Retry"
                    : "Apply & continue"
              }
              onPress={() => void handleApplyPress()}
              showArrow
            />
          </Animated.View>
        )}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  callout: {
    color: colors.textMuted,
    fontFamily: fontFamilies.body,
    fontSize: typography.bodyMd,
    lineHeight: 20,
  },
  container: {
    gap: spacing.lg,
  },
  count: {
    color: colors.textMuted,
    fontFamily: fontFamilies.body,
    fontSize: typography.bodyMd,
  },
  fields: {
    gap: spacing.md,
  },
  placeholder: {
    alignItems: "center",
    backgroundColor: colors.surface,
    borderRadius: 12,
    justifyContent: "center",
    padding: spacing.xl,
  },
  placeholderText: {
    color: colors.textFaint,
    fontFamily: fontFamilies.body,
    fontSize: typography.bodyMd,
    fontStyle: "italic",
    textAlign: "center",
  },
  revealContent: {
    gap: spacing.lg,
  },
  revealRegion: {
    gap: spacing.lg,
  },
  skipButton: {
    alignItems: "center",
    paddingVertical: spacing.sm,
  },
  skipLabel: {
    color: colors.textMuted,
    fontFamily: fontFamilies.bodySemi,
    fontSize: typography.bodyMd,
  },
  suggestionBody: {
    color: colors.textMuted,
    fontFamily: fontFamilies.body,
    fontSize: typography.bodyMd,
    lineHeight: 20,
  },
  suggestionTitle: {
    color: colors.text,
    fontFamily: fontFamilies.displaySemi,
    fontSize: typography.titleMd,
  },
  title: {
    color: colors.text,
    flexShrink: 1,
    fontFamily: fontFamilies.bodySemi,
    fontSize: typography.bodyLg,
  },
  titleRow: {
    alignItems: "center",
    flexDirection: "row",
    gap: spacing.sm,
  },
});
