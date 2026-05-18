import { Pressable, StyleSheet, Text, View } from "react-native";
import { ChevronRight } from "lucide-react-native";
import { router } from "expo-router";

import { formatExactDate } from "@/features/library/metrics";
import { colors } from "@/theme/colors";
import { fontFamilies } from "@/theme/fontFamilies";
import { radius } from "@/theme/radius";
import { spacing } from "@/theme/spacing";
import { typography } from "@/theme/typography";

import type { ArchivedGoalSummary } from "@/features/habits/api";

type ArchivedGoalCardProps = {
  goal: ArchivedGoalSummary;
};

export function ArchivedGoalCard({ goal }: ArchivedGoalCardProps) {
  const handlePress = () => {
    router.push({
      pathname: "/(app)/goals/archived/[identityPhrase]",
      params: { identityPhrase: encodeURIComponent(goal.identityPhrase) },
    });
  };

  return (
    <Pressable
      accessibilityLabel={`Open archived goal ${goal.identityPhrase}`}
      accessibilityRole="button"
      onPress={handlePress}
      style={({ pressed }) => [styles.card, pressed && styles.cardPressed]}
    >
      <View style={styles.content}>
        <Text style={styles.title}>Become {goal.identityPhrase}</Text>
        <Text style={styles.metaText}>
          {goal.habitCount} habit{goal.habitCount === 1 ? "" : "s"} ·
          archived {formatExactDate(goal.archivedAt)}
        </Text>
      </View>
      <ChevronRight color={colors.textFaint} size={18} strokeWidth={1.75} />
    </Pressable>
  );
}

const styles = StyleSheet.create({
  card: {
    alignItems: "center",
    backgroundColor: colors.surfaceMuted,
    borderRadius: radius.sm,
    flexDirection: "row",
    gap: spacing.md,
    padding: spacing.lg,
  },
  cardPressed: {
    opacity: 0.7,
  },
  content: {
    flex: 1,
    gap: spacing.xs,
  },
  metaText: {
    color: colors.textFaint,
    fontFamily: fontFamilies.body,
    fontSize: typography.micro,
  },
  title: {
    color: colors.textMuted,
    fontFamily: fontFamilies.bodySemi,
    fontSize: typography.bodyLg,
  },
});
