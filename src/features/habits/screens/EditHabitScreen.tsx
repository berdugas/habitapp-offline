import { useEffect, useMemo, useRef, useState } from "react";
import { ScrollView, StyleSheet, Text, View } from "react-native";
import { router, useLocalSearchParams } from "expo-router";

import { PrimaryButton } from "@/components/buttons/PrimaryButton";
import { SecondaryButton } from "@/components/buttons/SecondaryButton";
import { FEATURE_FLAGS } from "@/config/featureFlags";
import { ErrorState } from "@/components/feedback/ErrorState";
import { LoadingState } from "@/components/feedback/LoadingState";
import { ChoicePills } from "@/components/forms/ChoicePills";
import { TextField } from "@/components/forms/TextField";
import {
  useOwnedHabitQuery,
  useUpdateHabitMutation,
} from "@/features/habits/hooks";
import {
  formatHabitFormula,
  stripLeadingAfter,
} from "@/features/habits/formatters";
import { PREFERRED_TIME_WINDOW_OPTIONS } from "@/features/habits/preferredTimeWindows";
import {
  normalizeHabitSetupPayload,
  validateHabitSetupPayload,
} from "@/features/habits/validators";
import { getHabitSuggestionEditGuidance } from "@/features/recommendations/editGuidance";
import { useGenerateHabitRewriteMutation } from "@/features/recommendations/hooks";
import {
  normalizeHabitAdjustmentSuggestionType,
} from "@/features/recommendations/types";
import { colors } from "@/theme/colors";
import { radius } from "@/theme/radius";
import { spacing } from "@/theme/spacing";
import {
  getGenerateHabitRewriteErrorMessage,
  getLoadHabitDetailErrorMessage,
  getUpdateHabitErrorMessage,
} from "@/utils/userFacingErrors";

import type { GenerateHabitRewriteResponse } from "@/features/recommendations/aiRewriteApi";
import type { HabitAdjustmentSuggestionType } from "@/features/recommendations/types";

function getRewriteRequestSuggestionType(
  suggestionType: HabitAdjustmentSuggestionType,
) {
  return suggestionType === "fix_trigger_and_tiny_action"
    ? "make_tiny_action_smaller"
    : suggestionType;
}

