import { useEffect, useRef, useState } from "react";
import { Pressable, ScrollView, StyleSheet, Text, View } from "react-native";
import { router, useLocalSearchParams } from "expo-router";

import { PrimaryButton } from "@/components/buttons/PrimaryButton";
import { ErrorState } from "@/components/feedback/ErrorState";
import { LoadingState } from "@/components/feedback/LoadingState";
import { TextField } from "@/components/forms/TextField";
import { useHabitDetail } from "@/features/habits/hooks";
import { getHabitAdjustmentSuggestions } from "@/features/recommendations/habitAdjustmentEngine";
import {
  useCurrentWeeklyReviewQuery,
  useUpsertWeeklyReviewMutation,
} from "@/features/reviews/hooks";
import { colors } from "@/theme/colors";
import { radius } from "@/theme/radius";
import { spacing } from "@/theme/spacing";
import { getWeekStartDateString } from "@/utils/dates";
import {
  getLoadWeeklyReviewErrorMessage,
  getSaveWeeklyReviewErrorMessage,
} from "@/utils/userFacingErrors";

import type { HabitAdjustmentSuggestion } from "@/features/recommendations/types";

type NullableBooleanFieldProps = {
  label: string;
  onChange: (value: boolean | null) => void;
  value: boolean | null;
};

const REVIEW_SAVE_SUCCESS_DELAY_MS = 1500;

function normalizeHabitId(habitId: string | string[] | undefined) {
  if (Array.isArray(habitId)) {
    return habitId[0];
  }

  return habitId;
}

function normalizeReturnTo(value: string | string[] | undefined) {
  const normalized = Array.isArray(value) ? value[0] : value;

  return normalized === "today" ? "today" : "habitDetail";
}

function NullableBooleanField({
  label,
  onChange,
  value,
}: NullableBooleanFieldProps) {
  const options: Array<{ label: string; value: boolean }> = [
    { label: "Yes", value: true },
    { label: "No", value: false },
  ];

  return (
    <View style={styles.booleanField}>
      <Text selectable style={styles.booleanLabel}>
        {label}
      </Text>
      <View style={styles.segmentedControl}>
        {options.map((option) => {
          const isSelected = value === option.value;

          return (
            <Pressable
              accessibilityLabel={`${label}: ${option.label}`}
              accessibilityRole="button"
              key={option.label}
              onPress={() => onChange(option.value)}
              style={[
                styles.segmentButton,
                isSelected && styles.segmentButtonSelected,
              ]}
            >
              <Text
                selectable
                style={[
                  styles.segmentButtonLabel,
                  isSelected && styles.segmentButtonLabelSelected,
                ]}
              >
                {option.label}
              </Text>
            </Pressable>
          );
        })}
      </View>
    </View>
  );
}

