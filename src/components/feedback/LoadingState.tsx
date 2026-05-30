import { ActivityIndicator, StyleSheet, Text, View } from "react-native";

import { useTheme } from "@/theme/useTheme";
import { useThemedStyles } from "@/theme/useThemedStyles";

type LoadingStateProps = {
  message?: string;
};

export function LoadingState({
  message = "Getting things ready...",
}: LoadingStateProps) {
  const theme = useTheme();
  const styles = useThemedStyles((t) =>
    StyleSheet.create({
      container: {
        alignItems: "center",
        flex: 1,
        gap: t.spacing.md,
        justifyContent: "center",
        padding: t.spacing.xl,
      },
      message: {
        color: t.colors.textMuted,
        fontSize: t.typography.bodyLg,
        textAlign: "center",
      },
    }),
  );

  return (
    <View style={styles.container}>
      <ActivityIndicator color={theme.colors.primary} size="large" />
      <Text selectable style={styles.message}>
        {message}
      </Text>
    </View>
  );
}
