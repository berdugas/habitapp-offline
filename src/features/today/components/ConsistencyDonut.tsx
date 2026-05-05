import { Pressable, StyleSheet, Text, View } from "react-native";
import Svg, { Circle } from "react-native-svg";

import { colors } from "@/theme/colors";
import { fontFamilies } from "@/theme/fontFamilies";
import { typography } from "@/theme/typography";

const DEFAULT_SIZE = 48;
const STROKE_WIDTH = 4;

type ConsistencyDonutProps = {
  label?: string;
  onPress?: () => void;
  rate: number;
  size?: number;
};

export function ConsistencyDonut({
  label = "Consistency",
  onPress,
  rate,
  size = DEFAULT_SIZE,
}: ConsistencyDonutProps) {
  const radius = (size - STROKE_WIDTH) / 2;
  const circumference = 2 * Math.PI * radius;
  const center = size / 2;
  const offset = circumference * (1 - Math.min(1, Math.max(0, rate)));
  const pct = Math.round(rate * 100);

  const content = (
    <View style={styles.container}>
      <View style={[styles.donutWrap, { height: size, width: size }]}>
        <Svg width={size} height={size}>
          <Circle
            cx={center}
            cy={center}
            r={radius}
            stroke={colors.surfaceHigh}
            strokeWidth={STROKE_WIDTH}
            fill="none"
          />
          <Circle
            cx={center}
            cy={center}
            r={radius}
            stroke={colors.primary}
            strokeWidth={STROKE_WIDTH}
            fill="none"
            strokeDasharray={`${circumference} ${circumference}`}
            strokeDashoffset={offset}
            strokeLinecap="round"
            transform={`rotate(-90, ${center}, ${center})`}
          />
        </Svg>
        <View style={StyleSheet.absoluteFill}>
          <View style={styles.pctOverlay}>
            <Text style={[styles.pctText, { fontSize: Math.round(size * 0.23) }]}>{pct}%</Text>
          </View>
        </View>
      </View>
      {label !== "" ? (
        <Text style={styles.captionText}>{label}</Text>
      ) : null}
    </View>
  );

  if (onPress) {
    return (
      <Pressable
        onPress={onPress}
        style={({ pressed }) => (pressed ? { opacity: 0.7 } : undefined)}
      >
        {content}
      </Pressable>
    );
  }
  return content;
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
    position: "relative",
  },
  pctOverlay: {
    alignItems: "center",
    flex: 1,
    justifyContent: "center",
  },
  pctText: {
    color: colors.text,
    fontFamily: fontFamilies.bodyMedium,
  },
});
