import { StyleSheet, View, ViewStyle } from "react-native";

import { colors } from "@/theme/colors";

type ConcentricRingsProps = {
  /** Outer ring diameter in dp. Inner rings scale proportionally. */
  size?: number;
  /** Base color — same for every ring; opacity steps create the halo. */
  color?: string;
  style?: ViewStyle;
};

// Four concentric rings: 0%/13%/27%/40% inset (proportional to size), with
// opacity rising 7% → 13% → 20% → 100% so the innermost reads solid and
// the outer rings fade into the background. Derived from the onboarding
// "Insight" screen's emblem and used as the design-system visual anchor
// for moments that need presence without an icon-set commitment.
const RING_INSETS = [0, 0.1333, 0.2667, 0.4] as const;
const RING_OPACITIES = [0.07, 0.13, 0.2, 1] as const;

export function ConcentricRings({
  size = 120,
  color = colors.primary,
  style,
}: ConcentricRingsProps) {
  return (
    <View style={[{ width: size, height: size }, style]}>
      {RING_INSETS.map((insetRatio, i) => {
        const offset = size * insetRatio;
        return (
          <View
            key={i}
            style={[
              styles.ring,
              {
                top: offset,
                left: offset,
                right: offset,
                bottom: offset,
                backgroundColor: color,
                opacity: RING_OPACITIES[i],
              },
            ]}
          />
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  ring: {
    borderRadius: 999,
    position: "absolute",
  },
});
