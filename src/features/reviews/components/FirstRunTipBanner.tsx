import { Pressable, StyleSheet, Text, View } from "react-native";
import { X } from "lucide-react-native";

import { useThemedStyles } from "@/theme/useThemedStyles";
import { useTheme } from "@/theme/useTheme";

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
  const theme = useTheme();
  const styles = useThemedStyles((t) =>
    StyleSheet.create({
      container: {
        backgroundColor: t.colors.primarySoft,
        borderLeftColor: t.colors.primary,
        borderLeftWidth: 3,
        borderRadius: t.radius.sm,
        flexDirection: "row",
        gap: t.spacing.sm,
        padding: t.spacing.md,
        paddingRight: t.spacing.lg,
      },
      dismiss: {
        alignItems: "center",
        height: 24,
        justifyContent: "center",
        width: 24,
      },
      message: {
        color: t.colors.text,
        flex: 1,
        fontFamily: t.fontFamilies.body,
        fontSize: t.typography.bodyMd,
        lineHeight: 18.6,
      },
    }),
  );

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
        <X color={theme.colors.textMuted} size={16} strokeWidth={2} />
      </Pressable>
    </View>
  );
}
