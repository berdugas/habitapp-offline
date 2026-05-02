import { BlurView } from "expo-blur";
import { Modal, Pressable, StyleSheet, Text, View } from "react-native";

import { TertiaryButton } from "@/components/buttons/TertiaryButton";
import { colors } from "@/theme/colors";
import { fontFamilies } from "@/theme/fontFamilies";
import { radius } from "@/theme/radius";
import { shadows } from "@/theme/shadows";
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

const ACTIONS = [
  {
    key: "restart",
    label: "Restart as-is",
    hint: "Continue with the same habit. Streak resets to 0.",
  },
  {
    key: "smaller",
    label: "Make it smaller",
    hint: "Edit the tiny action to something easier.",
  },
  {
    key: "pause",
    label: "Pause for now",
    hint: "Archive the habit. History is preserved.",
  },
] as const;

export function RecoveryModal({
  visible,
  habitTitle,
  onRestart,
  onMakeItSmaller,
  onPauseForNow,
  onClose,
}: RecoveryModalProps) {
  const handlers: Record<string, () => void> = {
    restart: onRestart,
    smaller: onMakeItSmaller,
    pause: onPauseForNow,
  };

  return (
    <Modal animationType="slide" transparent visible={visible}>
      <View style={styles.overlay}>
        <BlurView intensity={80} style={styles.blurContainer} tint="light">
          <View style={styles.sheet}>
            <Text selectable style={styles.eyebrow}>
              {habitTitle.toUpperCase()}
            </Text>
            <Text selectable style={styles.body}>
              The habit lost some momentum. That happens to everyone — what
              matters now is what you do next.
            </Text>

            <View style={styles.actions}>
              {ACTIONS.map((action) => (
                <Pressable
                  accessibilityRole="button"
                  key={action.key}
                  onPress={handlers[action.key]}
                  style={({ pressed }) => [
                    styles.actionCard,
                    pressed && styles.actionCardPressed,
                  ]}
                >
                  <Text selectable style={styles.actionLabel}>
                    {action.label}
                  </Text>
                  <Text selectable style={styles.actionHint}>
                    {action.hint}
                  </Text>
                </Pressable>
              ))}
            </View>

            <TertiaryButton label="Just close" onPress={onClose} />
          </View>
        </BlurView>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  actionCard: {
    backgroundColor: colors.surfaceCard,
    borderRadius: radius.md,
    boxShadow: shadows.lift,
    gap: spacing.xs,
    padding: spacing.lg,
  },
  actionCardPressed: {
    opacity: 0.88,
  },
  actionHint: {
    color: colors.textMuted,
    fontFamily: fontFamilies.body,
    fontSize: typography.bodyMd,
    lineHeight: 18,
  },
  actionLabel: {
    color: colors.text,
    fontFamily: fontFamilies.bodySemi,
    fontSize: typography.bodyLg,
  },
  actions: {
    gap: spacing.sm,
  },
  blurContainer: {
    borderTopLeftRadius: radius.lg,
    borderTopRightRadius: radius.lg,
    overflow: "hidden",
    width: "100%",
  },
  body: {
    color: colors.text,
    fontFamily: fontFamilies.body,
    fontSize: typography.bodyLg,
    lineHeight: 24,
  },
  eyebrow: {
    color: colors.textMuted,
    fontFamily: fontFamilies.bodyBold,
    fontSize: typography.micro,
    letterSpacing: 1,
  },
  overlay: {
    flex: 1,
    justifyContent: "flex-end",
    backgroundColor: "rgba(0,0,0,0.3)",
  },
  sheet: {
    backgroundColor: "rgba(251, 249, 245, 0.9)",
    gap: spacing.lg,
    padding: spacing.xl,
    paddingBottom: spacing.xxl,
  },
});
