import { Pressable, StyleSheet, Text, View } from "react-native";
import { ChevronRight } from "lucide-react-native";
import { router } from "expo-router";

import { formatExactDate } from "@/features/library/metrics";
import { useTheme } from "@/theme/useTheme";
import { useThemedStyles } from "@/theme/useThemedStyles";

import type { ArchivedGoalSummary } from "@/features/habits/api";

type ArchivedGoalCardProps = {
  goal: ArchivedGoalSummary;
};

export function ArchivedGoalCard({ goal }: ArchivedGoalCardProps) {
  const theme = useTheme();
  const styles = useThemedStyles((theme) =>
    StyleSheet.create({
      card: {
        alignItems: "center",
        backgroundColor: theme.colors.surfaceMuted,
        borderRadius: theme.radius.sm,
        flexDirection: "row",
        gap: theme.spacing.md,
        padding: theme.spacing.lg,
      },
      cardPressed: {
        opacity: 0.7,
      },
      content: {
        flex: 1,
        gap: theme.spacing.xs,
      },
      metaText: {
        color: theme.colors.textFaint,
        fontFamily: theme.fontFamilies.body,
        fontSize: theme.typography.micro,
      },
      title: {
        color: theme.colors.textMuted,
        fontFamily: theme.fontFamilies.bodySemi,
        fontSize: theme.typography.bodyLg,
      },
    }),
  );

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
      <ChevronRight color={theme.colors.textFaint} size={18} strokeWidth={1.75} />
    </Pressable>
  );
}
