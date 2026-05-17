import { Pressable, StyleSheet, Text, View } from "react-native";
import { X } from "lucide-react-native";

import { colors } from "@/theme/colors";
import { fontFamilies } from "@/theme/fontFamilies";
import { radius } from "@/theme/radius";
import { spacing } from "@/theme/spacing";
import { typography } from "@/theme/typography";

type FirstRunTipBannerProps = {
  message: string;
  onDismiss: () => void;
  testID?: string;
};

export function FirstRunTipBanner({
  message,
  onDismiss,
  testID,
}: FirstRunTipBannerProps) {
  return (
    <View style={styles.container} testID={testID}>
      <Text style={styles.message}>{message}</Text>
      <Pressable
        accessibilityLabel="Dismiss tip"
        accessibilityRole="button"
        hitSlop={12}
        onPress={onDismiss}
        style={styles.dismiss}
      >
        <X color={colors.textMuted} size={16} strokeWidth={2} />
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    backgroundColor: colors.primarySoft,
    borderLeftColor: colors.primary,
    borderLeftWidth: 3,
    borderRadius: radius.sm,
    flexDirection: "row",
    gap: spacing.sm,
    padding: spacing.md,
    paddingRight: spacing.lg,
  },
  dismiss: {
    alignItems: "center",
    height: 24,
    justifyContent: "center",
    width: 24,
  },
  message: {
    color: colors.text,
    flex: 1,
    fontFamily: fontFamilies.body,
    fontSize: typography.bodyMd,
    lineHeight: 20,
  },
});
