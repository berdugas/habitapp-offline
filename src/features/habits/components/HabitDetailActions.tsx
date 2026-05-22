import { StyleSheet, View } from "react-native";

import { SecondaryButton } from "@/components/buttons/SecondaryButton";
import { ErrorState } from "@/components/feedback/ErrorState";
import { getUpdateHabitActiveStateErrorMessage } from "@/utils/userFacingErrors";
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
  onArchivePress: () => void;
  onBackPress: () => void;
};

export function HabitDetailActions({
  habit,
  isReadOnly,
  archivePending,
  archiveIntroLoading,
  archiveError,
  onArchivePress,
  onBackPress,
}: Props) {
  return (
    <View style={styles.actions}>
      {archiveError ? (
        <ErrorState message={getUpdateHabitActiveStateErrorMessage()} />
      ) : null}
      {habit.status === "active" ? (
        <SecondaryButton
          disabled={archivePending || isReadOnly || archiveIntroLoading}
          label="Archive habit"
          onPress={onArchivePress}
        />
      ) : habit.status === "backlog" ? (
        <SecondaryButton label="Back to Backlog" onPress={onBackPress} />
      ) : null}
      {/* status === "archived" renders null: the post-archive cache
          invalidation flips status to "archived" one paint before the
          imperative router.replace fires. Rendering null here avoids a
          brief "Back to Backlog" flicker between the re-render and the
          navigation. The screen-level redirect effect also handles the
          stale-deep-link case for archived habits. */}
    </View>
  );
}

const styles = StyleSheet.create({
  actions: {
    gap: spacing.md,
  },
});
