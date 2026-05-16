import { useState } from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";

import { LucideIcon } from "@/components/LucideIconPicker";
import { PrimaryButton } from "@/components/buttons/PrimaryButton";
import { SecondaryButton } from "@/components/buttons/SecondaryButton";
import { ZenCard } from "@/components/cards/ZenCard";
import { CapWarningCard } from "@/features/habits/components/CapWarningCard";
import { formatHabitFormula } from "@/features/habits/formatters";
import {
  useActivateBacklogHabitMutation,
  useDeleteHabitMutation,
} from "@/features/habits/hooks";
import { assertCanCreateActiveHabit } from "@/features/habits/validators";
import { useAuthSession } from "@/features/auth/hooks";
import { formatExactDate } from "@/features/library/metrics";
import { colors } from "@/theme/colors";
import { fontFamilies } from "@/theme/fontFamilies";
import { spacing } from "@/theme/spacing";
import { typography } from "@/theme/typography";

import type { Habit } from "@/lib/db/repositories/habits";

type BacklogHabitCardProps = {
  habit: Habit;
};

export function BacklogHabitCard({ habit }: BacklogHabitCardProps) {
  const { user } = useAuthSession();
  const [confirmingDelete, setConfirmingDelete] = useState(false);
  const [capCount, setCapCount] = useState<number | null>(null);
  const activateMutation = useActivateBacklogHabitMutation();
  const deleteMutation = useDeleteHabitMutation();

  const formula = formatHabitFormula(habit.cue, habit.tiny_action);
  const savedAt = habit.backlog_at ?? habit.created_at;

  async function handleActivatePress() {
    if (!user?.id) return;
    // If the cap warning has already been shown, the next tap proceeds.
    if (capCount !== null) {
      activateMutation.mutate({ habitId: habit.id });
      return;
    }
    // Goalless habits skip the cap check — assertCanCreateActiveHabit does a
    // strict === comparison and would silently bypass against null phrases.
    if (!habit.identity_phrase) {
      activateMutation.mutate({ habitId: habit.id });
      return;
    }
    const result = await assertCanCreateActiveHabit(user.id, habit.identity_phrase);
    if (result.ok) {
      activateMutation.mutate({ habitId: habit.id });
    } else {
      setCapCount(result.count);
    }
  }

  function handleDeletePress() {
    setConfirmingDelete(true);
  }

  function handleConfirmDelete() {
    deleteMutation.mutate({ habitId: habit.id });
  }

  const activateLabel = activateMutation.isPending
    ? "Activating..."
    : capCount !== null
    ? "Activate anyway"
    : "Activate";

  return (
    <ZenCard gap={spacing.md}>
      <View style={styles.titleRow}>
        {habit.icon ? (
          <LucideIcon
            name={habit.icon}
            size={20}
            color={colors.primary}
            strokeWidth={1.75}
          />
        ) : null}
        <Text style={styles.title}>{habit.title}</Text>
      </View>

      {habit.identity_phrase ? (
        <Text style={styles.goalText}>For: Become {habit.identity_phrase}</Text>
      ) : null}

      <Text style={styles.formula}>{formula}</Text>

      <Text style={styles.saved}>Saved {formatExactDate(savedAt)}</Text>

      {capCount !== null ? <CapWarningCard count={capCount} /> : null}

      {confirmingDelete ? (
        <View style={styles.confirmRow}>
          <Text style={styles.confirmText}>
            This will permanently remove this habit idea. This can&apos;t be undone.
          </Text>
          <View style={styles.confirmButtons}>
            <SecondaryButton
              label="Cancel"
              onPress={() => setConfirmingDelete(false)}
              disabled={deleteMutation.isPending}
            />
            <Pressable
              accessibilityRole="button"
              disabled={deleteMutation.isPending}
              onPress={handleConfirmDelete}
              style={styles.deleteConfirmButton}
            >
              <Text style={styles.deleteConfirmLabel}>
                {deleteMutation.isPending ? "Deleting..." : "Delete"}
              </Text>
            </Pressable>
          </View>
        </View>
      ) : (
        <View style={styles.actionsRow}>
          <PrimaryButton
            label={activateLabel}
            onPress={handleActivatePress}
            disabled={activateMutation.isPending}
          />
          <Pressable
            accessibilityRole="button"
            disabled={activateMutation.isPending}
            onPress={handleDeletePress}
            style={styles.deletePressable}
          >
            <Text style={styles.deleteLabel}>Delete</Text>
          </Pressable>
        </View>
      )}

      {activateMutation.isError ? (
        <Text style={styles.errorText}>
          Couldn&apos;t activate this habit. Please try again.
        </Text>
      ) : null}
      {deleteMutation.isError ? (
        <Text style={styles.errorText}>
          Couldn&apos;t delete this habit. Please try again.
        </Text>
      ) : null}
    </ZenCard>
  );
}

const styles = StyleSheet.create({
  actionsRow: {
    alignItems: "center",
    flexDirection: "row",
    gap: spacing.md,
    justifyContent: "space-between",
  },
  confirmButtons: {
    flexDirection: "row",
    gap: spacing.md,
  },
  confirmRow: {
    gap: spacing.md,
  },
  confirmText: {
    color: colors.textMuted,
    fontFamily: fontFamilies.body,
    fontSize: typography.bodyMd,
    lineHeight: 20,
  },
  deleteConfirmButton: {
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
  },
  deleteConfirmLabel: {
    color: colors.danger,
    fontFamily: fontFamilies.bodySemi,
    fontSize: typography.bodyLg,
  },
  deleteLabel: {
    color: colors.danger,
    fontFamily: fontFamilies.bodySemi,
    fontSize: typography.bodyMd,
  },
  deletePressable: {
    padding: spacing.sm,
  },
  errorText: {
    color: colors.danger,
    fontFamily: fontFamilies.body,
    fontSize: typography.bodyMd,
  },
  formula: {
    color: colors.textMuted,
    fontFamily: fontFamilies.body,
    fontSize: typography.bodyMd,
    fontStyle: "italic",
  },
  goalText: {
    color: colors.textFaint,
    fontFamily: fontFamilies.body,
    fontSize: typography.bodyMd,
  },
  saved: {
    color: colors.textFaint,
    fontFamily: fontFamilies.body,
    fontSize: typography.micro,
  },
  title: {
    color: colors.text,
    flex: 1,
    fontFamily: fontFamilies.bodySemi,
    fontSize: typography.titleMd,
  },
  titleRow: {
    alignItems: "center",
    flexDirection: "row",
    gap: spacing.sm,
  },
});
