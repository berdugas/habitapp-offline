import { StyleSheet, View } from "react-native";

import { isoWeekday } from "@/features/habits/activeDays";
import { useTheme } from "@/theme/useTheme";
import { useThemedStyles } from "@/theme/useThemedStyles";
import { toDeviceDateString } from "@/utils/dates";
import { useTodayDateString } from "@/utils/dayBoundary";

import type { Colors } from "@/theme/contract";
import type { HeatmapLog } from "@/components/CalendarGrid";
import type { HabitLogStatus } from "@/features/habits/types";

const CELL_SIZE = 8;
const CELL_GAP = 2;
const MAX_DAYS = 30;

type CellState = "done" | "missed" | "skipped" | "off-day" | "today-pending" | "future";

type StripCell = {
  date: string;
  state: CellState;
};

export function buildStripCells(
  logs: HeatmapLog[],
  activeDays: number[],
  startDate: string,
  today: string,
  maxDays: number = MAX_DAYS,
): StripCell[] {
  const todayDate = new Date(`${today}T12:00:00`);

  // Show up to maxDays, but no earlier than startDate
  const windowStart = new Date(todayDate);
  windowStart.setDate(windowStart.getDate() - (maxDays - 1));
  const effectiveStart = startDate > today
    ? todayDate
    : new Date(`${startDate}T12:00:00`) > windowStart
      ? new Date(`${startDate}T12:00:00`)
      : windowStart;

  const logMap = new Map<string, HabitLogStatus>();
  for (const log of logs) {
    logMap.set(log.log_date, log.status);
  }

  const cells: StripCell[] = [];
  const d = new Date(effectiveStart);
  d.setHours(12, 0, 0, 0);

  while (toDeviceDateString(d) <= today) {
    const date = toDeviceDateString(d);
    const weekday = isoWeekday(d);
    const isActive = activeDays.includes(weekday);
    const logStatus = logMap.get(date);

    let state: CellState;
    if (!isActive) {
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
      state = "missed";
    }

    cells.push({ date, state });
    d.setDate(d.getDate() + 1);
  }

  return cells;
}

function dotStyle(state: CellState, colors: Colors): object {
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
      return { backgroundColor: colors.primarySoft };
    case "future":
      return { backgroundColor: "transparent" };
  }
}

type MiniHeatmapStripProps = {
  activeDays: number[];
  cellGap?: number;
  cellSize?: number;
  logs: HeatmapLog[];
  maxDays?: number;
  startDate: string;
};

export function MiniHeatmapStrip({
  activeDays,
  cellGap = CELL_GAP,
  cellSize = CELL_SIZE,
  logs,
  maxDays = MAX_DAYS,
  startDate,
}: MiniHeatmapStripProps) {
  const today = useTodayDateString();
  const cells = buildStripCells(logs, activeDays, startDate, today, maxDays);
  const { colors } = useTheme();
  const styles = useThemedStyles(() =>
    StyleSheet.create({
      dot: {
        borderRadius: 2,
      },
      strip: {
        flexDirection: "row" as const,
        flexWrap: "nowrap" as const,
        justifyContent: "flex-end" as const,
      },
    }),
  );

  return (
    <View style={[styles.strip, { gap: cellGap }]}>
      {cells.map((cell, i) => (
        <View
          key={i}
          style={[styles.dot, { height: cellSize, width: cellSize }, dotStyle(cell.state, colors)]}
        />
      ))}
    </View>
  );
}
