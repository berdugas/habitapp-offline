import { StyleSheet, Text, View } from "react-native";

import { useThemedStyles } from "@/theme/useThemedStyles";

type EmptyStateProps = {
  body: string;
  title: string;
};

export function EmptyState({ body, title }: EmptyStateProps) {
  const styles = useThemedStyles((theme) =>
    StyleSheet.create({
      body: {
        color: theme.colors.textMuted,
        fontSize: 15,
        lineHeight: 22,
        textAlign: "center",
      },
      container: {
        backgroundColor: theme.colors.surface,
        borderColor: 'transparent',
        borderRadius: theme.radius.lg,
        borderWidth: 1,
        gap: theme.spacing.sm,
        padding: theme.spacing.xl,
      },
      title: {
        color: theme.colors.text,
        fontSize: theme.typography.titleMd,
        fontWeight: "700",
        textAlign: "center",
      },
    }),
  );

  return (
    <View style={styles.container}>
      <Text selectable style={styles.title}>
        {title}
      </Text>
      <Text selectable style={styles.body}>
        {body}
      </Text>
    </View>
  );
}
