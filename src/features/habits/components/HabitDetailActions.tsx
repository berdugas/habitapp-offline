import { StyleSheet, Text, View } from "react-native";

import { SecondaryButton } from "@/components/buttons/SecondaryButton";
import { DangerZone } from "@/components/sections/DangerZone";
import { ErrorState } from "@/components/feedback/ErrorState";
import {
  getDeleteHabitErrorMessage,
  getUpdateHabitActiveStateErrorMessage,
} from "@/utils/userFacingErrors";
import { colors } from "@/theme/colors";
import { fontFamilies } from "@/theme/fontFamilies";
import { spacing } from "@/theme/spacing";

import type { HabitRecord } from "@/features/habits/types";

type Props = {
  habit: HabitRecord;
  isReadOnly: boolean;
  archivePending: boolean;
  // True while the archive-intro preference read is still in flight. The
  // Archive button must be disabled in this window so a fast user can't
  // trigger an archive before we know whether to redirect to Backlog.
  archiveIntroLoading: boolean;
  archiveError: boolean;
  deletePending: boolean;
  deleteError: boolean;
  onArchivePress: () => void;
  onDeletePress: () => void;
  onBackPress: () => void;
};

export function HabitDetailActions({
  habit,
  isReadOnly,
  archivePending,
  archiveIntroLoading,
  archiveError,
  deletePending,
  deleteError,
  onArchivePress,
  onDeletePress,
  onBackPress,
}: Props) {
  const isActive = habit.status === "active";

  return (
    <>
      <View style={styles.actions}>
        {archiveError ? (
          <ErrorState message={getUpdateHabitActiveStateErrorMessage()} />
        ) : null}
        {isActive ? (
          <>
            <View style={styles.actionHelperCard}>
              <Text selectable style={styles.actionHelperTitle}>
                Archive habit
              </Text>
              <Text selectable style={styles.actionHelperBody}>
                This removes the habit from Today, but keeps its history.
              </Text>
            </View>
            <SecondaryButton
              disabled={archivePending || isReadOnly || archiveIntroLoading}
              label="Archive habit"
              onPress={onArchivePress}
            />
            <SecondaryButton label="Back to Today" onPress={onBackPress} />
          </>
        ) : (
          <>
            <View style={styles.actionHelperCard}>
              <Text selectable style={styles.actionHelperTitle}>
                Archived
              </Text>
              <Text selectable style={styles.actionHelperBody}>
                This habit is archived. Reactivation coming in a future release.
              </Text>
            </View>
            <SecondaryButton label="Back to Archive" onPress={onBackPress} />
          </>
        )}
      </View>

      {/* Danger zone — permanent delete. Available on BOTH active and archived
          habits per sprint-19c-tickets.md S19c-02 product rule #4. Styled as a
          danger section (tinted card + eyebrow + body) per product rule #1. */}
      <View style={styles.dangerZoneContainer}>
        <DangerZone
          title="Delete habit"
          body="Permanently removes this habit and all its history — logs, reviews, reminders. This cannot be undone."
          buttonLabel="Delete habit"
          disabled={isReadOnly}
          isPending={deletePending}
          onPress={onDeletePress}
        />
        {deleteError ? (
          <ErrorState message={getDeleteHabitErrorMessage()} />
        ) : null}
      </View>
    </>
  );
}

const styles = StyleSheet.create({
  actionHelperBody: {
    color: colors.textMuted,
    fontFamily: fontFamilies.body,
    fontSize: 14,
    lineHeight: 20,
  },
  actionHelperCard: {
    backgroundColor: colors.surface,
    borderRadius: 12,
    gap: spacing.xs,
    padding: spacing.lg,
  },
  actionHelperTitle: {
    color: colors.text,
    fontFamily: fontFamilies.bodySemi,
    fontSize: 16,
  },
  actions: {
    gap: spacing.md,
  },
  dangerZoneContainer: {
    gap: spacing.sm,
  },
});
