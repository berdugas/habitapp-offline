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
import { useTheme } from "@/theme/useTheme";
import { useThemedStyles } from "@/theme/useThemedStyles";

import type { Habit } from "@/lib/db/repositories/habits";

type BacklogHabitCardProps = {
  habit: Habit;
};

export function BacklogHabitCard({ habit }: BacklogHabitCardProps) {
  const theme = useTheme();
  const styles = useThemedStyles((theme) =>
    StyleSheet.create({
      actionsRow: {
        alignItems: "center",
        flexDirection: "row",
        gap: theme.spacing.md,
        justifyContent: "space-between",
      },
      confirmButtons: {
        flexDirection: "row",
        gap: theme.spacing.md,
      },
      confirmRow: {
        gap: theme.spacing.md,
      },
      confirmText: {
        color: theme.colors.textMuted,
        fontFamily: theme.fontFamilies.body,
        fontSize: theme.typography.bodyMd,
        lineHeight: 18.6,
      },
      deleteConfirmButton: {
        paddingHorizontal: theme.spacing.md,
        paddingVertical: theme.spacing.sm,
      },
      deleteConfirmLabel: {
        color: theme.colors.danger,
        fontFamily: theme.fontFamilies.bodySemi,
        fontSize: theme.typography.bodyLg,
      },
      deleteLabel: {
        color: theme.colors.danger,
        fontFamily: theme.fontFamilies.bodySemi,
        fontSize: theme.typography.bodyMd,
      },
      deletePressable: {
        padding: theme.spacing.sm,
      },
      errorText: {
        color: theme.colors.danger,
        fontFamily: theme.fontFamilies.body,
        fontSize: theme.typography.bodyMd,
      },
      formula: {
        color: theme.colors.textMuted,
        fontFamily: theme.fontFamilies.body,
        fontSize: theme.typography.bodyMd,
        fontStyle: "italic",
      },
      goalText: {
        color: theme.colors.textFaint,
        fontFamily: theme.fontFamilies.body,
        fontSize: theme.typography.bodyMd,
      },
      saved: {
        color: theme.colors.textFaint,
        fontFamily: theme.fontFamilies.body,
        fontSize: theme.typography.micro,
      },
      title: {
        color: theme.colors.text,
        flex: 1,
        fontFamily: theme.fontFamilies.bodySemi,
        fontSize: theme.typography.titleMd,
      },
      titleRow: {
        alignItems: "center",
        flexDirection: "row",
        gap: theme.spacing.sm,
      },
    }),
  );

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
    <ZenCard gap={theme.spacing.md}>
      <View style={styles.titleRow}>
        {habit.icon ? (
          <LucideIcon
            name={habit.icon}
            size={20}
            color={theme.colors.primary}
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
