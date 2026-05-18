import { useState } from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";

import { Eyebrow } from "@/components/text/Eyebrow";
import { colors } from "@/theme/colors";
import { fontFamilies } from "@/theme/fontFamilies";
import { typography } from "@/theme/typography";
import { now, todayDateString } from "@/utils/clock";
import {
  addDeviceDays,
  daysBetweenDates,
  getWeekStartDate,
  toDeviceDateString,
} from "@/utils/dates";

import type { GoalDayState } from "@/features/today/goalMetrics";

type CellState =
  | "done"
  | "missed"
  | "skipped"
  | "off-day"
  | "today-pending"
  | "future";

type GoalStreakStripProps = {
  dailyStates: GoalDayState[];
  scope: "habit" | "goal";
  streak: number;
  startDate: string;
  onCellPress?: (date: string) => void;
};

const DAY_HEADERS = ["M", "T", "W", "T", "F", "S", "S"];
const MAX_ROWS = 4;
const WEEK_DAYS = 7;
const CELL_GAP = 4;
const PADDING_H = 12;
const MIN_CELL_SIZE = 20;
const MAX_CELL_SIZE = 36;
const FALLBACK_CONTAINER_WIDTH = 280;

function computeCellSize(measuredWidth: number): number {
  const w = measuredWidth > 0 ? measuredWidth : FALLBACK_CONTAINER_WIDTH;
  const contentW = w - PADDING_H * 2;
  const ideal = (contentW - CELL_GAP * (WEEK_DAYS - 1)) / WEEK_DAYS;
  return Math.min(MAX_CELL_SIZE, Math.max(MIN_CELL_SIZE, Math.floor(ideal)));
}

type Cell = { date: string; state: CellState };

function mapGoalDayState(state: GoalDayState): CellState {
  switch (state) {
    case "today":
      return "today-pending";
    case "off":
      return "off-day";
    case "pre-start":
      return "future";
    case "done":
    case "missed":
    case "skipped":
      return state;
  }
}

function buildCells(
  dailyStates: GoalDayState[],
  startDate: string,
  today: string,
): Cell[] {
  const todayDate = now();
  const currentMonday = getWeekStartDate(todayDate);
  const gridEndSunday = addDeviceDays(currentMonday, WEEK_DAYS - 1);
  const earliestAllowedMonday = addDeviceDays(
    currentMonday,
    -(MAX_ROWS - 1) * WEEK_DAYS,
  );
  const habitMonday = getWeekStartDate(new Date(`${startDate}T12:00:00`));
  const gridStartMonday =
    habitMonday < earliestAllowedMonday ? earliestAllowedMonday : habitMonday;

  const gridStartIso = toDeviceDateString(gridStartMonday);
  const gridEndIso = toDeviceDateString(gridEndSunday);
  const totalDays = daysBetweenDates(gridStartIso, gridEndIso) + 1;

  const cells: Cell[] = [];
  for (let i = 0; i < totalDays; i++) {
    const dIso = toDeviceDateString(addDeviceDays(gridStartMonday, i));

    let state: CellState;
    if (dIso < startDate) {
      state = "future";
    } else if (dIso > today) {
      state = "future";
    } else {
      const offsetFromToday = daysBetweenDates(dIso, today);
      const index = dailyStates.length - 1 - offsetFromToday;
      if (index < 0 || index >= dailyStates.length) {
        state = "future";
      } else {
        state = mapGoalDayState(dailyStates[index]);
      }
    }

    cells.push({ date: dIso, state });
  }

  return cells;
}

