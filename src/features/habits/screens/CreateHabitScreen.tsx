import { useMemo, useRef, useState } from "react";
import { ScrollView, StyleSheet, Text, View } from "react-native";
import { router } from "expo-router";
import { useQueryClient } from "@tanstack/react-query";

import { PrimaryButton } from "@/components/buttons/PrimaryButton";
import { SecondaryButton } from "@/components/buttons/SecondaryButton";
import { HabitCard } from "@/components/cards/HabitCard";
import { EmptyState } from "@/components/feedback/EmptyState";
import { ErrorState } from "@/components/feedback/ErrorState";
import { ChoicePills } from "@/components/forms/ChoicePills";
import { TextField } from "@/components/forms/TextField";
import { useAuthSession } from "@/features/auth/hooks";
import { listEligibleHabitsForToday } from "@/features/habits/api";
import { ReadOnlyBanner } from "@/components/ReadOnlyBanner";
import { useTrialValidation } from "@/features/trial/hooks";
import {
  getEligibleHabitsQueryKey,
  useCreateHabitMutation,
  useInactiveHabitsQuery,
} from "@/features/habits/hooks";
import { formatHabitFormula } from "@/features/habits/formatters";
import { PREFERRED_TIME_WINDOW_OPTIONS } from "@/features/habits/preferredTimeWindows";
import { logger } from "@/services/logger";
import {
  normalizeHabitSetupPayload,
  validateHabitSetupPayload,
} from "@/features/habits/validators";
import { colors } from "@/theme/colors";
import { radius } from "@/theme/radius";
import { spacing } from "@/theme/spacing";
import { toDeviceDateString } from "@/utils/dates";
import {
  getCreateHabitErrorMessage,
} from "@/utils/userFacingErrors";

export default function CreateHabitScreen() {
  const [title, setTitle] = useState("");
  const [identityPhrase, setIdentityPhrase] = useState("");
  const [cue, setCue] = useState("");
  const [tinyAction, setTinyAction] = useState("");
  const [minimumViableAction, setMinimumViableAction] = useState("");
  const [preferredTimeWindow, setPreferredTimeWindow] = useState("");
  const [formError, setFormError] = useState<string | null>(null);
  const submitLockRef = useRef(false);

  const { user } = useAuthSession();
  const queryClient = useQueryClient();
  const createHabitMutation = useCreateHabitMutation();
  const { accessMode, isValidating, refresh } = useTrialValidation();
  const isReadOnly = accessMode === "read_only";
  const inactiveHabitsQuery = useInactiveHabitsQuery();

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

  async function handleSave() {
    if (submitLockRef.current || createHabitMutation.isPending) {
      return;
    }

    setFormError(null);

    if (Object.keys(validationErrors).length > 0) {
      setFormError("Fill in the required fields before saving.");
      return;
    }

    submitLockRef.current = true;
    let hasSavedHabit = false;

    try {
      await createHabitMutation.mutateAsync({ ...normalizedPayload, habitState: "focus" });
      hasSavedHabit = true;
      if (!user?.id) {
        throw new Error("We could not refresh your habit list right now.");
      }

      const todayDate = toDeviceDateString();
      const queryKey = getEligibleHabitsQueryKey(user.id, todayDate);

      await queryClient.invalidateQueries({ queryKey });
      await queryClient.fetchQuery({
        queryFn: () => listEligibleHabitsForToday(user.id, todayDate),
        queryKey,
      });
      router.replace("/(app)/(tabs)/today");
    } catch (error) {
      if (hasSavedHabit) {
        logger.warn("Eligible habits refresh failed after successful create", {
          error,
          payload: normalizedPayload,
          userId: user?.id ?? null,
        });
        router.replace("/(app)/(tabs)/today");
      } else {
        logger.error("Create habit flow failed", {
          error,
          payload: normalizedPayload,
          userId: user?.id ?? null,
        });
        setFormError(getCreateHabitErrorMessage());
      }
    } finally {
      submitLockRef.current = false;
    }
  }

  const preview = formatHabitFormula(cue, tinyAction);

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
      <View style={styles.header}>
        <Text selectable style={styles.title}>
          {inactiveHabitsQuery.data?.length
            ? "Create a habit"
            : "Create your first habit"}
        </Text>
        <Text selectable style={styles.body}>
          {inactiveHabitsQuery.data?.length
            ? "Keep it concrete, small, and easy to repeat. You can also reopen an inactive habit below."
            : "Keep it concrete, small, and easy to repeat."}
        </Text>
      </View>

      {inactiveHabitsQuery.data?.length ? (
        <View style={styles.inactiveSection}>
          <EmptyState
            body="Inactive habits stay out of Today until you reactivate them."
            title="You already have inactive habits"
          />
          {inactiveHabitsQuery.data.map((habit) => (
            <HabitCard
              formula={formatHabitFormula(
                habit.cue,
                habit.tiny_action,
              )}
              key={habit.id}
              metaText="Inactive habit"
              name={habit.title}
              onPress={() => router.push(`/(app)/habits/${habit.id}`)}
            />
          ))}
          <SecondaryButton
            label="Open Settings"
            onPress={() => router.push("/(app)/(tabs)/settings")}
          />
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
        disabled={createHabitMutation.isPending || isReadOnly}
        label={createHabitMutation.isPending ? "Saving habit..." : "Save Habit"}
        onPress={handleSave}
      />
      {isReadOnly ? (
        <Text selectable style={styles.readOnlyHelper}>
          Reconnect to create new habits.
        </Text>
      ) : null}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  body: {
    color: colors.textMuted,
    fontSize: 16,
    lineHeight: 24,
  },
  content: {
    gap: spacing.xl,
    padding: spacing.xl,
  },
  formCard: {
    backgroundColor: colors.surface,
    borderColor: 'transparent',
    borderRadius: radius.lg,
    borderWidth: 1,
    gap: spacing.lg,
    padding: spacing.xl,
  },
  header: {
    gap: spacing.sm,
  },
  inactiveSection: {
    gap: spacing.lg,
  },
  previewCard: {
    backgroundColor: colors.primarySoft,
    borderRadius: radius.lg,
    gap: spacing.sm,
    padding: spacing.xl,
  },
  previewLabel: {
    color: colors.primary,
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
    backgroundColor: colors.bg,
    flex: 1,
  },
  title: {
    color: colors.text,
    fontSize: 28,
    fontWeight: "800",
  },
  readOnlyHelper: {
    color: colors.textMuted,
    fontSize: 14,
    lineHeight: 20,
    textAlign: "center",
  },
});