export default function EditHabitScreen() {
  const { habitId, suggestionType } = useLocalSearchParams<{
    habitId?: string | string[];
    suggestionType?: string | string[];
  }>();
  const ownedHabitQuery = useOwnedHabitQuery(habitId);
  const updateHabitMutation = useUpdateHabitMutation();
  const generateRewriteMutation = useGenerateHabitRewriteMutation();
  const hasHydratedFormRef = useRef(false);
  const submitLockRef = useRef(false);
  const normalizedSuggestionType =
    normalizeHabitAdjustmentSuggestionType(suggestionType);
  const suggestionGuidance = getHabitSuggestionEditGuidance(suggestionType);

  const [title, setTitle] = useState("");
  const [identityPhrase, setIdentityPhrase] = useState("");
  const [cue, setCue] = useState("");
  const [tinyAction, setTinyAction] = useState("");
  const [minimumViableAction, setMinimumViableAction] = useState("");
  const [preferredTimeWindow, setPreferredTimeWindow] = useState("");
  const [formError, setFormError] = useState<string | null>(null);
  const [rewriteDraft, setRewriteDraft] =
    useState<GenerateHabitRewriteResponse | null>(null);
  const [rewriteError, setRewriteError] = useState<string | null>(null);
  const [rewriteCopyMessage, setRewriteCopyMessage] = useState<string | null>(
    null,
  );
  const hasGeneratedRewrite = Boolean(rewriteDraft);
  const hasRewriteFieldChanges = Boolean(
    rewriteDraft?.suggestedStackTrigger || rewriteDraft?.suggestedTinyAction,
  );
  const rewriteButtonLabel = generateRewriteMutation.isPending
    ? "Generating rewrite..."
    : rewriteError
      ? "Try again"
      : hasGeneratedRewrite
        ? "Generate another rewrite"
        : "Generate rewrite";

  const formPayload = {
    title,
    identityPhrase,
    cue,
    tinyAction,
    minimumViableAction,
    preferredTimeWindow,
  };
  const normalizedPayload = normalizeHabitSetupPayload(formPayload);
  const validationErrors = useMemo(
    () => validateHabitSetupPayload(formPayload),
    [formPayload],
  );

  useEffect(() => {
    if (!ownedHabitQuery.data || hasHydratedFormRef.current) {
      return;
    }

    setTitle(ownedHabitQuery.data.title);
    setIdentityPhrase(ownedHabitQuery.data.identity_phrase ?? "");
    setCue(ownedHabitQuery.data.cue);
    setTinyAction(ownedHabitQuery.data.tiny_action);
    setMinimumViableAction(ownedHabitQuery.data.minimum_viable_action ?? "");
    setPreferredTimeWindow(ownedHabitQuery.data.preferred_time_window ?? "");
    hasHydratedFormRef.current = true;
  }, [ownedHabitQuery.data]);

  async function handleSave() {
    if (
      submitLockRef.current ||
      updateHabitMutation.isPending ||
      !ownedHabitQuery.data
    ) {
      return;
    }

    setFormError(null);

    if (Object.keys(validationErrors).length > 0) {
      setFormError("Fix the highlighted fields before saving.");
      return;
    }

    submitLockRef.current = true;

    try {
      await updateHabitMutation.mutateAsync({
        habitId: ownedHabitQuery.data.id,
        payload: normalizedPayload,
      });
      router.replace(`/(app)/habits/${ownedHabitQuery.data.id}`);
    } catch {
      setFormError(getUpdateHabitErrorMessage());
    } finally {
      submitLockRef.current = false;
    }
  }

  async function handleGenerateRewrite() {
    if (
      !FEATURE_FLAGS.aiRewrite ||
      generateRewriteMutation.isPending ||
      !ownedHabitQuery.data ||
      !normalizedSuggestionType
    ) {
      return;
    }

    setRewriteDraft(null);
    setRewriteError(null);
    setRewriteCopyMessage(null);

    try {
      const response = await generateRewriteMutation.mutateAsync({
        habitId: ownedHabitQuery.data.id,
        suggestionType: getRewriteRequestSuggestionType(normalizedSuggestionType),
      });
      setRewriteDraft(response);
    } catch {
      setRewriteError(getGenerateHabitRewriteErrorMessage());
    }
  }

  function handleCopyRewriteIntoFields() {
    if (!rewriteDraft) {
      return;
    }

    let copiedAnyField = false;

    if (rewriteDraft.suggestedStackTrigger) {
      setCue(stripLeadingAfter(rewriteDraft.suggestedStackTrigger));
      copiedAnyField = true;
    }

    if (rewriteDraft.suggestedTinyAction) {
      setTinyAction(rewriteDraft.suggestedTinyAction);
      copiedAnyField = true;
    }

    setRewriteCopyMessage(
      copiedAnyField
        ? "Rewrite copied into the form. Review it before saving."
        : "No field changes were suggested.",
    );
  }

  const preview = formatHabitFormula(
    normalizedPayload.cue,
    normalizedPayload.tinyAction,
  );

  if (ownedHabitQuery.isLoading) {
    return <LoadingState message="Loading habit details..." />;
  }

  if (ownedHabitQuery.error || !ownedHabitQuery.data) {
    return (
      <ScrollView
        contentContainerStyle={styles.content}
        contentInsetAdjustmentBehavior="automatic"
        style={styles.screen}
      >
        <Text selectable style={styles.title}>
          Edit Habit
        </Text>
        <ErrorState message={getLoadHabitDetailErrorMessage()} />
      </ScrollView>
    );
  }

  return (
    <ScrollView
      contentContainerStyle={styles.content}
      contentInsetAdjustmentBehavior="automatic"
      style={styles.screen}
    >
      <Text selectable style={styles.title}>
        Edit Habit
      </Text>

      {suggestionGuidance ? (
        <View style={styles.suggestionCard}>
          <Text style={styles.suggestionEyebrow}>
            Suggested adjustment
          </Text>
          <Text style={styles.suggestionTitle}>
            {suggestionGuidance.title}
          </Text>
          <Text style={styles.suggestionBody}>
            {suggestionGuidance.body}
          </Text>
          <Text style={styles.suggestionDraftLabel}>
            {suggestionGuidance.draftTitle}
          </Text>
          <Text style={styles.suggestionDraftBody}>
            {suggestionGuidance.draftBody}
          </Text>
          <Text style={styles.suggestionReasonLabel}>
            Why this suggestion
          </Text>
          <Text style={styles.suggestionReason}>
            {suggestionGuidance.reason}
          </Text>
          {FEATURE_FLAGS.aiRewrite ? (
            <>
              <Text style={styles.aiRewriteHelper}>
                AI can suggest a rewrite, but you stay in control. It will not
                change your habit unless you edit and save it.
              </Text>
              <SecondaryButton
                disabled={generateRewriteMutation.isPending}
                label={rewriteButtonLabel}
                onPress={() => void handleGenerateRewrite()}
              />
              {rewriteError ? <ErrorState message={rewriteError} /> : null}
              {rewriteDraft ? (
                <View style={styles.aiRewriteCard}>
                  <Text selectable style={styles.aiRewriteTitle}>
                    AI rewrite idea
                  </Text>
                  <Text selectable style={styles.aiRewriteLabel}>
                    Trigger
                  </Text>
                  <Text selectable style={styles.aiRewriteValue}>
                    {rewriteDraft.suggestedStackTrigger ??
                      "No trigger change suggested"}
                  </Text>
                  <Text selectable style={styles.aiRewriteLabel}>
                    Tiny action
                  </Text>
                  <Text selectable style={styles.aiRewriteValue}>
                    {rewriteDraft.suggestedTinyAction ??
                      "No tiny action change suggested"}
                  </Text>
                  <Text selectable style={styles.aiRewriteLabel}>
                    Why
                  </Text>
                  <Text selectable style={styles.aiRewriteValue}>
                    {rewriteDraft.explanation}
                  </Text>
                  <Text selectable style={styles.aiRewriteNote}>
                    Use this as inspiration. To use it, manually update the
                    fields below and save.
                  </Text>
                  {hasRewriteFieldChanges ? (
                    <SecondaryButton
                      disabled={generateRewriteMutation.isPending}
                      label="Copy into fields"
                      onPress={handleCopyRewriteIntoFields}
                    />
                  ) : (
                    <Text selectable style={styles.aiRewriteCopyMessage}>
                      No field changes to copy.
                    </Text>
                  )}
                  {rewriteCopyMessage ? (
                    <Text selectable style={styles.aiRewriteCopyMessage}>
                      {rewriteCopyMessage}
                    </Text>
                  ) : null}
                </View>
              ) : null}
            </>
          ) : null}
        </View>
      ) : null}

      <View style={styles.formCard}>
        {formError ? <ErrorState message={formError} /> : null}
        <TextField
          error={validationErrors.title}
          label="Habit name"
          onChangeText={setTitle}
          placeholder="Reading"
          value={title}
        />
        <TextField
          error={validationErrors.identityPhrase}
          label="Identity phrase"
          onChangeText={setIdentityPhrase}
          placeholder="Become someone who reads daily"
          value={identityPhrase}
        />
        <TextField
          error={validationErrors.cue}
          label="Cue"
          onChangeText={setCue}
          placeholder="After I brush my teeth"
          value={cue}
        />
        <TextField
          error={validationErrors.tinyAction}
          label="Tiny action"
          onChangeText={setTinyAction}
          placeholder="Read 1 page"
          value={tinyAction}
        />
        <TextField
          error={validationErrors.minimumViableAction}
          label="Minimum viable action (optional)"
          onChangeText={setMinimumViableAction}
          placeholder="Just open the book"
          value={minimumViableAction}
        />
        <ChoicePills
          label="Preferred time window"
          onChange={setPreferredTimeWindow}
          options={PREFERRED_TIME_WINDOW_OPTIONS}
          value={preferredTimeWindow}
        />
        {/* TODO(S15): reminder settings */}
      </View>

      <View style={styles.previewCard}>
        <Text selectable style={styles.previewLabel}>
          Preview
        </Text>
        <Text selectable style={styles.previewText}>
          {preview}
        </Text>
      </View>

      <PrimaryButton
        disabled={updateHabitMutation.isPending}
        label={updateHabitMutation.isPending ? "Saving changes..." : "Save changes"}
        onPress={() => void handleSave()}
      />
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  content: {
    gap: spacing.xl,
    padding: spacing.xl,
  },
  aiRewriteCard: {
    backgroundColor: colors.accentSoft,
    borderRadius: radius.md,
    gap: spacing.sm,
    padding: spacing.lg,
  },
  aiRewriteCopyMessage: {
    color: colors.text,
    fontSize: 13,
    fontWeight: "600",
    lineHeight: 19,
  },
  aiRewriteHelper: {
    color: colors.textMuted,
    fontSize: 14,
    lineHeight: 20,
  },
  aiRewriteLabel: {
    color: colors.accent,
    fontSize: 12,
    fontWeight: "700",
    textTransform: "uppercase",
  },
  aiRewriteNote: {
    color: colors.textMuted,
    fontSize: 13,
    lineHeight: 19,
  },
  aiRewriteTitle: {
    color: colors.text,
    fontSize: 16,
    fontWeight: "700",
  },
  aiRewriteValue: {
    color: colors.text,
    fontSize: 14,
    lineHeight: 20,
  },
  formCard: {
    backgroundColor: colors.surface,
    borderColor: colors.border,
    borderRadius: radius.lg,
    borderWidth: 1,
    gap: spacing.lg,
    padding: spacing.xl,
  },
  previewCard: {
    backgroundColor: colors.accentSoft,
    borderRadius: radius.lg,
    gap: spacing.sm,
    padding: spacing.xl,
  },
  previewLabel: {
    color: colors.accent,
    fontSize: 13,
    fontWeight: "700",
    textTransform: "uppercase",
  },
  previewText: {
    color: colors.text,
    fontSize: 18,
    fontWeight: "600",
    lineHeight: 26,
  },
  screen: {
    backgroundColor: colors.background,
    flex: 1,
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
    padding: spacing.xl,
  },
  suggestionEyebrow: {
    color: colors.textMuted,
    fontSize: 12,
    fontWeight: "700",
    textTransform: "uppercase",
  },
  suggestionDraftBody: {
    color: colors.textMuted,
    fontSize: 14,
    lineHeight: 20,
  },
  suggestionDraftLabel: {
    color: colors.text,
    fontSize: 13,
    fontWeight: "700",
    lineHeight: 20,
  },
  suggestionReason: {
    color: colors.textMuted,
    fontSize: 14,
    lineHeight: 24,
    marginBottom: spacing.xs,
  },
  suggestionReasonLabel: {
    color: colors.text,
    fontSize: 13,
    fontWeight: "700",
    lineHeight: 22,
  },
  suggestionTitle: {
    color: colors.text,
    fontSize: 18,
    fontWeight: "700",
  },
  title: {
    color: colors.text,
    fontSize: 28,
    fontWeight: "800",
  },
});
