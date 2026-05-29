import { StyleSheet, Text } from "react-native";

import { useThemedStyles } from "@/theme/useThemedStyles";

import type { Theme } from "@/theme/contract";

type IdentityStreakDisplayProps = {
  identityNoun: string | null;
  streak: number;
};

function buildStyles(theme: Theme) {
  return StyleSheet.create({
    text: {
      color: theme.colors.textMuted,
      fontFamily: theme.fontFamilies.body,
      fontSize: theme.typography.bodyLg,
      fontStyle: "italic" as const,
      lineHeight: 21,
    },
  });
}

export function IdentityStreakDisplay({
  identityNoun,
  streak,
}: IdentityStreakDisplayProps) {
  const copy = getStreakCopy(streak, identityNoun);
  const styles = useThemedStyles(buildStyles);

  return (
    <Text selectable style={styles.text}>
      {copy}
    </Text>
  );
}

function getStreakCopy(streak: number, identityNoun: string | null): string {
  if (streak === 0) {
    return "Day one. Start showing up.";
  }
  const dayLabel = streak === 1 ? "day" : "days";
  if (identityNoun) {
    return `You've been a ${identityNoun} for ${streak} ${dayLabel}.`;
  }
  return `You've shown up ${streak} ${dayLabel} for this habit.`;
}
