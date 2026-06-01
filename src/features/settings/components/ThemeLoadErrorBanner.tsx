import { Pressable, StyleSheet, Text, View } from "react-native";

import { useThemedStyles } from "@/theme/useThemedStyles";

type ThemeLoadErrorBannerProps = {
  themeName: string;
  onRetry: () => void;
};

export function ThemeLoadErrorBanner({ themeName, onRetry }: ThemeLoadErrorBannerProps) {
  const styles = useThemedStyles((t) =>
    StyleSheet.create({
      banner: {
        backgroundColor: t.colors.dangerSoft,
        borderRadius: t.radius.sm,
        gap: t.spacing.sm,
        padding: t.spacing.md,
      },
      text: {
        color: t.colors.danger,
        fontFamily: t.fontFamilies.body,
        fontSize: t.typography.bodyMd,
      },
      retry: {
        color: t.colors.primary,
        fontFamily: t.fontFamilies.bodySemi,
        fontSize: t.typography.bodyMd,
      },
    }),
  );

  return (
    <View style={styles.banner}>
      <Text style={styles.text}>
        Couldn&apos;t load {themeName} theme. Connect to the internet and try again.
      </Text>
      <Pressable accessibilityRole="button" onPress={onRetry}>
        <Text style={styles.retry}>Retry</Text>
      </Pressable>
    </View>
  );
}
