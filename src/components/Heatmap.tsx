import { Pressable, StyleSheet, View } from "react-native";

import { colors } from "@/theme/colors";
import { todayDateString } from "@/utils/clock";
import { addDeviceDays, toDeviceDateString } from "@/utils/dates";

import type { HabitLogStatus } from "@/features/habits/types";

export type HeatmapLog = {
  log_date: string; // YYYY-MM-DD device-local
  status: HabitLogStatus; // "done" | "skipped" | "missed"
};

type HeatmapProps = {
  days: 30 | 90;
  logs: HeatmapLog[];
  onCellPress?: (date: string) => void;
};

const GRID_CONFIG: Record<30 | 90, { rows: number; cols: number; cellSize: number }> = {
  30: { rows: 5, cols: 6, cellSize: 36 },
  90: { rows: 9, cols: 10, cellSize: 28 },
};

const CELL_GAP = 4;

export function Heatmap({ days, logs, onCellPress }: HeatmapProps) {
  const { rows, cols, cellSize } = GRID_CONFIG[days];
  const today = todayDateString();

  const statusByDate = new Map<string, HabitLogStatus>();
  for (const log of logs) {
    statusByDate.set(log.log_date, log.status);
  }

  // Oldest first (top-left), today last (bottom-right).
  const dates: string[] = [];
  for (let i = days - 1; i >= 0; i--) {
    dates.push(toDeviceDateString(addDeviceDays(new Date(), -i)));
  }

  return (
    <View style={[styles.grid, { gap: CELL_GAP }]}>
      {Array.from({ length: rows }).map((_, rowIdx) => (
        <View key={rowIdx} style={[styles.row, { gap: CELL_GAP }]}>
          {Array.from({ length: cols }).map((__, colIdx) => {
            const cellIdx = rowIdx * cols + colIdx;
            if (cellIdx >= dates.length) {
              return <View key={colIdx} style={{ width: cellSize, height: cellSize }} />;
            }
            const date = dates[cellIdx];
            const status = statusByDate.get(date) ?? null;
            const isToday = date === today;

            const cellStyle = [
              styles.cell,
              { width: cellSize, height: cellSize, backgroundColor: getCellColor(status) },
              isToday && status === null ? styles.todayOutline : null,
            ];

            if (onCellPress) {
              return (
                <Pressable
                  accessibilityLabel={getCellAccessibilityLabel(date, status, isToday)}
                  accessibilityRole="button"
                  key={colIdx}
                  onPress={() => onCellPress(date)}
                  style={cellStyle}
                />
              );
            }
            return (
              <View
                accessibilityLabel={getCellAccessibilityLabel(date, status, isToday)}
                key={colIdx}
                style={cellStyle}
              />
            );
          })}
        </View>
      ))}
    </View>
  );
}

function getCellColor(status: HabitLogStatus | null): string {
  if (status === "done") return colors.heatDone;
  if (status === "skipped") return colors.heatSkipped;
  return colors.heatMissed;
}

function getCellAccessibilityLabel(
  date: string,
  status: HabitLogStatus | null,
  isToday: boolean,
): string {
  const datePart = isToday ? "Today" : date;
  if (status === null) return `${datePart}, not logged`;
  return `${datePart}, ${status}`;
}

const styles = StyleSheet.create({
  cell: {
    borderRadius: 4,
  },
  grid: {
    alignSelf: "center",
  },
  row: {
    flexDirection: "row",
  },
  todayOutline: {
    borderWidth: 2,
  },
});
