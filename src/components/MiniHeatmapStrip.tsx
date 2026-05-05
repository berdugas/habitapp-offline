import { StyleSheet, View } from "react-native";

import { isoWeekday } from "@/features/habits/activeDays";
import { colors } from "@/theme/colors";
import { todayDateString } from "@/utils/clock";
import { toDeviceDateString } from "@/utils/dates";

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
): StripCell[] {
  const today = todayDateString();
  const todayDate = new Date(`${today}T12:00:00`);

  // Show up to MAX_DAYS, but no earlier than startDate
  const windowStart = new Date(todayDate);
  windowStart.setDate(windowStart.getDate() - (MAX_DAYS - 1));
  const effectiveStart = startDate > todayDateString()
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

function dotStyle(state: CellState): object {
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
  logs: HeatmapLog[];
  startDate: string;
};

export function MiniHeatmapStrip({ activeDays, logs, startDate }: MiniHeatmapStripProps) {
  const cells = buildStripCells(logs, activeDays, startDate);

  return (
    <View style={styles.strip}>
      {cells.map((cell, i) => (
        <View key={i} style={[styles.dot, dotStyle(cell.state)]} />
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  dot: {
    borderRadius: 2,
    height: CELL_SIZE,
    width: CELL_SIZE,
  },
  strip: {
    flexDirection: "row",
    flexWrap: "nowrap",
    gap: CELL_GAP,
    justifyContent: "flex-end",
  },
});
