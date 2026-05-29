import { BlurView } from "expo-blur";
import { Modal, Pressable, StyleSheet, Text, View } from "react-native";

import { TertiaryButton } from "@/components/buttons/TertiaryButton";
import { useThemedStyles } from "@/theme/useThemedStyles";

import type { Theme } from "@/theme/contract";

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

function buildStyles(theme: Theme) {
  return StyleSheet.create({
    actionCard: {
      backgroundColor: theme.colors.surfaceCard,
      borderRadius: theme.radius.md,
      boxShadow: theme.shadows.lift,
      gap: theme.spacing.xs,
      padding: theme.spacing.lg,
    },
    actionCardPressed: {
      opacity: 0.88,
    },
    actionHint: {
      color: theme.colors.textMuted,
      fontFamily: theme.fontFamilies.body,
      fontSize: theme.typography.bodyMd,
      lineHeight: 16.7,
    },
    actionLabel: {
      color: theme.colors.text,
      fontFamily: theme.fontFamilies.bodySemi,
      fontSize: theme.typography.bodyLg,
    },
    actions: {
      gap: theme.spacing.sm,
    },
    blurContainer: {
      borderTopLeftRadius: theme.radius.lg,
      borderTopRightRadius: theme.radius.lg,
      overflow: "hidden" as const,
      width: "100%" as const,
    },
    body: {
      color: theme.colors.text,
      fontFamily: theme.fontFamilies.body,
      fontSize: theme.typography.bodyLg,
      lineHeight: 21,
    },
    eyebrow: {
      color: theme.colors.textMuted,
      fontFamily: theme.fontFamilies.bodyBold,
      fontSize: theme.typography.micro,
      letterSpacing: 1,
    },
    overlay: {
      flex: 1,
      justifyContent: "flex-end" as const,
      backgroundColor: "rgba(0,0,0,0.3)",
    },
    sheet: {
      backgroundColor: "rgba(251, 249, 245, 0.9)",
      gap: theme.spacing.lg,
      padding: theme.spacing.xl,
      paddingBottom: theme.spacing.xxl,
    },
  });
}

export function RecoveryModal({
  visible,
  habitTitle,
  onRestart,
  onMakeItSmaller,
  onPauseForNow,
  onClose,
}: RecoveryModalProps) {
  const styles = useThemedStyles(buildStyles);

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
