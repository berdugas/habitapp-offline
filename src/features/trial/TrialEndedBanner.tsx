import { StyleSheet, Text, View } from "react-native";

import { useThemedStyles } from "@/theme/useThemedStyles";

import type { Theme } from "@/theme/contract";

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

/**
 * Banner shown when the user's trial has ended and they haven't purchased.
 *
 * Intentionally has NO action button — until the paywall sub-plan ships,
 * there's nothing the user can do from inside the app to restore access.
 * Tapping a "Reconnect" button would just re-hit the flip-on-read RPC,
 * get back the same `expired` status, and re-render this banner — an
 * infinite loop with no recovery path.
 */
export function TrialEndedBanner() {
  const styles = useThemedStyles(buildStyles);

  return (
    <View style={styles.banner}>
      <Text selectable style={styles.heading}>
        Your trial has ended.
      </Text>
      <Text selectable style={styles.body}>
        You can keep viewing your habits, but logging is paused. We&apos;ll
        restore full access once you upgrade.
      </Text>
    </View>
  );
}
