import { useEffect, useMemo, useRef, useState } from "react";
import { Pressable, ScrollView, StyleSheet, Text, TextInput, View } from "react-native";
import { router, useLocalSearchParams } from "expo-router";

import { LucideIcon, LucideIconPicker } from "@/components/LucideIconPicker";
import { PrimaryButton } from "@/components/buttons/PrimaryButton";
import { ReadOnlyBanner } from "@/components/ReadOnlyBanner";
import { ZenCard } from "@/components/cards/ZenCard";
import { ErrorState } from "@/components/feedback/ErrorState";
import { LoadingState } from "@/components/feedback/LoadingState";
import { ActiveDaysPicker } from "@/components/forms/ActiveDaysPicker";
import { ChoicePills } from "@/components/forms/ChoicePills";
import { TextField } from "@/components/forms/TextField";
import { Eyebrow } from "@/components/text/Eyebrow";
import {
  useOwnedHabitQuery,
  useUpdateHabitMutation,
} from "@/features/habits/hooks";
import { parseActiveDays, ALL_DAYS } from "@/features/habits/activeDays";
import { rescheduleAll } from "@/features/reminders/notifications";
import { formatHabitFormula } from "@/features/habits/formatters";
import { useAuthSession } from "@/features/auth/hooks";
import { PREFERRED_TIME_WINDOW_OPTIONS } from "@/features/habits/preferredTimeWindows";
import {
  normalizeHabitSetupPayload,
  validateHabitSetupPayload,
} from "@/features/habits/validators";
import { getHabitSuggestionEditGuidance } from "@/features/recommendations/editGuidance";
import { useTrialValidation } from "@/features/trial/hooks";
import { colors } from "@/theme/colors";
import { fontFamilies } from "@/theme/fontFamilies";
import { spacing } from "@/theme/spacing";
import { typography } from "@/theme/typography";
import {
  getLoadHabitDetailErrorMessage,
  getUpdateHabitErrorMessage,
} from "@/utils/userFacingErrors";

