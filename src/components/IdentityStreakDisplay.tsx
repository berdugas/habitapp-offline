import { StyleSheet, Text } from "react-native";

import { colors } from "@/theme/colors";
import { typography } from "@/theme/typography";

type IdentityStreakDisplayProps = {
  identityNoun: string | null;
  streak: number;
};

export function IdentityStreakDisplay({
  identityNoun,
  streak,
}: IdentityStreakDisplayProps) {
  const copy = getStreakCopy(streak, identityNoun);
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

const styles = StyleSheet.create({
  text: {
    color: colors.text,
    fontSize: typography.bodyLg,
    fontStyle: "italic",
    lineHeight: 24,
  },
});
