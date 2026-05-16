import { StyleSheet, View } from "react-native";

import { colors } from "@/theme/colors";
import { spacing } from "@/theme/spacing";

type ReviewStepIndicatorProps = {
  total: number;
  currentIndex: number;
};

export function ReviewStepIndicator({
  total,
  currentIndex,
}: ReviewStepIndicatorProps) {
  return (
    <View
      accessibilityLabel={`Step ${currentIndex + 1} of ${total}`}
      accessibilityRole="progressbar"
      style={styles.row}
    >
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
  );
}

const styles = StyleSheet.create({
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
});
