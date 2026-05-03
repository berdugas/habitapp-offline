import { Pressable, StyleSheet, Text, View } from "react-native";

import { colors } from "@/theme/colors";
import { fontFamilies } from "@/theme/fontFamilies";
import { radius } from "@/theme/radius";
import { spacing } from "@/theme/spacing";
import { typography } from "@/theme/typography";

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

const styles = StyleSheet.create({
  body: {
    color: colors.textMuted,
    fontFamily: fontFamilies.body,
    fontSize: typography.bodyMd,
    lineHeight: 20,
  },
  container: {
    backgroundColor: colors.surface,
    borderRadius: radius.sm,
    gap: spacing.xs,
    padding: spacing.lg,
  },
  dismissBtn: {
    paddingHorizontal: spacing.xs,
  },
  dismissText: {
    color: colors.textMuted,
    fontSize: 20,
    fontWeight: "300",
    lineHeight: 22,
  },
  headline: {
    color: colors.text,
    flex: 1,
    fontFamily: fontFamilies.bodyMedium,
    fontSize: typography.bodyLg,
  },
  row: {
    alignItems: "center",
    flexDirection: "row",
  },
});
