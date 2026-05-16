import { StyleSheet, Text, View } from "react-native";

import { LucideIcon } from "@/components/LucideIconPicker";
import { colors } from "@/theme/colors";
import { fontFamilies } from "@/theme/fontFamilies";
import { spacing } from "@/theme/spacing";
import { typography } from "@/theme/typography";

import type { DayEntry } from "@/features/reviews/buildGoalWeekSummary";

type WeekStripProps = {
  habitTitle: string;
  icon: string | null;
  days: DayEntry[];
  doneCount: number;
  activeDayCount: number;
  compact?: boolean;
};

function getDayColor(day: DayEntry): {
  bg: string;
  border: string;
  borderStyle?: "dashed" | "solid";
} {
  if (!day.isActiveDay) {
    return {
      bg: "transparent",
      border: colors.offDayBorder,
      borderStyle: "dashed",
    };
  }
  if (day.status === "done") {
    return { bg: colors.heatDone, border: colors.heatDone };
  }
  if (day.status === "skipped") {
    return { bg: colors.heatSkipped, border: colors.heatSkipped };
  }
  if (day.status === "missed") {
    return { bg: colors.heatMissed, border: colors.heatMissed };
  }
  return { bg: colors.surface, border: colors.surfaceHigh };
}

export function WeekStrip({
  habitTitle,
  icon,
  days,
  doneCount,
  activeDayCount,
  compact = false,
}: WeekStripProps) {
  const cellSize = compact ? 16 : 20;
  return (
    <View style={[styles.row, compact && styles.rowCompact]}>
      <View style={styles.titleColumn}>
        {icon ? <LucideIcon color={colors.text} name={icon} size={16} /> : null}
        <Text numberOfLines={1} style={styles.title}>
          {habitTitle}
        </Text>
      </View>
      <View style={styles.cells}>
        {days.map((day) => {
          const tone = getDayColor(day);
          return (
            <View
              key={day.date}
              style={{
                backgroundColor: tone.bg,
                borderColor: tone.border,
                borderRadius: cellSize / 2,
                borderStyle: tone.borderStyle ?? "solid",
                borderWidth: 1,
                height: cellSize,
                width: cellSize,
              }}
            />
          );
        })}
      </View>
      <Text style={styles.count}>
        {doneCount}/{activeDayCount}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  cells: {
    flexDirection: "row",
    gap: spacing.xs,
  },
  count: {
    color: colors.textFaint,
    fontFamily: fontFamilies.body,
    fontSize: typography.bodyMd,
    minWidth: 32,
    textAlign: "right",
  },
  row: {
    alignItems: "center",
    flexDirection: "row",
    gap: spacing.md,
  },
  rowCompact: {
    gap: spacing.sm,
  },
  title: {
    color: colors.text,
    fontFamily: fontFamilies.bodySemi,
    fontSize: typography.bodyMd,
    flexShrink: 1,
  },
  titleColumn: {
    alignItems: "center",
    flexDirection: "row",
    flex: 1,
    gap: spacing.xs,
  },
});
