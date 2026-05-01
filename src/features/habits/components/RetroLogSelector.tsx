import { useState } from "react";
import { Modal, Pressable, StyleSheet, Text, View } from "react-native";

import { PrimaryButton } from "@/components/buttons/PrimaryButton";
import { SecondaryButton } from "@/components/buttons/SecondaryButton";
import { ErrorState } from "@/components/feedback/ErrorState";
import { RetroLogError } from "@/features/habits/api";
import { colors } from "@/theme/colors";
import { radius } from "@/theme/radius";
import { spacing } from "@/theme/spacing";
import { typography } from "@/theme/typography";
import { getRetroLogErrorMessage } from "@/utils/userFacingErrors";

import type { HabitLogStatus } from "@/features/habits/types";

type RetroLogSelectorProps = {
  canEdit: boolean;
  currentStatus: HabitLogStatus | null;
  date: string;
  isVisible: boolean;
  isPending: boolean;
  onClose: () => void;
  onSubmit: (status: HabitLogStatus) => Promise<void>;
  readOnlyReason?: "window" | "app";
};

export function RetroLogSelector({
  canEdit,
  currentStatus,
  date,
  isVisible,
  isPending,
  onClose,
  onSubmit,
  readOnlyReason,
}: RetroLogSelectorProps) {
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  async function handlePress(status: HabitLogStatus) {
    setErrorMessage(null);
    try {
      await onSubmit(status);
      onClose();
    } catch (error) {
      if (error instanceof RetroLogError) {
        setErrorMessage(getRetroLogErrorMessage(error.reason));
      } else {
        setErrorMessage("Something went wrong. Try again.");
      }
    }
  }

  function handleClose() {
    setErrorMessage(null);
    onClose();
  }

  return (
    <Modal
      animationType="fade"
      onRequestClose={handleClose}
      transparent
      visible={isVisible}
    >
      <Pressable accessibilityLabel="Close selector" onPress={handleClose} style={styles.backdrop}>
        <Pressable onPress={() => undefined} style={styles.card}>
          <Text selectable style={styles.dateLabel}>
            {formatDateLabel(date)}
          </Text>
          {currentStatus ? (
            <Text selectable style={styles.statusLabel}>
              Currently {currentStatus}
            </Text>
          ) : null}
          {errorMessage ? <ErrorState message={errorMessage} /> : null}
          {canEdit ? (
            <View style={styles.actionsRow}>
              <PrimaryButton
                disabled={isPending}
                label={currentStatus === "done" ? "Done ✓" : "Done"}
                onPress={() => void handlePress("done")}
              />
              <SecondaryButton
                disabled={isPending}
                label={currentStatus === "skipped" ? "Skipped ✓" : "Skip"}
                onPress={() => void handlePress("skipped")}
              />
            </View>
          ) : (
            <Text selectable style={styles.lockedText}>
              {readOnlyReason === "app"
                ? "Reconnect to log on this day."
                : "This day is locked. Logs older than 48 hours can't be changed."}
            </Text>
          )}
          <SecondaryButton label="Close" onPress={handleClose} />
        </Pressable>
      </Pressable>
    </Modal>
  );
}

function formatDateLabel(date: string) {
  return new Date(`${date}T12:00:00`).toLocaleDateString(undefined, {
    day: "numeric",
    month: "long",
    weekday: "long",
    year: "numeric",
  });
}

const styles = StyleSheet.create({
  actionsRow: {
    flexDirection: "row",
    gap: spacing.md,
  },
  backdrop: {
    alignItems: "center",
    backgroundColor: "rgba(0, 0, 0, 0.4)",
    flex: 1,
    justifyContent: "center",
    padding: spacing.xl,
  },
  card: {
    backgroundColor: colors.surface,
    borderRadius: radius.lg,
    gap: spacing.lg,
    padding: spacing.xl,
    width: "100%",
  },
  dateLabel: {
    color: colors.text,
    fontSize: typography.title,
    fontWeight: "700",
  },
  lockedText: {
    color: colors.textMuted,
    fontSize: typography.body,
    lineHeight: 22,
  },
  statusLabel: {
    color: colors.textMuted,
    fontSize: typography.body,
    fontStyle: "italic",
  },
});
