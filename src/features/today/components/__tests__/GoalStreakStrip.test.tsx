import { fireEvent, render, screen } from "@testing-library/react-native";

import { GoalStreakStrip } from "@/features/today/components/GoalStreakStrip";
import { colors } from "@/theme/colors";
import { resetClockForTesting, setNowForTesting } from "@/utils/clock";

import type { GoalDayState } from "@/features/today/goalMetrics";

// Pin to Monday 2026-05-18 10:00 device-local so the grid math is deterministic.
// Monday means today's row is the first cell of the week, and `getWeekStartDate`
// returns today itself.
const TODAY_ISO = "2026-05-18";

beforeEach(() => {
  setNowForTesting(new Date(`${TODAY_ISO}T10:00:00`));
});
afterEach(() => {
  resetClockForTesting();
});

// Build a 28-length dailyStates array, oldest first, newest (today) last.
function states(...entries: GoalDayState[]): GoalDayState[] {
  const out = [...entries];
  while (out.length < 28) out.unshift("off");
  return out;
}

// Match cells by the rendered accessibilityLabel suffix.
// Suffix must be one of CalendarGrid's tokens: "done" | "missed" | "skipped" |
// "off-day" | "not logged" | "future" — NOT raw GoalDayState tokens.
function blocksByState(suffix: string) {
  const tail = `, ${suffix}`;
  return screen
    .getAllByTestId("goal-strip-block")
    .filter((b) => String(b.props.accessibilityLabel ?? "").endsWith(tail));
}

describe("GoalStreakStrip", () => {
  it("renders one row of 7 cells when startDate === today (Monday)", () => {
    render(
      <GoalStreakStrip
        dailyStates={states("today")}
        scope="goal"
        startDate={TODAY_ISO}
        streak={0}
      />,
    );
    expect(screen.getAllByTestId("goal-strip-block")).toHaveLength(7);
  });

  it("renders 4 rows (28 cells) when startDate is 4+ weeks back", () => {
    render(
      <GoalStreakStrip
        dailyStates={states("today")}
        scope="goal"
        startDate="2026-01-01"
        streak={0}
      />,
    );
    expect(screen.getAllByTestId("goal-strip-block")).toHaveLength(28);
  });

  it("renders the eyebrow 'LAST 4 WEEKS'", () => {
    render(
      <GoalStreakStrip
        dailyStates={states("today")}
        scope="goal"
        startDate={TODAY_ISO}
        streak={3}
      />,
    );
    expect(screen.getByText("LAST 4 WEEKS")).toBeTruthy();
  });

  it("renders streak count for streak >= 2", () => {
    render(
      <GoalStreakStrip
        dailyStates={states("today")}
        scope="goal"
        startDate={TODAY_ISO}
        streak={12}
      />,
    );
    expect(screen.getByText("12 day Goal streak")).toBeTruthy();
  });

  it("uses singular grammar for streak === 1", () => {
    render(
      <GoalStreakStrip
        dailyStates={states("today")}
        scope="goal"
        startDate={TODAY_ISO}
        streak={1}
      />,
    );
    expect(screen.getByText("1 day Goal streak")).toBeTruthy();
  });

  it("done state renders with heatDone background", () => {
    // dailyStates[27] = "done" → today's cell renders as 'done' (no special
    // today-pending styling because the input state says "done").
    render(
      <GoalStreakStrip
        dailyStates={states("done")}
        scope="goal"
        startDate={TODAY_ISO}
        streak={1}
      />,
    );
    const doneBlocks = blocksByState("done");
    expect(doneBlocks).toHaveLength(1);
    const style = doneBlocks[0].props.style;
    const flat = Array.isArray(style) ? Object.assign({}, ...style) : style;
    expect(flat.backgroundColor).toBe(colors.heatDone);
  });

  it("today-pending cell uses primarySoft fill with primary border", () => {
    render(
      <GoalStreakStrip
        dailyStates={states("today")}
        scope="goal"
        startDate={TODAY_ISO}
        streak={0}
      />,
    );
    const todayBlocks = blocksByState("not logged");
    expect(todayBlocks).toHaveLength(1);
    const style = todayBlocks[0].props.style;
    const flat = Array.isArray(style) ? Object.assign({}, ...style) : style;
    expect(flat.backgroundColor).toBe(colors.primarySoft);
    expect(flat.borderColor).toBe(colors.primary);
  });

  it("renders dates before startDate as 'future' cells (no separate pre-start)", () => {
    // Today pinned to Monday 2026-05-18. Same week's grid: Mon..Sun = 5/18..5/24.
    // startDate = Wed 2026-05-20 → Mon (5/18) and Tue (5/19) are before
    // startDate; the strip MUST render those as "future", not "pre-start".
    // 5/20 onward is in the future relative to today (Mon), so they also render
    // as "future" via the dIso > today branch — that's fine; we only assert
    // the dates < startDate path.
    setNowForTesting(new Date("2026-05-18T10:00:00"));
    render(
      <GoalStreakStrip
        dailyStates={Array(28).fill("done") as GoalDayState[]}
        scope="goal"
        startDate="2026-05-20"
        streak={0}
      />,
    );
    expect(screen.getByLabelText("2026-05-18, future")).toBeTruthy();
    expect(screen.getByLabelText("2026-05-19, future")).toBeTruthy();
    // No bare-state "pre-start" label anywhere
    expect(screen.queryByLabelText("2026-05-18, pre-start")).toBeNull();
  });

  it("uses 'not logged' label for the today-pending cell (not 'today')", () => {
    render(
      <GoalStreakStrip
        dailyStates={states("today")}
        scope="goal"
        startDate={TODAY_ISO}
        streak={0}
      />,
    );
    expect(screen.getByLabelText(`${TODAY_ISO}, not logged`)).toBeTruthy();
    expect(screen.queryByLabelText(`${TODAY_ISO}, today`)).toBeNull();
    expect(screen.queryByLabelText(`${TODAY_ISO}, today-pending`)).toBeNull();
  });

  it("calls onCellPress with the date string when a past on-duty cell is tapped", () => {
    // Today = Sunday 5/24 so the whole current week is in the past or today.
    setNowForTesting(new Date("2026-05-24T10:00:00"));
    const onCellPress = jest.fn();
    const arr = Array(28).fill("off") as GoalDayState[];
    arr[27] = "today"; // Sun 5/24
    arr[26] = "done"; // Sat 5/23
    render(
      <GoalStreakStrip
        dailyStates={arr}
        onCellPress={onCellPress}
        scope="goal"
        startDate="2026-05-18"
        streak={1}
      />,
    );
    fireEvent.press(screen.getByLabelText("2026-05-23, done"));
    expect(onCellPress).toHaveBeenCalledWith("2026-05-23");
  });

  it("does not fire onCellPress for future or off-day cells", () => {
    setNowForTesting(new Date("2026-05-18T10:00:00"));
    const onCellPress = jest.fn();
    const arr = Array(28).fill("off") as GoalDayState[];
    arr[27] = "today";
    render(
      <GoalStreakStrip
        dailyStates={arr}
        onCellPress={onCellPress}
        scope="goal"
        startDate={TODAY_ISO}
        streak={0}
      />,
    );
    // Future cells (later in the week) are disabled — pressing should be a no-op
    fireEvent.press(screen.getByLabelText("2026-05-24, future"));
    expect(onCellPress).not.toHaveBeenCalled();
  });
});
