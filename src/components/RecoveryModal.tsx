import { Modal, Pressable, StyleSheet, Text, View } from "react-native";

import { colors } from "@/theme/colors";
import { radius } from "@/theme/radius";
import { spacing } from "@/theme/spacing";
import { typography } from "@/theme/typography";

type RecoveryModalProps = {
  visible: boolean;
  habitTitle: string;
  onRestart: () => void;
  onMakeItSmaller: () => void;
  onPauseForNow: () => void;
  onClose: () => void;
};

export function RecoveryModal({
  visible,
  habitTitle,
  onRestart,
  onMakeItSmaller,
  onPauseForNow,
  onClose,
}: RecoveryModalProps) {
  return (
    <Modal animationType="fade" transparent visible={visible}>
      <View style={styles.overlay}>
        <View style={styles.sheet}>
          <Text selectable style={styles.habitTitle}>
            {habitTitle}
          </Text>
          <Text selectable style={styles.body}>
            The habit lost some momentum. That happens to everyone — what
            matters now is what you do next.
          </Text>
          <Text selectable style={styles.prompt}>
            What would you like to do?
          </Text>

          <View style={styles.actions}>
            <Pressable
              accessibilityRole="button"
              onPress={onRestart}
              style={({ pressed }) => [
                styles.actionButton,
                pressed && styles.actionButtonPressed,
              ]}
            >
              <Text selectable style={styles.actionLabel}>
                Restart as-is
              </Text>
              <Text selectable style={styles.actionHint}>
                Continue with the same habit. Streak resets to 0.
              </Text>
            </Pressable>

            <Pressable
              accessibilityRole="button"
              onPress={onMakeItSmaller}
              style={({ pressed }) => [
                styles.actionButton,
                pressed && styles.actionButtonPressed,
              ]}
            >
              <Text selectable style={styles.actionLabel}>
                Make it smaller
              </Text>
              <Text selectable style={styles.actionHint}>
                Edit the tiny action to something easier.
              </Text>
            </Pressable>

            <Pressable
              accessibilityRole="button"
              onPress={onPauseForNow}
              style={({ pressed }) => [
                styles.actionButton,
                pressed && styles.actionButtonPressed,
              ]}
            >
              <Text selectable style={styles.actionLabel}>
                Pause for now
              </Text>
              <Text selectable style={styles.actionHint}>
                Archive the habit. History is preserved.
              </Text>
            </Pressable>
          </View>

          <Pressable
            accessibilityRole="button"
            onPress={onClose}
            style={styles.closeLink}
          >
            <Text selectable style={styles.closeLinkText}>
              Just close
            </Text>
          </Pressable>
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  actionButton: {
    backgroundColor: colors.surface,
    borderColor: colors.border,
    borderRadius: radius.md,
    borderWidth: 1,
    gap: spacing.xs,
    padding: spacing.lg,
  },
  actionButtonPressed: {
    backgroundColor: colors.surfaceMuted,
  },
  actionHint: {
    color: colors.textMuted,
    fontSize: 13,
    lineHeight: 18,
  },
  actionLabel: {
    color: colors.text,
    fontSize: 16,
    fontWeight: "600",
  },
  actions: {
    gap: spacing.sm,
  },
  body: {
    color: colors.text,
    fontSize: typography.body,
    lineHeight: 24,
  },
  closeLink: {
    alignItems: "center",
    paddingVertical: spacing.sm,
  },
  closeLinkText: {
    color: colors.textMuted,
    fontSize: typography.body,
  },
  habitTitle: {
    color: colors.textMuted,
    fontSize: 13,
    fontWeight: "700",
    textTransform: "uppercase",
  },
  overlay: {
    alignItems: "center",
    backgroundColor: "rgba(0,0,0,0.4)",
    flex: 1,
    justifyContent: "flex-end",
  },
  prompt: {
    color: colors.text,
    fontSize: typography.body,
    fontWeight: "600",
  },
  sheet: {
    backgroundColor: colors.background,
    borderTopLeftRadius: radius.lg,
    borderTopRightRadius: radius.lg,
    gap: spacing.lg,
    padding: spacing.xl,
    paddingBottom: spacing.xxl ?? spacing.xl,
    width: "100%",
  },
});
