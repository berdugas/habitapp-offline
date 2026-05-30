import { Pressable, StyleSheet, Text, View } from "react-native";

import { isoWeekday } from "@/features/habits/activeDays";
import { useTheme } from "@/theme/useTheme";
import { useThemedStyles } from "@/theme/useThemedStyles";
import { addDeviceDays, toDeviceDateString } from "@/utils/dates";
import { useTodayDateString } from "@/utils/dayBoundary";

import type { Colors, Theme } from "@/theme/contract";
import type { HabitLogStatus } from "@/features/habits/types";

export type HeatmapLog = {
  log_date: string;
  status: HabitLogStatus;
};

type CellState = "done" | "missed" | "skipped" | "off-day" | "today-pending" | "future";

export type CalendarCell = {
  date: string;
  state: CellState;
};

type CalendarGridProps = {
  activeDays: number[];
  logs: HeatmapLog[];
  onCellPress?: (date: string) => void;
  startDate?: string;
};

const DAY_HEADERS = ["M", "T", "W", "T", "F", "S", "S"];

export function buildGrid(
  logs: HeatmapLog[],
  activeDays: number[],
  startDate: string | undefined,
  today: string,
): CalendarCell[] {
  const todayDate = new Date(`${today}T12:00:00`);
  const todayWeekday = isoWeekday(todayDate); // Mon=1 … Sun=7

  let gridStart: Date;
  let totalCells: number;

  if (startDate) {
    // Start on Monday of the week containing startDate
    const startDateObj = new Date(`${startDate}T12:00:00`);
    const startWeekday = isoWeekday(startDateObj);
    gridStart = addDeviceDays(startDateObj, -(startWeekday - 1));

    // End on Sunday of the current week
    const endOfCurrentWeek = addDeviceDays(todayDate, 7 - todayWeekday);

    // Days between gridStart and end-of-current-week (inclusive)
    const diffMs = endOfCurrentWeek.getTime() - gridStart.getTime();
    const diffDays = Math.round(diffMs / (1000 * 60 * 60 * 24)) + 1;

    // Round up to full weeks
    const rows = Math.ceil(diffDays / 7);
    totalCells = rows * 7;
  } else {
    // Fixed 5-week window ending at Sunday of current week (backward compat)
    const startOfCurrentWeek = addDeviceDays(todayDate, -(todayWeekday - 1));
    gridStart = addDeviceDays(startOfCurrentWeek, -28);
    totalCells = 35;
  }

  const logMap = new Map<string, HabitLogStatus>();
  for (const log of logs) {
    logMap.set(log.log_date, log.status);
  }

  const cells: CalendarCell[] = [];

  for (let i = 0; i < totalCells; i++) {
    const date = toDeviceDateString(addDeviceDays(gridStart, i));
    const weekday = isoWeekday(new Date(`${date}T12:00:00`)); // Mon=1
    const isActive = activeDays.includes(weekday);
    const logStatus = logMap.get(date);

    let state: CellState;

    // Cells before startDate: treat as empty padding
    if (startDate && date < startDate) {
      state = "future";
    } else if (date > today) {
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

function cellStyle(state: CellState, colors: Colors): object {
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

const CELL_SIZE = 36;
const CELL_GAP = 4;

function buildGridStyles(theme: Theme) {
  return StyleSheet.create({
    cell: {
      borderRadius: 6,
      height: CELL_SIZE,
      width: CELL_SIZE,
    },
    cellPressed: {
      opacity: 0.7,
    },
    cellTodayRing: {
      borderColor: theme.colors.primary,
      borderWidth: 2,
    },
    container: {
      gap: CELL_GAP,
    },
    gridRow: {
      flexDirection: "row" as const,
      gap: CELL_GAP,
    },
    headerCell: {
      alignItems: "center" as const,
      width: CELL_SIZE,
    },
    headerRow: {
      flexDirection: "row" as const,
      gap: CELL_GAP,
      marginBottom: 2,
    },
    headerText: {
      color: theme.colors.textFaint,
      fontFamily: theme.fontFamilies.body,
      fontSize: theme.typography.micro,
    },
    legend: {
      flexDirection: "row" as const,
      flexWrap: "wrap" as const,
      gap: 12,
      marginTop: 8,
    },
    legendItem: {
      alignItems: "center" as const,
      flexDirection: "row" as const,
      gap: 4,
    },
    legendLabel: {
      color: theme.colors.textFaint,
      fontFamily: theme.fontFamilies.body,
      fontSize: theme.typography.micro,
    },
    legendSwatch: {
      borderRadius: 3,
      height: 12,
      width: 12,
    },
    legendSwatchBorder: {
      backgroundColor: theme.colors.heatMissed,
      borderColor: theme.colors.surfaceHigh,
      borderWidth: 1,
    },
    legendSwatchOutlined: {
      backgroundColor: "transparent",
      borderColor: theme.colors.offDayBorder,
      borderWidth: 1,
    },
  });
}

type GridStyles = ReturnType<typeof buildGridStyles>;

export function CalendarGrid({ activeDays, logs, onCellPress, startDate }: CalendarGridProps) {
  const today = useTodayDateString();
  const cells = buildGrid(logs, activeDays, startDate, today);
  const rows = cells.length / 7;
  const { colors } = useTheme();
  const styles = useThemedStyles(buildGridStyles);

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

      {/* Dynamic rows */}
      {Array.from({ length: rows }).map((_, row) => (
        <View key={row} style={styles.gridRow}>
          {Array.from({ length: 7 }).map((_, col) => {
            const cell = cells[row * 7 + col];
            const isToday = cell.date === today;
            const tappable = cell.state !== "future" && cell.state !== "off-day";

            return (
              <Pressable
                key={col}
                accessibilityLabel={`${cell.date}, ${cell.state === "today-pending" ? "not logged" : cell.state}`}
                disabled={!tappable || !onCellPress}
                onPress={() => handlePress(cell)}
                style={({ pressed }) => [
                  styles.cell,
                  cellStyle(cell.state, colors),
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
        <LegendItem color={colors.heatDone} label="Done" styles={styles} />
        <LegendItem color={colors.heatSkipped} label="Skipped" styles={styles} />
        <LegendItem color={colors.heatMissed} label="Missed" border styles={styles} />
        <LegendItem outlined label="Off day" styles={styles} />
      </View>
    </View>
  );
}

function LegendItem({
  border,
  color,
  label,
  outlined,
  styles,
}: {
  border?: boolean;
  color?: string;
  label: string;
  outlined?: boolean;
  styles: GridStyles;
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
