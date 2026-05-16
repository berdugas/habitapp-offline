import { StyleSheet, Text, View } from "react-native";

import { LibraryHabitCard } from "@/features/library/components/LibraryHabitCard";
import { colors } from "@/theme/colors";
import { fontFamilies } from "@/theme/fontFamilies";
import { spacing } from "@/theme/spacing";
import { typography } from "@/theme/typography";

import type { LibraryGoalGroup as LibraryGoalGroupType } from "@/features/library/hooks";

type LibraryGoalGroupProps = {
  group: LibraryGoalGroupType;
};

export function LibraryGoalGroup({ group }: LibraryGoalGroupProps) {
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

const styles = StyleSheet.create({
  badge: {
    color: colors.graduatedCircle,
    fontFamily: fontFamilies.body,
    fontSize: typography.micro,
    fontStyle: "italic",
  },
  cardList: {
    gap: spacing.lg,
  },
  header: {
    color: colors.primary,
    fontFamily: fontFamilies.bodySemi,
    fontSize: typography.bodyLg,
  },
  headerRow: {
    alignItems: "center",
    flexDirection: "row",
    gap: spacing.sm,
  },
  root: {
    gap: spacing.md,
  },
});
