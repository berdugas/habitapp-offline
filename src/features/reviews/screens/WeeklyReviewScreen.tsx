import { useEffect, useRef, useState } from "react";
import { Pressable, ScrollView, StyleSheet, Text, View } from "react-native";
import { router, useLocalSearchParams } from "expo-router";

import { PrimaryButton } from "@/components/buttons/PrimaryButton";
import { SecondaryButton } from "@/components/buttons/SecondaryButton";
import { ZenCard } from "@/components/cards/ZenCard";
import { ErrorState } from "@/components/feedback/ErrorState";
import { LoadingState } from "@/components/feedback/LoadingState";
import { TextField } from "@/components/forms/TextField";
import { Eyebrow } from "@/components/text/Eyebrow";
import { useHabitDetail } from "@/features/habits/hooks";
import { getHabitAdjustmentSuggestions } from "@/features/recommendations/habitAdjustmentEngine";
import {
  useCurrentWeeklyReviewQuery,
  useUpsertWeeklyReviewMutation,
} from "@/features/reviews/hooks";
import { useTrialValidation } from "@/features/trial/hooks";
import { colors } from "@/theme/colors";
import { fontFamilies } from "@/theme/fontFamilies";
import { radius } from "@/theme/radius";
import { spacing } from "@/theme/spacing";
import { typography } from "@/theme/typography";
import { getWeekStartDateString } from "@/utils/dates";
import { normalizeParam } from "@/utils/params";
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