export default function EditHabitScreen() {
  const { user } = useAuthSession();
  const { habitId, suggestionType, from } = useLocalSearchParams<{
    habitId?: string | string[];
    suggestionType?: string | string[];
    from?: string | string[];
  }>();
  const fromRecovery =
    (Array.isArray(from) ? from[0] : from) === "recovery";
  const ownedHabitQuery = useOwnedHabitQuery(habitId);
  const updateHabitMutation = useUpdateHabitMutation();
  const { accessMode, isValidating, refresh } = useTrialValidation();
  const isReadOnly = accessMode === "read_only";
  const hasHydratedFormRef = useRef(false);
  const submitLockRef = useRef(false);
  const tinyActionRef = useRef<TextInput>(null);
  const suggestionGuidance = getHabitSuggestionEditGuidance(suggestionType);

  const [title, setTitle] = useState("");
  const [identityPhrase, setIdentityPhrase] = useState("");
  const [cue, setCue] = useState("");
  const [tinyAction, setTinyAction] = useState("");
  const [minimumViableAction, setMinimumViableAction] = useState("");
  const [preferredTimeWindow, setPreferredTimeWindow] = useState("");
  const [icon, setIcon] = useState("");
  const [activeDays, setActiveDays] = useState<number[]>(ALL_DAYS);
  const [showPicker, setShowPicker] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);

  const formPayload = {
    title,
    identityPhrase,
    cue,
    tinyAction,
    minimumViableAction,
    preferredTimeWindow,
    icon,
    activeDays,
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
    setIcon(ownedHabitQuery.data.icon ?? "");
    setActiveDays(parseActiveDays(ownedHabitQuery.data.active_days));
    hasHydratedFormRef.current = true;

    if (fromRecovery) {
      // Give the layout a tick to settle before pulling up the keyboard.
      setTimeout(() => {
        tinyActionRef.current?.focus();
      }, 0);
    }
  }, [ownedHabitQuery.data, fromRecovery]);

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
      // Reschedule reminder if active days changed
      if (user?.id) {
        await rescheduleAll(user.id).catch(() => {});
      }
      router.replace(`/(app)/habits/${ownedHabitQuery.data.id}`);
    } catch {
      setFormError(getUpdateHabitErrorMessage());
    } finally {
      submitLockRef.current = false;
    }
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
      {isReadOnly ? (
        <ReadOnlyBanner
          isReconnecting={isValidating}
          onReconnect={() => void refresh()}
        />
      ) : null}
      <Text selectable style={styles.title}>
        Edit Habit
      </Text>

      {suggestionGuidance ? (
        <ZenCard gap={spacing.sm}>
          <Eyebrow label="Suggested adjustment" />
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
        </ZenCard>
      ) : null}

      <ZenCard gap={spacing.lg}>
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
          ref={tinyActionRef}
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
        <ActiveDaysPicker
          value={activeDays}
          disabled={isReadOnly}
          onChange={setActiveDays}
        />
        <View style={styles.iconRow}>
          <Text style={styles.iconLabel}>Icon</Text>
          <Pressable
            onPress={() => setShowPicker((v) => !v)}
            style={styles.iconCircle}
          >
            <LucideIcon
              name={icon || "Sparkles"}
              size={20}
              color={icon ? colors.primary : colors.textFaint}
              strokeWidth={1.8}
            />
          </Pressable>
        </View>
        {showPicker ? (
          <LucideIconPicker
            selected={icon || null}
            onSelect={(name) => {
              setIcon(name);
              setShowPicker(false);
            }}
          />
        ) : null}
        {/* TODO(S15): reminder settings */}
      </ZenCard>

      <ZenCard gap={spacing.sm}>
        <Eyebrow label="Preview" tone="primary" />
        <Text selectable style={styles.previewText}>
          {preview}
        </Text>
      </ZenCard>

      <PrimaryButton
        disabled={updateHabitMutation.isPending || isReadOnly}
        label={updateHabitMutation.isPending ? "Saving changes..." : "Save changes"}
        onPress={() => void handleSave()}
      />
      {isReadOnly ? (
        <Text selectable style={styles.readOnlyHelper}>
          Reconnect to edit habits.
        </Text>
      ) : null}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  content: {
    gap: spacing.xl,
    padding: spacing.xl,
  },
  previewText: {
    color: colors.text,
    fontFamily: fontFamilies.bodySemi,
    fontSize: 18,
    lineHeight: 26,
  },
  screen: {
    backgroundColor: colors.bg,
    flex: 1,
  },
  suggestionBody: {
    color: colors.textMuted,
    fontFamily: fontFamilies.body,
    fontSize: 14,
    lineHeight: 20,
  },
  suggestionDraftBody: {
    color: colors.textMuted,
    fontFamily: fontFamilies.body,
    fontSize: 14,
    lineHeight: 20,
  },
  suggestionDraftLabel: {
    color: colors.text,
    fontFamily: fontFamilies.bodySemi,
    fontSize: 13,
    lineHeight: 20,
  },
  suggestionReason: {
    color: colors.textMuted,
    fontFamily: fontFamilies.body,
    fontSize: 14,
    lineHeight: 24,
    marginBottom: spacing.xs,
  },
  suggestionReasonLabel: {
    color: colors.text,
    fontFamily: fontFamilies.bodySemi,
    fontSize: 13,
    lineHeight: 22,
  },
  suggestionTitle: {
    color: colors.text,
    fontFamily: fontFamilies.displaySemi,
    fontSize: typography.headlineMd,
  },
  title: {
    color: colors.text,
    fontFamily: fontFamilies.displaySemi,
    fontSize: typography.headlineMd,
  },
  readOnlyHelper: {
    color: colors.textMuted,
    fontFamily: fontFamilies.body,
    fontSize: 14,
    lineHeight: 20,
    textAlign: "center",
  },
  iconRow: {
    alignItems: "center",
    flexDirection: "row",
    justifyContent: "space-between",
  },
  iconLabel: {
    color: colors.textMuted,
    fontFamily: fontFamilies.bodyMedium,
    fontSize: 13,
  },
  iconCircle: {
    alignItems: "center",
    backgroundColor: colors.surface,
    borderRadius: 20,
    height: 40,
    justifyContent: "center",
    width: 40,
  },
});
