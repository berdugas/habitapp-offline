import { StyleSheet, Text, View } from "react-native";
import Svg, { Circle } from "react-native-svg";

import { colors } from "@/theme/colors";
import { fontFamilies } from "@/theme/fontFamilies";
import { typography } from "@/theme/typography";

const SIZE = 48;
const STROKE_WIDTH = 4;
const RADIUS = (SIZE - STROKE_WIDTH) / 2;
const CIRCUMFERENCE = 2 * Math.PI * RADIUS;
const CENTER = SIZE / 2;

type ConsistencyDonutProps = {
  rate: number;
};

export function ConsistencyDonut({ rate }: ConsistencyDonutProps) {
  const offset = CIRCUMFERENCE * (1 - Math.min(1, Math.max(0, rate)));
  const pct = Math.round(rate * 100);

  return (
    <View style={styles.container}>
      <View style={styles.donutWrap}>
        <Svg width={SIZE} height={SIZE}>
          <Circle
            cx={CENTER}
            cy={CENTER}
            r={RADIUS}
            stroke={colors.surfaceHigh}
            strokeWidth={STROKE_WIDTH}
            fill="none"
          />
          <Circle
            cx={CENTER}
            cy={CENTER}
            r={RADIUS}
            stroke={colors.primary}
            strokeWidth={STROKE_WIDTH}
            fill="none"
            strokeDasharray={`${CIRCUMFERENCE} ${CIRCUMFERENCE}`}
            strokeDashoffset={offset}
            strokeLinecap="round"
            transform={`rotate(-90, ${CENTER}, ${CENTER})`}
          />
        </Svg>
        <View style={styles.pctOverlay}>
          <Text style={styles.pctText}>{pct}%</Text>
        </View>
      </View>
      <Text style={styles.captionText}>Consistency</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  captionText: {
    color: colors.textFaint,
    fontFamily: fontFamilies.body,
    fontSize: typography.micro,
    marginTop: 2,
    textAlign: "center",
  },
  container: {
    alignItems: "center",
  },
  donutWrap: {
    height: SIZE,
    width: SIZE,
  },
  pctOverlay: {
    ...StyleSheet.absoluteFillObject,
    alignItems: "center",
    justifyContent: "center",
  },
  pctText: {
    color: colors.text,
    fontFamily: fontFamilies.bodyMedium,
    fontSize: 11,
  },
});
