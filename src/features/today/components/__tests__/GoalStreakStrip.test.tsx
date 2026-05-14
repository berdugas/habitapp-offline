import { render, screen } from "@testing-library/react-native";

import { GoalStreakStrip } from "@/features/today/components/GoalStreakStrip";
import { colors } from "@/theme/colors";

import type { GoalDayState } from "@/features/today/goalMetrics";

function states(...entries: GoalDayState[]): GoalDayState[] {
  const out = [...entries];
  while (out.length < 14) out.unshift("off");
  return out;
}

function blocksByState(state: GoalDayState) {
  return screen
    .getAllByTestId("goal-strip-block")
    .filter((b) => b.props.accessibilityLabel === state);
}

describe("GoalStreakStrip", () => {
  it("renders exactly 14 blocks", () => {
    render(<GoalStreakStrip dailyStates={states("done")} streak={1} />);
    expect(screen.getAllByTestId("goal-strip-block")).toHaveLength(14);
  });

  it("renders the eyebrow 'LAST 14 DAYS'", () => {
    render(<GoalStreakStrip dailyStates={states("done")} streak={3} />);
    expect(screen.getByText("LAST 14 DAYS")).toBeTruthy();
  });

  it("renders streak count for streak >= 2", () => {
    render(<GoalStreakStrip dailyStates={states("done")} streak={12} />);
    expect(screen.getByText("12 day streak")).toBeTruthy();
  });

  it("uses singular grammar for streak === 1", () => {
    render(<GoalStreakStrip dailyStates={states("done")} streak={1} />);
    expect(screen.getByText("1 day streak")).toBeTruthy();
  });

  it("done block uses heatDone color", () => {
    render(<GoalStreakStrip dailyStates={states("done")} streak={1} />);
    const doneBlocks = blocksByState("done");
    expect(doneBlocks.length).toBeGreaterThan(0);
    const style = doneBlocks[0].props.style;
    const flat = Array.isArray(style) ? Object.assign({}, ...style) : style;
    expect(flat.backgroundColor).toBe(colors.heatDone);
  });

  it("today block uses primarySoft fill with primary border", () => {
    render(<GoalStreakStrip dailyStates={states("today")} streak={0} />);
    const todayBlocks = blocksByState("today");
    expect(todayBlocks).toHaveLength(1);
    const style = todayBlocks[0].props.style;
    const flat = Array.isArray(style) ? Object.assign({}, ...style) : style;
    expect(flat.backgroundColor).toBe(colors.primarySoft);
    expect(flat.borderColor).toBe(colors.primary);
  });

  it("renders the expected count of pre-start blocks", () => {
    const arr: GoalDayState[] = Array(14).fill("pre-start");
    arr[13] = "today";
    render(<GoalStreakStrip dailyStates={arr} streak={1} />);
    expect(blocksByState("pre-start")).toHaveLength(13);
  });
});
