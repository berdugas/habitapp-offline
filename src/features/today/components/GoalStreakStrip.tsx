import { StyleSheet, Text, View } from "react-native";

import { Eyebrow } from "@/components/text/Eyebrow";
import { colors } from "@/theme/colors";
import { fontFamilies } from "@/theme/fontFamilies";
import { typography } from "@/theme/typography";

import type { GoalDayState } from "@/features/today/goalMetrics";

const BLOCK_SIZE = 16;
const BLOCK_GAP = 3;

type GoalStreakStripProps = {
  dailyStates: GoalDayState[];
  streak: number;
};

export function GoalStreakStrip({ dailyStates, streak }: GoalStreakStripProps) {
  const streakLabel = `${streak} day streak`;

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.streakLabel}>{streakLabel}</Text>
        <Eyebrow label="Last 14 days" />
      </View>
      <View style={styles.strip} testID="goal-strip">
        {dailyStates.map((state, index) => (
          <View
            key={index}
            testID="goal-strip-block"
            accessibilityLabel={state}
            style={[styles.block, blockStyle(state)]}
          />
        ))}
      </View>
    </View>
  );
}

function blockStyle(state: GoalDayState) {
  switch (state) {
    case "done":
      return { backgroundColor: colors.heatDone };
    case "missed":
      return { backgroundColor: colors.heatMissed };
    case "skipped":
      return { backgroundColor: colors.heatSkipped };
    case "off":
    case "pre-start":
      return {
        backgroundColor: "transparent",
        borderColor: colors.offDayBorder,
        borderWidth: 1,
      };
    case "today":
      return {
        backgroundColor: colors.primarySoft,
        borderColor: colors.primary,
        borderWidth: 1.5,
      };
  }
}

const styles = StyleSheet.create({
  block: {
    borderRadius: 3,
    height: BLOCK_SIZE,
    width: BLOCK_SIZE,
  },
  container: {
    backgroundColor: colors.surface,
    borderRadius: 12,
    paddingHorizontal: 12,
    paddingVertical: 12,
  },
  header: {
    marginBottom: 8,
  },
  streakLabel: {
    color: colors.primary,
    fontFamily: fontFamilies.bodySemi,
    fontSize: typography.bodyLg,
  },
  strip: {
    flexDirection: "row",
    gap: BLOCK_GAP,
    justifyContent: "center",
  },
});
