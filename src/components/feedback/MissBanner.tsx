import { Pressable, StyleSheet, Text, View } from "react-native";

import { useThemedStyles } from "@/theme/useThemedStyles";

type MissBannerProps = {
  body?: string;
  headline?: string;
  onDismiss?: () => void;
};

export function MissBanner({
  body = "The science says it didn't matter. Keep going.",
  headline = "Yesterday was a miss.",
  onDismiss,
}: MissBannerProps) {
  const styles = useThemedStyles((theme) =>
    StyleSheet.create({
      body: {
        color: theme.colors.textMuted,
        fontFamily: theme.fontFamilies.body,
        fontSize: theme.typography.bodyMd,
        lineHeight: 18.6,
      },
      container: {
        backgroundColor: theme.colors.surface,
        borderRadius: theme.radius.sm,
        gap: theme.spacing.xs,
        padding: theme.spacing.lg,
      },
      dismissBtn: {
        paddingHorizontal: theme.spacing.xs,
      },
      dismissText: {
        color: theme.colors.textMuted,
        fontSize: theme.typography.titleLg,
        fontWeight: "300",
        lineHeight: 19.8,
      },
      headline: {
        color: theme.colors.text,
        flex: 1,
        fontFamily: theme.fontFamilies.bodyMedium,
        fontSize: theme.typography.bodyLg,
      },
      row: {
        alignItems: "center",
        flexDirection: "row",
      },
    }),
  );

  return (
    <View style={styles.container}>
      <View style={styles.row}>
        <Text style={styles.headline}>{headline}</Text>
        {onDismiss ? (
          <Pressable
            accessibilityLabel="Dismiss"
            accessibilityRole="button"
            onPress={onDismiss}
            style={styles.dismissBtn}
          >
            <Text style={styles.dismissText}>×</Text>
          </Pressable>
        ) : null}
      </View>
      <Text style={styles.body}>{body}</Text>
    </View>
  );
}
