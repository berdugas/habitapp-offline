import type { ReactNode } from "react";

import { Pressable, StyleSheet, Text, View } from "react-native";

import { colors } from "@/theme/colors";
import { radius } from "@/theme/radius";
import { shadows } from "@/theme/shadows";
import { spacing } from "@/theme/spacing";

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

const styles = StyleSheet.create({
  card: {
    backgroundColor: colors.surface,
    borderColor: 'transparent',
    borderRadius: radius.lg,
    borderWidth: 1,
    boxShadow: shadows.card,
    gap: spacing.md,
    padding: spacing.xl,
  },
  formula: {
    color: colors.textMuted,
    fontSize: 15,
    lineHeight: 22,
  },
  headerPressable: {
    gap: spacing.md,
  },
  metaRow: {
    backgroundColor: colors.primarySoft,
    borderRadius: radius.pill,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    alignSelf: "flex-start",
  },
  metaText: {
    color: colors.primary,
    fontSize: 13,
    fontWeight: "600",
  },
  name: {
    color: colors.text,
    fontSize: 20,
    fontWeight: "700",
  },
});
