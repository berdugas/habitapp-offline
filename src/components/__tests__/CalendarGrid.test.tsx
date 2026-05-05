import { render, screen } from "@testing-library/react-native";

import { buildGrid, CalendarGrid } from "@/components/CalendarGrid";
import { colors } from "@/theme/colors";
import { resetClockForTesting, setNowForTesting } from "@/utils/clock";

// Today is Tuesday 2026-05-05 in UTC test env
const TODAY = "2026-05-05";
// Monday of current week
const THIS_MONDAY = "2026-05-04";
// Previous Monday (8 days ago)
const PREV_MONDAY = "2026-04-27";
// Monday 4 weeks before THIS_MONDAY → Apr 6
const FOUR_WEEKS_AGO_MONDAY = "2026-04-06";

const ALL_DAYS = [1, 2, 3, 4, 5, 6, 7];
// Tuesday–Sunday (no Mondays)
const NO_MONDAYS = [2, 3, 4, 5, 6, 7];

beforeEach(() => {
  setNowForTesting(new Date("2026-05-05T10:00:00.000Z"));
});
afterEach(() => {
  resetClockForTesting();
});

describe("buildGrid — startDate mode", () => {
  it("day-1 start: startDate = today → 1 row (7 cells)", () => {
    const cells = buildGrid([], ALL_DAYS, TODAY);
    expect(cells).toHaveLength(7);
  });

  it("startDate = last Monday → 2 rows (14 cells)", () => {
    const cells = buildGrid([], ALL_DAYS, PREV_MONDAY);
    expect(cells).toHaveLength(14);
  });

  it("startDate = ~4 weeks ago Monday → 5 rows (35 cells)", () => {
    const cells = buildGrid([], ALL_DAYS, FOUR_WEEKS_AGO_MONDAY);
    expect(cells).toHaveLength(35);
  });

  it("cells before startDate have state 'future'", () => {
    // startDate = today (Tuesday). gridStart = Monday of this week = May 4.
    // May 4 < May 5 (startDate) → state should be "future"
    const cells = buildGrid([], ALL_DAYS, TODAY);
    const monday = cells.find((c) => c.date === THIS_MONDAY);
    expect(monday).toBeDefined();
    expect(monday!.state).toBe("future");
  });

  it("today itself is 'today-pending' when startDate = today and today is active", () => {
    const cells = buildGrid([], ALL_DAYS, TODAY);
    const today = cells.find((c) => c.date === TODAY);
    expect(today).toBeDefined();
    expect(today!.state).toBe("today-pending");
  });
});

describe("buildGrid — fixed-window fallback", () => {
  it("no startDate → 5 rows (35 cells, backward compat)", () => {
    const cells = buildGrid([], ALL_DAYS);
    expect(cells).toHaveLength(35);
  });
});

describe("off-day cell style", () => {
  it("off-day cell uses solid offDayBorder color, not dashed", () => {
    // Monday (weekday 1) is off-day when activeDays excludes 1
    render(<CalendarGrid activeDays={NO_MONDAYS} logs={[]} />);

    // Find any off-day cell. Without startDate the grid includes many Mondays.
    const offDayCells = screen.queryAllByLabelText(/off-day/);
    expect(offDayCells.length).toBeGreaterThan(0);

    const cell = offDayCells[0];
    // Flatten all style objects applied to this element
    const styleArr = (cell.props.style as Array<object>).flat().filter(Boolean);
    const merged = Object.assign({}, ...styleArr);

    expect(merged.borderColor).toBe(colors.offDayBorder);
    expect(merged.borderStyle).toBeUndefined();
    expect(merged.opacity).toBeUndefined();
  });
});
