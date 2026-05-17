import { useState } from "react";
import { StyleSheet, Text, View } from "react-native";
import Svg, { Circle, Path, Text as SvgText } from "react-native-svg";

import { colors } from "@/theme/colors";
import { fontFamilies } from "@/theme/fontFamilies";
import { typography } from "@/theme/typography";

const CHART_HEIGHT = 72;
const POINT_RADIUS = 3;
const STROKE_WIDTH = 2;
const Y_MIN = 0.3;
const Y_MAX = 1.0;
const LABEL_HEIGHT = 16;
const HORIZONTAL_PADDING = 12;
const LEFT_LABEL_WIDTH = 26;
const TOP_PADDING = 10;
const TENSION = 0.35;

type WeeklyConsistencyChartProps = {
  weeklyData: { weekLabel: string; rate: number }[];
};

const FALLBACK_WIDTH = 300;

export function WeeklyConsistencyChart({ weeklyData }: WeeklyConsistencyChartProps) {
  const [measuredWidth, setMeasuredWidth] = useState(0);

  if (weeklyData.length < 1) return null;

  const width = measuredWidth > 0 ? measuredWidth : FALLBACK_WIDTH;
  const plotLeft = LEFT_LABEL_WIDTH + HORIZONTAL_PADDING;
  const innerWidth = Math.max(0, width - plotLeft - HORIZONTAL_PADDING);
  const innerHeight = CHART_HEIGHT;

  const points = weeklyData.map((d, i) => {
    const x =
      plotLeft +
      (weeklyData.length === 1
        ? innerWidth / 2
        : (innerWidth * i) / (weeklyData.length - 1));
    const clamped = Math.min(Y_MAX, Math.max(Y_MIN, d.rate));
    const y =
      TOP_PADDING + innerHeight - ((clamped - Y_MIN) / (Y_MAX - Y_MIN)) * innerHeight;
    return { x, y };
  });

  const linePath = buildSmoothedPath(points);
  const isSinglePoint = points.length === 1;

  const areaPath = isSinglePoint
    ? ""
    : `${linePath} L ${points[points.length - 1].x.toFixed(
        2,
      )} ${TOP_PADDING + innerHeight} L ${points[0].x.toFixed(2)} ${TOP_PADDING + innerHeight} Z`;

  return (
    <View
      onLayout={(e) => setMeasuredWidth(e.nativeEvent.layout.width)}
      style={styles.container}
    >
      <Svg width={width} height={TOP_PADDING + CHART_HEIGHT + LABEL_HEIGHT}>
        <SvgText
          x={LEFT_LABEL_WIDTH - 4}
          y={TOP_PADDING + 4}
          fill={colors.textFaint}
          fontSize={typography.micro}
          fontFamily={fontFamilies.body}
          textAnchor="end"
        >
          100%
        </SvgText>
        <SvgText
          x={LEFT_LABEL_WIDTH - 4}
          y={TOP_PADDING + CHART_HEIGHT}
          fill={colors.textFaint}
          fontSize={typography.micro}
          fontFamily={fontFamilies.body}
          textAnchor="end"
        >
          30%
        </SvgText>
        {!isSinglePoint && (
          <>
            <Path d={areaPath} fill="rgba(68, 102, 85, 0.08)" />
            <Path
              d={linePath}
              stroke={colors.primary}
              strokeWidth={STROKE_WIDTH}
              fill="none"
              strokeLinecap="round"
              strokeLinejoin="round"
            />
          </>
        )}
        {points.map((p, i) => (
          <Circle
            key={i}
            cx={p.x}
            cy={p.y}
            r={isSinglePoint ? POINT_RADIUS + 1 : POINT_RADIUS}
            fill={colors.primary}
            stroke="#ffffff"
            strokeWidth={1.5}
          />
        ))}
        {points.map((p, i) => (
          <SvgText
            key={`label-${i}`}
            x={p.x}
            y={TOP_PADDING + CHART_HEIGHT + LABEL_HEIGHT - 4}
            fill={colors.textFaint}
            fontSize={typography.micro}
            fontFamily={fontFamilies.body}
            textAnchor="middle"
          >
            {weeklyData[i].weekLabel}
          </SvgText>
        ))}
      </Svg>
      <Text style={styles.caption}>Weekly consistency</Text>
    </View>
  );
}

function buildSmoothedPath(points: { x: number; y: number }[]): string {
  if (points.length === 0) return "";
  if (points.length === 1) {
    return `M ${points[0].x.toFixed(2)} ${points[0].y.toFixed(2)}`;
  }
  let d = `M ${points[0].x.toFixed(2)} ${points[0].y.toFixed(2)}`;
  for (let i = 0; i < points.length - 1; i++) {
    const p0 = points[i - 1] ?? points[i];
    const p1 = points[i];
    const p2 = points[i + 1];
    const p3 = points[i + 2] ?? p2;
    // Catmull-Rom-to-cubic-bezier conversion with adjustable tension.
    const cp1x = p1.x + ((p2.x - p0.x) * TENSION) / 2;
    const cp1y = Math.max(0, p1.y + ((p2.y - p0.y) * TENSION) / 2);
    const cp2x = p2.x - ((p3.x - p1.x) * TENSION) / 2;
    const cp2y = Math.max(0, p2.y - ((p3.y - p1.y) * TENSION) / 2);
    d += ` C ${cp1x.toFixed(2)} ${cp1y.toFixed(2)} ${cp2x.toFixed(2)} ${cp2y.toFixed(2)} ${p2.x.toFixed(2)} ${p2.y.toFixed(2)}`;
  }
  return d;
}

const styles = StyleSheet.create({
  caption: {
    color: colors.textFaint,
    fontFamily: fontFamilies.body,
    fontSize: typography.micro,
    marginTop: 4,
    textAlign: "right",
  },
  container: {
    width: "100%",
  },
});