function normalizeReturnTo(value: string | string[] | undefined) {
  const normalized = normalizeParam(value);

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
  const habitId = normalizeParam(habitIdParam);
  const returnTo = normalizeReturnTo(returnToParam);
  const weekStart = getWeekStartDateString();
  const { accessMode } = useTrialValidation();
  const isReadOnly = accessMode === "read_only";
  const habitDetail = useHabitDetail(habitId);
  const currentReviewQuery = useCurrentWeeklyReviewQuery(habitId);
  const upsertWeeklyReviewMutation = useUpsertWeeklyReviewMutation();
  const saveSubmitLockRef = useRef(false);

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

    const currentHabit = habitDetail.habit;
    const currentProgress = habitDetail.progress;

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
        habit: currentHabit,
        latestReview: savedReview,
        progress: currentProgress,
      });
      setAdjustmentSuggestion(suggestions[0] ?? null);
      setReviewSaved(true);
    } catch {
      setSaveError(true);
      setAdjustmentSuggestion(null);
    } finally {
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

  if (isReadOnly) {
    return (
      <ScrollView
        contentContainerStyle={styles.content}
        contentInsetAdjustmentBehavior="automatic"
        style={styles.screen}
      >
        <ZenCard>
          <Eyebrow label="Weekly Review" />
          <Text selectable style={styles.body}>
            Weekly reviews aren't available while the app is in read-only mode.
            Reconnect to restore full access.
          </Text>
        </ZenCard>
        <SecondaryButton label="Go back" onPress={() => router.back()} />
      </ScrollView>
    );
  }

  const isSaveBlocked = upsertWeeklyReviewMutation.isPending || reviewSaved;
  const doneDestination: string | null = habitId
    ? returnTo === "today"
      ? "/(app)/(tabs)/today"
      : `/(app)/habits/${habitId}`
    : null;

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

      <ZenCard>
        <Text selectable style={styles.cardTitle}>
          {habitDetail.habit.title}
        </Text>
        <Text selectable style={styles.body}>
          Week of {weekStart}
        </Text>
      </ZenCard>

      {validationError ? <ErrorState message={validationError} /> : null}
      {saveError || upsertWeeklyReviewMutation.error ? (
        <ErrorState message={getSaveWeeklyReviewErrorMessage()} />
      ) : null}
      <ZenCard>
        <View style={styles.formSection}>
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
        </View>
        <View style={styles.formSection}>
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
        </View>
        <View style={styles.formSection}>
          <TextField
            label="What small adjustment do you want to try next week?"
            multiline
            onChangeText={setAdjustmentNote}
            placeholder="One small change for next week"
            value={adjustmentNote}
          />
        </View>
      </ZenCard>

      {reviewSaved ? (
        <ZenCard style={styles.successCard}>
          <Text selectable style={styles.successTitle}>
            Review saved
          </Text>
          <Text selectable style={styles.successBody}>
            Your habit reflection has been updated for this week.
          </Text>
        </ZenCard>
      ) : null}
      {adjustmentSuggestion ? (
        <ZenCard>
          <Eyebrow label="Suggested adjustment" />
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
        </ZenCard>
      ) : null}

      {reviewSaved ? (
        <PrimaryButton
          disabled={!doneDestination}
          label="Done"
          onPress={() => {
            if (doneDestination) {
              router.replace(doneDestination);
            }
          }}
        />
      ) : (
        <PrimaryButton
          disabled={isSaveBlocked}
          label={
            upsertWeeklyReviewMutation.isPending
              ? "Saving review..."
              : "Save weekly review"
          }
          onPress={() => void handleSavePress()}
        />
      )}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  body: {
    color: colors.textMuted,
    fontFamily: fontFamilies.body,
    fontSize: typography.bodyLg,
    lineHeight: 24,
  },
  booleanField: {
    gap: spacing.sm,
  },
  booleanHelper: {
    color: colors.textMuted,
    fontFamily: fontFamilies.body,
    fontSize: typography.bodyMd,
    lineHeight: 20,
  },
  booleanLabel: {
    color: colors.text,
    fontFamily: fontFamilies.bodySemi,
    fontSize: typography.bodyMd,
  },
  cardTitle: {
    color: colors.text,
    fontFamily: fontFamilies.displaySemi,
    fontSize: typography.titleLg,
  },
  content: {
    gap: spacing.xl,
    padding: spacing.xl,
  },
  formSection: {
    gap: spacing.lg,
  },
  header: {
    gap: spacing.sm,
  },
  screen: {
    backgroundColor: colors.bg,
    flex: 1,
  },
  segmentedControl: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: spacing.sm,
  },
  successBody: {
    color: colors.textMuted,
    fontFamily: fontFamilies.body,
    fontSize: typography.bodyMd,
    lineHeight: 20,
  },
  successCard: {
    backgroundColor: colors.primarySoft,
  },
  successTitle: {
    color: colors.primary,
    fontFamily: fontFamilies.bodySemi,
    fontSize: typography.bodyLg,
  },
  suggestionBody: {
    color: colors.textMuted,
    fontFamily: fontFamilies.body,
    fontSize: typography.bodyMd,
    lineHeight: 20,
  },
  suggestionReason: {
    color: colors.textMuted,
    fontFamily: fontFamilies.body,
    fontSize: typography.bodyMd,
    lineHeight: 20,
  },
  suggestionReasonLabel: {
    color: colors.text,
    fontFamily: fontFamilies.bodySemi,
    fontSize: typography.labelMd,
  },
  suggestionTitle: {
    color: colors.text,
    fontFamily: fontFamilies.displaySemi,
    fontSize: typography.titleMd,
  },
  segmentButton: {
    backgroundColor: colors.surface,
    borderRadius: radius.pill,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
  },
  segmentButtonLabel: {
    color: colors.textMuted,
    fontFamily: fontFamilies.bodyMedium,
    fontSize: typography.bodyMd,
  },
  segmentButtonLabelSelected: {
    color: colors.primary,
    fontFamily: fontFamilies.bodySemi,
  },
  segmentButtonSelected: {
    backgroundColor: colors.primarySoft,
  },
  title: {
    color: colors.text,
    fontFamily: fontFamilies.displayBold,
    fontSize: typography.headlineLg,
  },
});
