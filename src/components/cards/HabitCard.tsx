import type { ReactNode } from "react";

import { Pressable, StyleSheet, Text, View } from "react-native";

import { useThemedStyles } from "@/theme/useThemedStyles";

type HabitCardProps = {
  children?: ReactNode;
  formula: string;
  metaText?: string;
  name: string;
  onPress?: () => void;
};

export function HabitCard({
  children,
  formula,
  metaText = "Tracking starts here",
  name,
  onPress,
}: HabitCardProps) {
  const styles = useThemedStyles((theme) =>
    StyleSheet.create({
      card: {
        backgroundColor: theme.colors.surface,
        borderColor: 'transparent',
        borderRadius: theme.radius.lg,
        borderWidth: 1,
        boxShadow: theme.shadows.card,
        gap: theme.spacing.md,
        padding: theme.spacing.xl,
      },
      formula: {
        color: theme.colors.textMuted,
        fontSize: 15,
        lineHeight: 22,
      },
      headerPressable: {
        gap: theme.spacing.md,
      },
      metaRow: {
        backgroundColor: theme.colors.primarySoft,
        borderRadius: theme.radius.pill,
        paddingHorizontal: theme.spacing.md,
        paddingVertical: theme.spacing.sm,
        alignSelf: "flex-start",
      },
      metaText: {
        color: theme.colors.primary,
        fontSize: theme.typography.labelMd,
        fontWeight: "600",
      },
      name: {
        color: theme.colors.text,
        fontSize: theme.typography.titleLg,
        fontWeight: "700",
      },
    }),
  );

  const headerContent = (
    <>
      <Text selectable style={styles.name}>
        {name}
      </Text>
      <Text selectable style={styles.formula}>
        {formula}
      </Text>
      <View style={styles.metaRow}>
        <Text selectable style={styles.metaText}>
          {metaText}
        </Text>
      </View>
    </>
  );

  return (
    <View style={styles.card}>
      {onPress ? (
        <Pressable
          accessibilityLabel={`${name} details`}
          accessibilityRole="button"
          onPress={onPress}
          style={styles.headerPressable}
        >
          {headerContent}
        </Pressable>
      ) : (
        headerContent
      )}
      {children}
    </View>
  );
}
