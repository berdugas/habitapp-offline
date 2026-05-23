import { useState } from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";

import { PrimaryButton } from "@/components/buttons/PrimaryButton";
import { ErrorState } from "@/components/feedback/ErrorState";
import { TextField } from "@/components/forms/TextField";
import { Eyebrow } from "@/components/text/Eyebrow";
import { colors } from "@/theme/colors";
import { fontFamilies } from "@/theme/fontFamilies";
import { spacing } from "@/theme/spacing";
import { typography } from "@/theme/typography";

/**
 * Reflection step shown only on clean weeks (zero struggling habits).
 *
 * The per-habit Tune-Up loop is the natural place to capture
 * intentions for a struggling habit. On an all-strong week, there
 * are no Tune-Ups to render — without this step, the user would
 * jump straight from "What's working" to "Done" with no chance to
 * set an intention for the coming week. This step inserts a single
 * optional free-text beat between What's Working and Complete.
 *
 * Save writes the user's text to a `weekly_reviews` row for every
 * habit in the goal (via `useUpsertGoalReviewsMutation`); Skip
 * advances without writes — the Complete-step catch-up effect
 * handles the empty-row backfill in that case.
 */
type GoalReflectionStepProps = {
  /** Decoded identity phrase from the goal. Rendered inline in the
   * headline so the prompt feels personal ("…to keep a reader going?"
   * rather than a generic "this week"). */
  identityPhrase: string;
  /** Called when the user taps Save & continue. Parent handles the
   * batch write (one `weekly_reviews` row per habit), then advances
   * the step on success. Receives the raw input value — the parent
   * trims before persisting. */
  onSave: (text: string) => Promise<void>;
  /** Called when the user taps Skip. Parent advances without writes;
   * Complete-step catch-up fills empty rows. */
  onSkip: () => void;
  /** Called the first time the user touches the text field. Parent
   * marks the step as dirty for the chevron-back / `beforeRemove`
   * exit guard. Safe to call repeatedly. */
  onInteraction: () => void;
};

export function GoalReflectionStep({
  identityPhrase,
  onSave,
  onSkip,
  onInteraction,
}: GoalReflectionStepProps) {
  const [text, setText] = useState("");
  const [isSaving, setIsSaving] = useState(false);
  const [saveError, setSaveError] = useState(false);

  function handleChangeText(next: string) {
    setText(next);
    onInteraction();
  }

  async function handleSavePress() {
    if (isSaving) return;
    setSaveError(false);
    setIsSaving(true);
    try {
      await onSave(text);
      // Parent advances the step on resolve; this component unmounts
      // before reaching the finally cleanup, but we keep the guard
      // for safety against an awaited parent that doesn't navigate.
    } catch {
      // Parent already logged; surface a retry banner inline.
      setSaveError(true);
    } finally {
      setIsSaving(false);
    }
  }

  function handleSkipPress() {
    if (isSaving) return;
    onSkip();
  }

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <Eyebrow label="Reflection" tone="primary" />
        <Text style={styles.headline}>
          Anything you want to try this week to keep{" "}
          <Text style={styles.identityPhrase}>{identityPhrase}</Text> going?
        </Text>
        <Text style={styles.body}>
          Optional — leave it blank if nothing comes to mind.
        </Text>
      </View>

      <TextField
        disabled={isSaving}
        label="A small experiment for the week"
        multiline
        onChangeText={handleChangeText}
        placeholder="e.g. anchor the habit to morning coffee"
        value={text}
      />

      <Pressable
        accessibilityLabel="Skip reflection"
        accessibilityRole="button"
        disabled={isSaving}
        onPress={handleSkipPress}
        style={styles.skipButton}
      >
        <Text style={styles.skipLabel}>Skip</Text>
      </Pressable>

      {saveError ? (
        <ErrorState message="We couldn't save your reflection. Try again." />
      ) : null}

      <PrimaryButton
        label={isSaving ? "Saving…" : saveError ? "Retry" : "Save & continue"}
        onPress={() => void handleSavePress()}
        showArrow
      />
    </View>
  );
}

const styles = StyleSheet.create({
  body: {
    color: colors.textMuted,
    fontFamily: fontFamilies.body,
    fontSize: typography.bodyMd,
    lineHeight: 20,
  },
  container: {
    gap: spacing.lg,
  },
  header: {
    gap: spacing.sm,
  },
  headline: {
    color: colors.text,
    fontFamily: fontFamilies.displayBold,
    fontSize: typography.headlineMd,
    letterSpacing: -0.2,
    lineHeight: 30,
  },
  identityPhrase: {
    color: colors.primaryGradientEnd,
    fontFamily: fontFamilies.displaySemiItalic,
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
});
