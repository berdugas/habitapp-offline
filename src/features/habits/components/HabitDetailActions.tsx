import { StyleSheet, View } from "react-native";

import { SecondaryButton } from "@/components/buttons/SecondaryButton";
import { ErrorState } from "@/components/feedback/ErrorState";
import { getUpdateHabitActiveStateErrorMessage } from "@/utils/userFacingErrors";
import { useThemedStyles } from "@/theme/useThemedStyles";
import { paywallCopy } from "@/features/paywall/copy";

import type { HabitRecord } from "@/features/habits/types";

type Props = {
  habit: HabitRecord;
  isReadOnly: boolean;
  isFreeTierLocked: boolean;
  archivePending: boolean;
  // True while the archive-intro preference read is still in flight. The
  // Archive button must be disabled in this window so a fast user can't
  // trigger an archive before we know whether to redirect to Backlog.
  archiveIntroLoading: boolean;
  archiveError: boolean;
  onArchivePress: () => void;
  onUnlockArchive: () => void;
  onBackPress: () => void;
};

export function HabitDetailActions({
  habit,
  isReadOnly,
  isFreeTierLocked,
  archivePending,
  archiveIntroLoading,
  archiveError,
  onArchivePress,
  onUnlockArchive,
  onBackPress,
}: Props) {
  const styles = useThemedStyles((theme) =>
    StyleSheet.create({
      actions: {
        gap: theme.spacing.md,
      },
    }),
  );

  return (
    <View style={styles.actions}>
      {archiveError ? (
        <ErrorState message={getUpdateHabitActiveStateErrorMessage()} />
      ) : null}
      {habit.status === "active" ? (
        isFreeTierLocked ? (
          <SecondaryButton
            label={paywallCopy.unlockToArchive}
            onPress={onUnlockArchive}
          />
        ) : (
          <SecondaryButton
            disabled={archivePending || isReadOnly || archiveIntroLoading}
            label="Archive habit"
            onPress={onArchivePress}
          />
        )
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
