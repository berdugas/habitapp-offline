import { render, screen } from "@testing-library/react-native";

import { MiniHeatmapStrip, buildStripCells } from "@/components/MiniHeatmapStrip";
import { colors } from "@/theme/colors";
import { resetClockForTesting, setNowForTesting } from "@/utils/clock";

const ALL_DAYS = [1, 2, 3, 4, 5, 6, 7];
const NO_MONDAYS = [2, 3, 4, 5, 6, 7];

beforeEach(() => {
  // Today = Tuesday 2026-05-05
  setNowForTesting(new Date("2026-05-05T10:00:00.000Z"));
});
afterEach(() => {
  resetClockForTesting();
});

describe("buildStripCells", () => {
  it("shows cells from startDate to today when habit is < 30 days old", () => {
    // startDate = 10 days ago = Apr 25
    const cells = buildStripCells([], ALL_DAYS, "2026-04-25");
    // Apr 25 → May 5 = 11 days
    expect(cells).toHaveLength(11);
  });

  it("shows at most 30 cells for a habit older than 30 days", () => {
    const cells = buildStripCells([], ALL_DAYS, "2025-01-01");
    expect(cells).toHaveLength(30);
  });

  it("respects an explicit maxDays cap (14)", () => {
    const cells = buildStripCells([], ALL_DAYS, "2025-01-01", 14);
    expect(cells).toHaveLength(14);
  });

  it("returns fewer than maxDays when the habit is younger than maxDays", () => {
    // startDate = 3 days ago (May 2 → May 5 = 4 days)
    const cells = buildStripCells([], ALL_DAYS, "2026-05-02", 14);
    expect(cells.length).toBeLessThanOrEqual(14);
    expect(cells).toHaveLength(4);
  });

  it("marks a logged 'done' cell correctly", () => {
    const cells = buildStripCells(
      [{ log_date: "2026-05-04", status: "done" }],
      ALL_DAYS,
      "2026-05-04",
    );
    const cell = cells.find((c) => c.date === "2026-05-04");
    expect(cell?.state).toBe("done");
  });

  it("marks off-day cells correctly", () => {
    // No Mondays. May 5 is Tuesday, May 4 is Monday → off-day.
    const cells = buildStripCells([], NO_MONDAYS, "2026-05-04");
    const monday = cells.find((c) => c.date === "2026-05-04");
    expect(monday?.state).toBe("off-day");
  });
});

describe("MiniHeatmapStrip renders", () => {
  it("renders without crashing", () => {
    render(
      <MiniHeatmapStrip
        activeDays={ALL_DAYS}
        logs={[]}
        startDate="2026-04-25"
      />,
    );
    // Component renders without error
    expect(screen.toJSON()).not.toBeNull();
  });
});
