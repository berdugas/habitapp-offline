import { StyleSheet, Text, View } from "react-native";

import { colors } from "@/theme/colors";
import { fontFamilies } from "@/theme/fontFamilies";
import { spacing } from "@/theme/spacing";
import { typography } from "@/theme/typography";

type ReviewStepIndicatorProps = {
  total: number;
  currentIndex: number;
};

// Above this count the dot row gets crowded (active dot is wider) and the
// visual progress signal becomes harder to read at a glance. We render a
// "Step n of m" text fallback above the dots to keep the read instant.
const MAX_DOTS_BEFORE_TEXT_FALLBACK = 5;

export function ReviewStepIndicator({
  total,
  currentIndex,
}: ReviewStepIndicatorProps) {
  return (
    <View
      accessibilityLabel={`Step ${currentIndex + 1} of ${total}`}
      accessibilityRole="progressbar"
      style={styles.container}
    >
      {total > MAX_DOTS_BEFORE_TEXT_FALLBACK ? (
        <Text style={styles.stepText}>
          Step {currentIndex + 1} of {total}
        </Text>
      ) : null}
      <View style={styles.row}>
        {Array.from({ length: total }).map((_, i) => {
          const isActive = i === currentIndex;
          const isDone = i < currentIndex;
          return (
            <View
              key={i}
              style={[
                styles.dot,
                isActive && styles.dotActive,
                isDone && styles.dotDone,
              ]}
            />
          );
        })}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    alignItems: "center",
    gap: spacing.xs,
  },
  dot: {
    backgroundColor: colors.surfaceHigh,
    borderRadius: 4,
    height: 8,
    width: 8,
  },
  dotActive: {
    backgroundColor: colors.primary,
    width: 24,
  },
  dotDone: {
    backgroundColor: colors.primaryLight,
  },
  row: {
    alignItems: "center",
    flexDirection: "row",
    gap: spacing.xs,
    justifyContent: "center",
  },
  stepText: {
    color: colors.textMuted,
    fontFamily: fontFamilies.bodySemi,
    fontSize: typography.micro,
    letterSpacing: 0.6,
    textTransform: "uppercase",
  },
});
