import { StyleSheet, Text, View } from "react-native";

import { LibraryHabitCard } from "@/features/library/components/LibraryHabitCard";
import { useThemedStyles } from "@/theme/useThemedStyles";

import type { LibraryGoalGroup as LibraryGoalGroupType } from "@/features/library/hooks";

type LibraryGoalGroupProps = {
  group: LibraryGoalGroupType;
};

export function LibraryGoalGroup({ group }: LibraryGoalGroupProps) {
  const styles = useThemedStyles((t) =>
    StyleSheet.create({
      badge: {
        color: t.colors.graduatedCircle,
        fontFamily: t.fontFamilies.body,
        fontSize: t.typography.micro,
        fontStyle: "italic",
      },
      cardList: {
        gap: t.spacing.lg,
      },
      header: {
        color: t.colors.primary,
        fontFamily: t.fontFamilies.bodySemi,
        fontSize: t.typography.bodyLg,
      },
      headerRow: {
        alignItems: "center",
        flexDirection: "row",
        gap: t.spacing.sm,
      },
      root: {
        gap: t.spacing.md,
      },
    }),
  );

  const headerLabel = group.identityPhrase
    ? `Become ${group.identityPhrase}`
    : "Other";

  return (
    <View style={styles.root}>
      <View style={styles.headerRow}>
        <Text style={styles.header}>{headerLabel}</Text>
        {group.goalGraduated ? (
          <Text style={styles.badge}>(All graduated)</Text>
        ) : null}
      </View>
      <View style={styles.cardList}>
        {group.habits.map((habit) => (
          <LibraryHabitCard key={habit.id} habit={habit} />
        ))}
      </View>
    </View>
  );
}
