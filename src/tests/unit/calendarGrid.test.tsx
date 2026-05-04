import { fireEvent, render, screen } from "@testing-library/react-native";
import React from "react";

import { CalendarGrid } from "@/components/CalendarGrid";
import { resetClockForTesting, setNowForTesting } from "@/utils/clock";

// TODAY = 2026-04-23 (Thursday, ISO weekday 4 → column index 3 in Mon-based grid)
// Grid start = Monday of current week - 4 weeks = 2026-03-30 (Mon)

beforeEach(() => {
  setNowForTesting(new Date("2026-04-23T10:00:00"));
});

afterEach(() => {
  resetClockForTesting();
});

describe("CalendarGrid — cell count and layout", () => {
  it("renders exactly 35 cells (5 weeks × 7 days)", () => {
    render(<CalendarGrid activeDays={[1, 2, 3, 4, 5, 6, 7]} logs={[]} />);
    // Each cell has an accessibilityLabel like "2026-04-23, missed"
    const cells = screen.getAllByLabelText(/^\d{4}-\d{2}-\d{2},/);
    expect(cells).toHaveLength(35);
  });

  it("today (Apr 23, Thu) has 'not logged' accessibility label when unlogged", () => {
    render(<CalendarGrid activeDays={[1, 2, 3, 4, 5, 6, 7]} logs={[]} />);
    // Today with no log: state="today-pending" → label shows "not logged"
    expect(screen.getByLabelText("2026-04-23, not logged")).toBeTruthy();
  });
});

describe("CalendarGrid — cell states", () => {
  it("done log → done cell", () => {
    render(
      <CalendarGrid
        activeDays={[1, 2, 3, 4, 5, 6, 7]}
        logs={[{ log_date: "2026-04-22", status: "done" }]}
      />,
    );
    expect(screen.getByLabelText("2026-04-22, done")).toBeTruthy();
  });

  it("skipped log → skipped cell", () => {
    render(
      <CalendarGrid
        activeDays={[1, 2, 3, 4, 5, 6, 7]}
        logs={[{ log_date: "2026-04-22", status: "skipped" }]}
      />,
    );
    expect(screen.getByLabelText("2026-04-22, skipped")).toBeTruthy();
  });

  it("past active day with no log → missed cell", () => {
    render(<CalendarGrid activeDays={[1, 2, 3, 4, 5, 6, 7]} logs={[]} />);
    expect(screen.getByLabelText("2026-04-22, missed")).toBeTruthy();
  });

  it("off-day cell has 'off-day' accessibility label", () => {
    // Apr 19 = Sun (7); active days = weekdays only
    render(
      <CalendarGrid
        activeDays={[1, 2, 3, 4, 5]}
        logs={[]}
        onCellPress={jest.fn()}
      />,
    );
    expect(screen.getByLabelText("2026-04-19, off-day")).toBeTruthy();
  });

  it("future cells have 'future' accessibility label", () => {
    // Apr 24 is tomorrow (future)
    render(
      <CalendarGrid
        activeDays={[1, 2, 3, 4, 5, 6, 7]}
        logs={[]}
        onCellPress={jest.fn()}
      />,
    );
    expect(screen.getByLabelText("2026-04-24, future")).toBeTruthy();
  });
});

describe("CalendarGrid — interaction", () => {
  it("tapping an active past cell calls onCellPress with the date", () => {
    const onPress = jest.fn();
    render(
      <CalendarGrid
        activeDays={[1, 2, 3, 4, 5, 6, 7]}
        logs={[]}
        onCellPress={onPress}
      />,
    );
    fireEvent.press(screen.getByLabelText("2026-04-22, missed"));
    expect(onPress).toHaveBeenCalledWith("2026-04-22");
  });

  it("tapping an off-day cell does NOT call onCellPress", () => {
    const onPress = jest.fn();
    render(
      <CalendarGrid
        activeDays={[1, 2, 3, 4, 5]}
        logs={[]}
        onCellPress={onPress}
      />,
    );
    fireEvent.press(screen.getByLabelText("2026-04-19, off-day"));
    expect(onPress).not.toHaveBeenCalled();
  });

  it("tapping a future cell does NOT call onCellPress", () => {
    const onPress = jest.fn();
    render(
      <CalendarGrid
        activeDays={[1, 2, 3, 4, 5, 6, 7]}
        logs={[]}
        onCellPress={onPress}
      />,
    );
    fireEvent.press(screen.getByLabelText("2026-04-24, future"));
    expect(onPress).not.toHaveBeenCalled();
  });
});
