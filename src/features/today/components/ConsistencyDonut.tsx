import { Pressable, StyleSheet, Text, View } from "react-native";
import Svg, { Circle } from "react-native-svg";

import { useTheme } from "@/theme/useTheme";
import { useThemedStyles } from "@/theme/useThemedStyles";

const DEFAULT_SIZE = 48;
const DEFAULT_STROKE_WIDTH = 4;

type ConsistencyDonutProps = {
  label?: string;
  onPress?: () => void;
  rate: number;
  showAttentionDot?: boolean;
  size?: number;
  strokeWidth?: number;
  suppressed?: boolean;
  testID?: string;
  tint?: string;
  tintedBackground?: boolean;
};

export function ConsistencyDonut({
  label = "Goal consistency",
  onPress,
  rate,
  showAttentionDot = false,
  size = DEFAULT_SIZE,
  strokeWidth = DEFAULT_STROKE_WIDTH,
  suppressed = false,
  testID,
  tint,
  tintedBackground = false,
}: ConsistencyDonutProps) {
  const theme = useTheme();
  const styles = useThemedStyles((t) =>
    StyleSheet.create({
      attentionDot: {
        backgroundColor: t.colors.primary,
        borderColor: t.colors.surfaceMuted,
        borderRadius: 999,
        borderWidth: 2,
        height: 12, // 8px dot + 2px border each side = 12px total
        position: "absolute",
        right: 2,
        top: 2,
        width: 12,
      },
      captionText: {
        color: t.colors.textFaint,
        fontFamily: t.fontFamilies.body,
        fontSize: 10,
        marginTop: 2,
        textAlign: "center",
      },
      container: {
        alignItems: "center",
      },
      containerTinted: {
        backgroundColor: t.colors.primarySoft,
        borderRadius: 12,
        paddingHorizontal: 12,
        paddingVertical: 10,
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
        color: t.colors.text,
        fontFamily: t.fontFamilies.bodySemi,
      },
      pctTextFull: {
        color: "#ffffff",
      },
      suppressedText: {
        color: t.colors.textFaint,
      },
    }),
  );

  const resolvedTint = tint ?? theme.colors.primary;

  const radius = (size - strokeWidth) / 2;
  const circumference = 2 * Math.PI * radius;
  const center = size / 2;
  const offset = circumference * (1 - Math.min(1, Math.max(0, rate)));
  const pct = Math.round(rate * 100);
  const isFull = !suppressed && pct >= 100;

  const content = (
    <View
      style={[styles.container, tintedBackground && styles.containerTinted]}
      testID={testID}
    >
      <View style={[styles.donutWrap, { height: size, width: size }]}>
        <Svg width={size} height={size}>
          {isFull ? (
            <Circle cx={center} cy={center} r={size / 2} fill={resolvedTint} />
          ) : (
            <>
              <Circle
                cx={center}
                cy={center}
                r={radius}
                stroke={theme.colors.surfaceHigh}
                strokeWidth={strokeWidth}
                fill="none"
              />
              {suppressed ? (
                <Circle
                  cx={center}
                  cy={center}
                  r={radius}
                  stroke={resolvedTint}
                  strokeOpacity={0.15}
                  strokeWidth={strokeWidth}
                  fill="none"
                  transform={`rotate(-90, ${center}, ${center})`}
                />
              ) : (
                <Circle
                  cx={center}
                  cy={center}
                  r={radius}
                  stroke={resolvedTint}
                  strokeWidth={strokeWidth}
                  fill="none"
                  strokeDasharray={`${circumference} ${circumference}`}
                  strokeDashoffset={offset}
                  strokeLinecap="round"
                  transform={`rotate(-90, ${center}, ${center})`}
                />
              )}
            </>
          )}
        </Svg>
        <View style={StyleSheet.absoluteFill}>
          <View style={styles.pctOverlay}>
            {suppressed ? (
              <Text
                style={[
                  styles.pctText,
                  styles.suppressedText,
                  { fontSize: Math.round(size * 0.3) },
                ]}
              >
                —
              </Text>
            ) : (
              <Text
                style={[
                  styles.pctText,
                  isFull && styles.pctTextFull,
                  { fontSize: Math.round(size * 0.25) },
                ]}
              >
                {pct}%
              </Text>
            )}
          </View>
        </View>
        {showAttentionDot ? (
          <View style={styles.attentionDot} testID="donut-attention-dot" />
        ) : null}
      </View>
      {label !== "" ? (
        <Text numberOfLines={1} style={styles.captionText}>{label}</Text>
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
