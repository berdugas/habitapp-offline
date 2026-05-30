import { StyleSheet, Text, View } from "react-native";

import { useThemedStyles } from "@/theme/useThemedStyles";

type ErrorStateProps = {
  message: string;
};

export function ErrorState({ message }: ErrorStateProps) {
  const styles = useThemedStyles((theme) =>
    StyleSheet.create({
      container: {
        backgroundColor: theme.colors.dangerSoft,
        borderColor: theme.colors.dangerSubtle,
        borderRadius: theme.radius.md,
        borderWidth: 1,
        gap: theme.spacing.sm,
        padding: theme.spacing.lg,
      },
      label: {
        color: theme.colors.danger,
        fontSize: theme.typography.bodyLg,
        fontWeight: "700",
      },
      message: {
        color: theme.colors.text,
        fontSize: theme.typography.bodyMd,
        lineHeight: 18.6,
      },
    }),
  );

  return (
    <View style={styles.container}>
      <Text selectable style={styles.label}>
        Something went wrong
      </Text>
      <Text selectable style={styles.message}>
        {message}
      </Text>
    </View>
  );
}
