import { StyleSheet, Text, View } from "react-native";

import { PrimaryButton } from "@/components/buttons/PrimaryButton";
import { useThemedStyles } from "@/theme/useThemedStyles";

import type { Theme } from "@/theme/contract";

type ReadOnlyBannerProps = {
  isReconnecting: boolean;
  onReconnect: () => void;
};

function buildStyles(theme: Theme) {
  return StyleSheet.create({
    banner: {
      backgroundColor: theme.colors.surface,
      borderRadius: theme.radius.sm,
      gap: theme.spacing.md,
      padding: theme.spacing.xl,
    },
    body: {
      color: theme.colors.textMuted,
      fontFamily: theme.fontFamilies.body,
      fontSize: theme.typography.bodyMd,
      lineHeight: 20.4,
    },
    heading: {
      color: theme.colors.text,
      fontFamily: theme.fontFamilies.bodyBold,
      fontSize: theme.typography.bodyLg,
    },
  });
}

export function ReadOnlyBanner({ isReconnecting, onReconnect }: ReadOnlyBannerProps) {
  const styles = useThemedStyles(buildStyles);

  return (
    <View style={styles.banner}>
      <Text selectable style={styles.heading}>
        Reconnect to keep logging.
      </Text>
      <Text selectable style={styles.body}>
        We haven&apos;t been able to verify your account in a while. Tap to
        reconnect.
      </Text>
      <PrimaryButton
        disabled={isReconnecting}
        label={isReconnecting ? "Reconnecting…" : "Reconnect"}
        onPress={onReconnect}
      />
    </View>
  );
}
