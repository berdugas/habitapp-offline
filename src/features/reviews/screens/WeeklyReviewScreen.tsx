/**
 * @deprecated Use GoalReviewScreen for goal-attached habits.
 * This screen is retained as a fallback for orphan habits (no identity_phrase).
 * Remove once all habits are guaranteed to have a goal.
 */
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
import { useThemedStyles } from "@/theme/useThemedStyles";
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
  const styles = useThemedStyles((t) =>
    StyleSheet.create({
      booleanField: {
        gap: t.spacing.sm,
      },
      booleanLabel: {
        color: t.colors.text,
        fontFamily: t.fontFamilies.bodySemi,
        fontSize: t.typography.bodyMd,
      },
      segmentedControl: {
        flexDirection: "row",
        flexWrap: "wrap",
        gap: t.spacing.sm,
      },
      segmentButton: {
        backgroundColor: t.colors.surface,
        borderRadius: t.radius.pill,
        paddingHorizontal: t.spacing.md,
        paddingVertical: t.spacing.sm,
      },
      segmentButtonSelected: {
        backgroundColor: t.colors.primarySoft,
      },
      segmentButtonLabel: {
        color: t.colors.textMuted,
        fontFamily: t.fontFamilies.bodyMedium,
        fontSize: t.typography.bodyMd,
      },
      segmentButtonLabelSelected: {
        color: t.colors.primary,
        fontFamily: t.fontFamilies.bodySemi,
      },
    }),
  );

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
  const styles = useThemedStyles((t) =>
    StyleSheet.create({
      body: {
        color: t.colors.textMuted,
        fontFamily: t.fontFamilies.body,
        fontSize: t.typography.bodyLg,
        lineHeight: 21,
      },
      booleanHelper: {
        color: t.colors.textMuted,
        fontFamily: t.fontFamilies.body,
        fontSize: t.typography.bodyMd,
        lineHeight: 18.6,
      },
      cardTitle: {
        color: t.colors.text,
        fontFamily: t.fontFamilies.displaySemi,
        fontSize: t.typography.titleLg,
      },
      content: {
        gap: t.spacing.xl,
        padding: t.spacing.xl,
      },
      formSection: {
        gap: t.spacing.lg,
      },
      header: {
        gap: t.spacing.sm,
      },
      screen: {
        backgroundColor: t.colors.bg,
        flex: 1,
      },
      successBody: {
        color: t.colors.textMuted,
        fontFamily: t.fontFamilies.body,
        fontSize: t.typography.bodyMd,
        lineHeight: 18.6,
      },
      successCard: {
        backgroundColor: t.colors.primarySoft,
      },
      successTitle: {
        color: t.colors.primary,
        fontFamily: t.fontFamilies.bodySemi,
        fontSize: t.typography.bodyLg,
      },
      suggestionBody: {
        color: t.colors.textMuted,
        fontFamily: t.fontFamilies.body,
        fontSize: t.typography.bodyMd,
        lineHeight: 18.6,
      },
      suggestionReason: {
        color: t.colors.textMuted,
        fontFamily: t.fontFamilies.body,
        fontSize: t.typography.bodyMd,
        lineHeight: 18.6,
      },
      suggestionReasonLabel: {
        color: t.colors.text,
        fontFamily: t.fontFamilies.bodySemi,
        fontSize: t.typography.labelMd,
      },
      suggestionTitle: {
        color: t.colors.text,
        fontFamily: t.fontFamilies.displaySemi,
        fontSize: t.typography.titleMd,
      },
      title: {
        color: t.colors.text,
        fontFamily: t.fontFamilies.displayBold,
        fontSize: t.typography.headlineLg,
      },
    }),
  );

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
        weekStart,
      });

      const suggestions = getHabitAdjustmentSuggestions({
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

