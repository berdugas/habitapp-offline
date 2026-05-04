import { Pressable, StyleSheet, Text, View } from "react-native";

import { isoWeekday } from "@/features/habits/activeDays";
import { colors } from "@/theme/colors";
import { fontFamilies } from "@/theme/fontFamilies";
import { todayDateString } from "@/utils/clock";
import { addDeviceDays, toDeviceDateString } from "@/utils/dates";

import type { HabitLogStatus } from "@/features/habits/types";

export type HeatmapLog = {
  log_date: string;
  status: HabitLogStatus;
};

type CellState = "done" | "missed" | "skipped" | "off-day" | "today-pending" | "future" | "empty";

type CalendarCell = {
  date: string;
  state: CellState;
};

type CalendarGridProps = {
  activeDays: number[];
  logs: HeatmapLog[];
  onCellPress?: (date: string) => void;
};

const DAY_HEADERS = ["M", "T", "W", "T", "F", "S", "S"];

function buildGrid(
  logs: HeatmapLog[],
  activeDays: number[],
): CalendarCell[] {
  const today = todayDateString();
  const todayDate = new Date(`${today}T12:00:00`);
  const todayWeekday = isoWeekday(todayDate); // Mon=1 … Sun=7

  // Monday of current week
  const startOfCurrentWeek = addDeviceDays(todayDate, -(todayWeekday - 1));
  // Monday 4 weeks earlier = start of 5-week grid
  const gridStart = addDeviceDays(startOfCurrentWeek, -28);

  const logMap = new Map<string, HabitLogStatus>();
  for (const log of logs) {
    logMap.set(log.log_date, log.status);
  }

  const cells: CalendarCell[] = [];

  for (let i = 0; i < 35; i++) {
    const date = toDeviceDateString(addDeviceDays(gridStart, i));
    const weekday = isoWeekday(new Date(`${date}T12:00:00`)); // Mon=1
    const isActive = activeDays.includes(weekday);
    const logStatus = logMap.get(date);

    let state: CellState;

    if (date > today) {
      state = "future";
    } else if (!isActive) {
      state = "off-day";
    } else if (date === today && !logStatus) {
      state = "today-pending";
    } else if (logStatus === "done") {
      state = "done";
    } else if (logStatus === "skipped") {
      state = "skipped";
    } else if (logStatus === "missed") {
      state = "missed";
    } else {
      // Past active day, no log = missed
      state = "missed";
    }

    cells.push({ date, state });
  }

  return cells;
}

export function CalendarGrid({ activeDays, logs, onCellPress }: CalendarGridProps) {
  const cells = buildGrid(logs, activeDays);
  const today = todayDateString();

  function handlePress(cell: CalendarCell) {
    if (!onCellPress) return;
    if (cell.state === "future") return;
    if (cell.state === "off-day") return;
    onCellPress(cell.date);
  }

  return (
    <View style={styles.container}>
      {/* Day headers */}
      <View style={styles.headerRow}>
        {DAY_HEADERS.map((label, i) => (
          <View key={i} style={styles.headerCell}>
            <Text style={styles.headerText}>{label}</Text>
          </View>
        ))}
      </View>

      {/* 5 rows × 7 cols */}
      {Array.from({ length: 5 }).map((_, row) => (
        <View key={row} style={styles.gridRow}>
          {Array.from({ length: 7 }).map((_, col) => {
            const cell = cells[row * 7 + col];
            const isToday = cell.date === today;
            const tappable = cell.state !== "future" && cell.state !== "off-day";

            return (
              <Pressable
                key={col}
                accessibilityLabel={`${cell.date}, ${cell.state === "today-pending" ? "not logged" : cell.state === "missed" && cell.date > today ? "future" : cell.state}`}
                disabled={!tappable || !onCellPress}
                onPress={() => handlePress(cell)}
                style={({ pressed }) => [
                  styles.cell,
                  cellStyle(cell.state),
                  isToday && cell.state === "today-pending" && styles.cellTodayRing,
                  pressed && tappable && styles.cellPressed,
                ]}
              />
            );
          })}
        </View>
      ))}

      {/* Legend */}
      <View style={styles.legend}>
        <LegendItem color={colors.heatDone} label="Done" />
        <LegendItem color={colors.heatSkipped} label="Skipped" />
        <LegendItem color={colors.heatMissed} label="Missed" border />
        <LegendItem dashed label="Off day" />
      </View>
    </View>
  );
}

function LegendItem({
  border,
  color,
  dashed,
  label,
}: {
  border?: boolean;
  color?: string;
  dashed?: boolean;
  label: string;
}) {
  return (
    <View style={styles.legendItem}>
      <View
        style={[
          styles.legendSwatch,
          color ? { backgroundColor: color } : undefined,
          border && styles.legendSwatchBorder,
          dashed && styles.legendSwatchDashed,
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
        borderColor: colors.textFaint,
        borderStyle: "dashed" as const,
        borderWidth: 1,
        opacity: 0.4,
      };
    case "today-pending":
      return {
        backgroundColor: colors.primarySoft,
        borderColor: colors.primary,
        borderWidth: 2,
      };
    case "future":
      return { backgroundColor: "transparent" };
    default:
      return { backgroundColor: colors.heatMissed };
  }
}

const CELL_SIZE = 36;
const CELL_GAP = 4;

const styles = StyleSheet.create({
  cell: {
    borderRadius: 6,
    height: CELL_SIZE,
    width: CELL_SIZE,
  },
  cellPressed: {
    opacity: 0.7,
  },
  cellTodayRing: {
    borderColor: colors.primary,
    borderWidth: 2,
  },
  container: {
    gap: CELL_GAP,
  },
  gridRow: {
    flexDirection: "row",
    gap: CELL_GAP,
  },
  headerCell: {
    alignItems: "center",
    width: CELL_SIZE,
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
  legendSwatchDashed: {
    backgroundColor: "transparent",
    borderColor: colors.textFaint,
    borderStyle: "dashed",
    borderWidth: 1,
  },
});
