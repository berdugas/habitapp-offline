import { StyleSheet, Text, View } from "react-native";

import { LucideIcon } from "@/components/LucideIconPicker";
import { useThemedStyles } from "@/theme/useThemedStyles";
import { useTheme } from "@/theme/useTheme";

import type { Colors } from "@/theme/contract";
import type { DayEntry } from "@/features/reviews/buildGoalWeekSummary";

type WeekStripProps = {
  habitTitle: string;
  icon: string | null;
  days: DayEntry[];
  doneCount: number;
  activeDayCount: number;
  compact?: boolean;
};

function getDayColor(
  day: DayEntry,
  colors: Colors,
): {
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
  const theme = useTheme();
  const styles = useThemedStyles((t) =>
    StyleSheet.create({
      cells: {
        flexDirection: "row",
        gap: t.spacing.xs,
      },
      count: {
        color: t.colors.textFaint,
        fontFamily: t.fontFamilies.body,
        fontSize: t.typography.bodyMd,
        minWidth: 32,
        textAlign: "right",
      },
      row: {
        alignItems: "center",
        flexDirection: "row",
        gap: t.spacing.md,
      },
      rowCompact: {
        gap: t.spacing.sm,
      },
      title: {
        color: t.colors.text,
        fontFamily: t.fontFamilies.bodySemi,
        fontSize: t.typography.bodyMd,
        flexShrink: 1,
      },
      titleColumn: {
        alignItems: "center",
        flexDirection: "row",
        flex: 1,
        gap: t.spacing.xs,
      },
    }),
  );

  const cellSize = compact ? 16 : 20;
  return (
    <View style={[styles.row, compact && styles.rowCompact]}>
      <View style={styles.titleColumn}>
        {icon ? <LucideIcon color={theme.colors.text} name={icon} size={16} /> : null}
        <Text numberOfLines={1} style={styles.title}>
          {habitTitle}
        </Text>
      </View>
      <View style={styles.cells}>
        {days.map((day) => {
          const tone = getDayColor(day, theme.colors);
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