export default function WeeklyReviewScreen() {
  const {
    habitId: habitIdParam,
    returnTo: returnToParam,
  } = useLocalSearchParams<{
    habitId?: string | string[];
    returnTo?: string | string[];
  }>();
  const habitId = normalizeHabitId(habitIdParam);
  const returnTo = normalizeReturnTo(returnToParam);
  const weekStart = getWeekStartDateString();
  const habitDetail = useHabitDetail(habitId);
  const currentReviewQuery = useCurrentWeeklyReviewQuery(habitId);
  const upsertWeeklyReviewMutation = useUpsertWeeklyReviewMutation();
  const saveSubmitLockRef = useRef(false);
  const successNavigationTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(
    null,
  );

  const [wentWell, setWentWell] = useState("");
  const [wasHard, setWasHard] = useState("");
  const [adjustmentNote, setAdjustmentNote] = useState("");
  const [triggerWorked, setTriggerWorked] = useState<boolean | null>(null);
  const [tinyActionTooHard, setTinyActionTooHard] = useState<boolean | null>(
    null,
  );
  const [validationError, setValidationError] = useState<string | null>(null);
  const [saveError, setSaveError] = useState(false);
  const [reviewSaved, setReviewSaved] = useState(false);
  const [adjustmentSuggestion, setAdjustmentSuggestion] =
    useState<HabitAdjustmentSuggestion | null>(null);

  useEffect(() => {
    return () => {
      if (successNavigationTimeoutRef.current) {
        clearTimeout(successNavigationTimeoutRef.current);
      }
    };
  }, []);

  useEffect(() => {
    const review = currentReviewQuery.data;

    if (!review) {
      return;
    }

    setWentWell(review.went_well ?? "");
    setWasHard(review.was_hard ?? "");
    setAdjustmentNote(review.adjustment_note ?? "");
    setTriggerWorked(review.trigger_worked);
    setTinyActionTooHard(review.tiny_action_too_hard);
  }, [currentReviewQuery.data]);

  async function handleSavePress() {
    if (
      !habitId ||
      !habitDetail.habit ||
      saveSubmitLockRef.current ||
      upsertWeeklyReviewMutation.isPending ||
      reviewSaved
    ) {
      return;
    }

    setValidationError(null);
    setSaveError(false);
    setReviewSaved(false);
    setAdjustmentSuggestion(null);

    if (triggerWorked === null || tinyActionTooHard === null) {
      setValidationError("Answer both yes/no questions before saving.");
      return;
    }

    saveSubmitLockRef.current = true;

    try {
      const savedReview = await upsertWeeklyReviewMutation.mutateAsync({
        adjustmentNote: adjustmentNote.trim(),
        habitId,
        tinyActionTooHard,
        triggerWorked,
        wasHard: wasHard.trim(),
        weekStart,
        wentWell: wentWell.trim(),
      });
      const suggestions = getHabitAdjustmentSuggestions({
        habit: habitDetail.habit,
        latestReview: savedReview,
        progress: habitDetail.progress,
      });
      setAdjustmentSuggestion(suggestions[0] ?? null);
      setReviewSaved(true);

      const destination =
        returnTo === "today" ? "/(app)/(tabs)/today" : `/(app)/habits/${habitId}`;

      successNavigationTimeoutRef.current = setTimeout(() => {
        router.replace(destination);
      }, REVIEW_SAVE_SUCCESS_DELAY_MS);
    } catch {
      setSaveError(true);
      setAdjustmentSuggestion(null);
      saveSubmitLockRef.current = false;
    }
  }

  if (habitDetail.isLoading || currentReviewQuery.isLoading) {
    return <LoadingState message="Loading weekly review..." />;
  }

  if (habitDetail.error || currentReviewQuery.error || !habitDetail.habit) {
    return (
      <ScrollView
        contentContainerStyle={styles.content}
        contentInsetAdjustmentBehavior="automatic"
        style={styles.screen}
      >
        <ErrorState message={getLoadWeeklyReviewErrorMessage()} />
      </ScrollView>
    );
  }

  const isSaveBlocked = upsertWeeklyReviewMutation.isPending || reviewSaved;

  return (
    <ScrollView
      contentContainerStyle={styles.content}
      contentInsetAdjustmentBehavior="automatic"
      style={styles.screen}
    >
      <View style={styles.header}>
        <Text selectable style={styles.title}>
          Weekly Review
        </Text>
        <Text selectable style={styles.body}>
          Take one minute to notice what worked and what needs adjusting.
        </Text>
      </View>

      <View style={styles.card}>
        <Text selectable style={styles.cardTitle}>
          {habitDetail.habit.title}
        </Text>
        <Text selectable style={styles.body}>
          Week of {weekStart}
        </Text>
      </View>

      {validationError ? <ErrorState message={validationError} /> : null}
      {saveError || upsertWeeklyReviewMutation.error ? (
        <ErrorState message={getSaveWeeklyReviewErrorMessage()} />
      ) : null}
      <View style={styles.card}>
        <TextField
          label="What went well this week?"
          multiline
          onChangeText={setWentWell}
          placeholder="The moment that felt easiest"
          value={wentWell}
        />
        <TextField
          label="What was hard this week?"
          multiline
          onChangeText={setWasHard}
          placeholder="The part that got in the way"
          value={wasHard}
        />
        <Text selectable style={styles.booleanHelper}>
          These answers help the app suggest what to adjust next week.
        </Text>
        <NullableBooleanField
          label="Did your trigger work?"
          onChange={setTriggerWorked}
          value={triggerWorked}
        />
        <NullableBooleanField
          label="Was the tiny action too hard?"
          onChange={setTinyActionTooHard}
          value={tinyActionTooHard}
        />
        <TextField
          label="What small adjustment do you want to try next week?"
          multiline
          onChangeText={setAdjustmentNote}
          placeholder="One small change for next week"
          value={adjustmentNote}
        />
      </View>

      {reviewSaved ? (
        <View style={styles.successCard}>
          <Text selectable style={styles.successTitle}>
            Review saved
          </Text>
          <Text selectable style={styles.successBody}>
            Your habit reflection has been updated for this week.
          </Text>
        </View>
      ) : null}
      {adjustmentSuggestion ? (
        <View style={styles.suggestionCard}>
          <Text selectable style={styles.suggestionEyebrow}>
            Suggested adjustment
          </Text>
          <Text selectable style={styles.suggestionTitle}>
            {adjustmentSuggestion.title}
          </Text>
          <Text selectable style={styles.suggestionBody}>
            {adjustmentSuggestion.body}
          </Text>
          <Text selectable style={styles.suggestionReasonLabel}>
            Why this suggestion
          </Text>
          <Text selectable style={styles.suggestionReason}>
            {adjustmentSuggestion.reason}
          </Text>
        </View>
      ) : null}

      <PrimaryButton
        disabled={isSaveBlocked}
        label={
          upsertWeeklyReviewMutation.isPending
            ? "Saving review..."
            : "Save weekly review"
        }
        onPress={() => void handleSavePress()}
      />
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  body: {
    color: colors.textMuted,
    fontSize: 16,
    lineHeight: 24,
  },
  booleanField: {
    gap: spacing.sm,
  },
  booleanHelper: {
    color: colors.textMuted,
    fontSize: 14,
    lineHeight: 20,
  },
  booleanLabel: {
    color: colors.text,
    fontSize: 16,
    fontWeight: "600",
  },
  card: {
    backgroundColor: colors.surface,
    borderColor: colors.border,
    borderRadius: radius.lg,
    borderWidth: 1,
    gap: spacing.lg,
    padding: spacing.xl,
  },
  cardTitle: {
    color: colors.text,
    fontSize: 20,
    fontWeight: "700",
  },
  content: {
    gap: spacing.xl,
    padding: spacing.xl,
  },
  header: {
    gap: spacing.sm,
  },
  screen: {
    backgroundColor: colors.background,
    flex: 1,
  },
  segmentedControl: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: spacing.sm,
  },
  successBody: {
    color: colors.textMuted,
    fontSize: 14,
    lineHeight: 20,
  },
  successCard: {
    backgroundColor: colors.surface,
    borderColor: colors.success,
    borderRadius: radius.lg,
    borderWidth: 1,
    gap: spacing.xs,
    padding: spacing.lg,
  },
  successTitle: {
    color: colors.success,
    fontSize: 16,
    fontWeight: "700",
  },
  suggestionBody: {
    color: colors.textMuted,
    fontSize: 14,
    lineHeight: 20,
  },
  suggestionCard: {
    backgroundColor: colors.surface,
    borderColor: colors.border,
    borderRadius: radius.lg,
    borderWidth: 1,
    gap: spacing.sm,
    padding: spacing.lg,
  },
  suggestionEyebrow: {
    color: colors.textMuted,
    fontSize: 12,
    fontWeight: "700",
    textTransform: "uppercase",
  },
  suggestionReason: {
    color: colors.textMuted,
    fontSize: 14,
    lineHeight: 20,
  },
  suggestionReasonLabel: {
    color: colors.text,
    fontSize: 13,
    fontWeight: "700",
  },
  suggestionTitle: {
    color: colors.text,
    fontSize: 18,
    fontWeight: "700",
  },
  segmentButton: {
    backgroundColor: colors.background,
    borderColor: colors.border,
    borderRadius: radius.pill,
    borderWidth: 1,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
  },
  segmentButtonLabel: {
    color: colors.text,
    fontSize: 14,
    fontWeight: "600",
  },
  segmentButtonLabelSelected: {
    color: colors.white,
  },
  segmentButtonSelected: {
    backgroundColor: colors.accent,
    borderColor: colors.accent,
  },
  title: {
    color: colors.text,
    fontSize: 28,
    fontWeight: "800",
  },
});