export function GoalStreakStrip({
  dailyStates,
  scope,
  streak,
  startDate,
  onCellPress,
}: GoalStreakStripProps) {
  const [measuredWidth, setMeasuredWidth] = useState(0);
  const today = todayDateString();
  const cells = buildCells(dailyStates, startDate, today);
  const rows = cells.length / WEEK_DAYS;
  const scopeLabel = scope === "habit" ? "Habit" : "Goal";
  const streakLabel = `${streak} day ${scopeLabel} streak`;
  const cellSize = computeCellSize(measuredWidth);
  const cellSizeStyle = { width: cellSize, height: cellSize };
  const headerCellStyle = { width: cellSize };

  function handlePress(cell: Cell) {
    if (!onCellPress) return;
    if (cell.state === "future") return;
    if (cell.state === "off-day") return;
    onCellPress(cell.date);
  }

  return (
    <View
      onLayout={(e) => setMeasuredWidth(e.nativeEvent.layout.width)}
      style={styles.container}
    >
      <View style={styles.header}>
        <Text style={styles.streakLabel}>{streakLabel}</Text>
        <Eyebrow label="Last 4 weeks" />
      </View>

      <View style={styles.headerRow}>
        {DAY_HEADERS.map((label, i) => (
          <View key={i} style={[styles.headerCell, headerCellStyle]}>
            <Text style={styles.headerText}>{label}</Text>
          </View>
        ))}
      </View>

      {Array.from({ length: rows }).map((_, row) => (
        <View key={row} style={styles.gridRow}>
          {Array.from({ length: WEEK_DAYS }).map((_, col) => {
            const cell = cells[row * WEEK_DAYS + col];
            const isToday = cell.date === today;
            const tappable =
              cell.state !== "future" && cell.state !== "off-day";

            return (
              <Pressable
                key={col}
                accessibilityLabel={`${cell.date}, ${
                  cell.state === "today-pending" ? "not logged" : cell.state
                }`}
                disabled={!tappable || !onCellPress}
                onPress={() => handlePress(cell)}
                style={({ pressed }) => [
                  styles.cell,
                  cellSizeStyle,
                  cellStyle(cell.state),
                  isToday &&
                    cell.state === "today-pending" &&
                    styles.cellTodayRing,
                  pressed && tappable && styles.cellPressed,
                ]}
                testID="goal-strip-block"
              />
            );
          })}
        </View>
      ))}

      <View style={styles.legend}>
        <LegendItem color={colors.heatDone} label="Done" />
        <LegendItem color={colors.heatSkipped} label="Skipped" />
        <LegendItem color={colors.heatMissed} label="Missed" border />
        <LegendItem outlined label="Off day" />
      </View>
    </View>
  );
}

function LegendItem({
  border,
  color,
  label,
  outlined,
}: {
  border?: boolean;
  color?: string;
  label: string;
  outlined?: boolean;
}) {
  return (
    <View style={styles.legendItem}>
      <View
        style={[
          styles.legendSwatch,
          color ? { backgroundColor: color } : undefined,
          border && styles.legendSwatchBorder,
          outlined && styles.legendSwatchOutlined,
        ]}
      />
      <Text style={styles.legendLabel}>{label}</Text>
    </View>
  );
}

function cellStyle(state: CellState): object {
  switch (state) {
    case "done":
      return { backgroundColor: colors.heatDone };
    case "skipped":
      return { backgroundColor: colors.heatSkipped };
    case "missed":
      return { backgroundColor: colors.heatMissed };
    case "off-day":
      return {
        backgroundColor: "transparent",
        borderColor: colors.offDayBorder,
        borderWidth: 1,
      };
    case "today-pending":
      return {
        backgroundColor: colors.primarySoft,
        borderColor: colors.primary,
        borderWidth: 2,
      };
    case "future":
      return { backgroundColor: "transparent" };
  }
}

const styles = StyleSheet.create({
  cell: {
    borderRadius: 6,
  },
  cellPressed: {
    opacity: 0.7,
  },
  cellTodayRing: {
    borderColor: colors.primary,
    borderWidth: 2,
  },
  container: {
    backgroundColor: colors.surface,
    borderRadius: 12,
    gap: CELL_GAP,
    paddingHorizontal: 12,
    paddingVertical: 12,
  },
  gridRow: {
    flexDirection: "row",
    gap: CELL_GAP,
  },
  header: {
    marginBottom: 8,
  },
  headerCell: {
    alignItems: "center",
  },
  headerRow: {
    flexDirection: "row",
    gap: CELL_GAP,
    marginBottom: 2,
  },
  headerText: {
    color: colors.textFaint,
    fontFamily: fontFamilies.body,
    fontSize: 11,
  },
  legend: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 12,
    marginTop: 8,
  },
  legendItem: {
    alignItems: "center",
    flexDirection: "row",
    gap: 4,
  },
  legendLabel: {
    color: colors.textFaint,
    fontFamily: fontFamilies.body,
    fontSize: 11,
  },
  legendSwatch: {
    borderRadius: 3,
    height: 12,
    width: 12,
  },
  legendSwatchBorder: {
    backgroundColor: colors.heatMissed,
    borderColor: colors.surfaceHigh,
    borderWidth: 1,
  },
  legendSwatchOutlined: {
    backgroundColor: "transparent",
    borderColor: colors.offDayBorder,
    borderWidth: 1,
  },
  streakLabel: {
    color: colors.primary,
    fontFamily: fontFamilies.bodySemi,
    fontSize: typography.bodyLg,
  },
});
