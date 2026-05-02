import { StyleSheet, Text, View } from "react-native";

import { colors } from "@/theme/colors";
import { fontFamilies } from "@/theme/fontFamilies";
import { radius } from "@/theme/radius";
import { spacing } from "@/theme/spacing";
import { typography } from "@/theme/typography";

type MissBannerProps = {
  body?: string;
  headline?: string;
};

export function MissBanner({
  body = "The science says it didn't matter. Keep going.",
  headline = "Yesterday was a miss.",
}: MissBannerProps) {
  return (
    <View style={styles.container}>
      <Text style={styles.headline}>{headline}</Text>
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
  headline: {
    color: colors.text,
    fontFamily: fontFamilies.bodyMedium,
    fontSize: typography.bodyLg,
  },
});
