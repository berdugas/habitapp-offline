import { StyleSheet, Text, View } from "react-native";

import { useThemedStyles } from "@/theme/useThemedStyles";

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
  const styles = useThemedStyles((theme) =>
    StyleSheet.create({
      container: {
        alignItems: "center",
        gap: theme.spacing.xs,
      },
      dot: {
        backgroundColor: theme.colors.surfaceHigh,
        borderRadius: 4,
        height: 8,
        width: 8,
      },
      dotActive: {
        backgroundColor: theme.colors.primary,
        width: 24,
      },
      dotDone: {
        backgroundColor: theme.colors.primaryLight,
      },
      row: {
        alignItems: "center",
        flexDirection: "row",
        gap: theme.spacing.xs,
        justifyContent: "center",
      },
      stepText: {
        color: theme.colors.textMuted,
        fontFamily: theme.fontFamilies.bodySemi,
        fontSize: theme.typography.micro,
        letterSpacing: 0.6,
        textTransform: "uppercase",
      },
    }),
  );

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
