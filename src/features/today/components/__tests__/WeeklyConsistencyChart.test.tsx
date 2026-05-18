import { render, screen } from "@testing-library/react-native";

import { WeeklyConsistencyChart } from "@/features/today/components/WeeklyConsistencyChart";

describe("WeeklyConsistencyChart", () => {
  it("renders null when given 0 data points", () => {
    const { toJSON } = render(<WeeklyConsistencyChart scope="habit" weeklyData={[]} />);
    expect(toJSON()).toBeNull();
  });

  it("renders a single dot (no line/area) when given 1 data point", () => {
    render(
      <WeeklyConsistencyChart
        scope="habit"
        weeklyData={[{ weekLabel: "W1", rate: 0.5 }]}
      />,
    );
    expect(screen.getByText("Weekly Habit Consistency")).toBeTruthy();
    const circles = screen.UNSAFE_root.findAll(
      (n: { type: unknown }) =>
        typeof n.type === "string" && n.type === "RNSVGCircle",
    );
    expect(circles).toHaveLength(1);
    const paths = screen.UNSAFE_root.findAll(
      (n: { type: unknown }) =>
        typeof n.type === "string" && n.type === "RNSVGPath",
    );
    expect(paths).toHaveLength(0);
  });

  it("renders the caption when given 2+ data points", () => {
    render(
      <WeeklyConsistencyChart
        scope="goal"
        weeklyData={[
          { weekLabel: "W1", rate: 0.5 },
          { weekLabel: "W2", rate: 0.75 },
        ]}
      />,
    );
    expect(screen.getByText("Weekly Goal Consistency")).toBeTruthy();
  });

  it("renders one point circle and one label per data point", () => {
    render(
      <WeeklyConsistencyChart
        scope="habit"
        weeklyData={[
          { weekLabel: "W1", rate: 0.5 },
          { weekLabel: "W2", rate: 0.75 },
          { weekLabel: "W3", rate: 0.9 },
        ]}
      />,
    );
    const circles = screen.UNSAFE_root.findAll(
      (n: { type: unknown }) =>
        typeof n.type === "string" && n.type === "RNSVGCircle",
    );
    expect(circles).toHaveLength(3);
    const texts = screen.UNSAFE_root.findAll(
      (n: { type: unknown }) =>
        typeof n.type === "string" && n.type === "RNSVGText",
    );
    // 3 week labels (W1/W2/W3) + 3 Y-axis labels (100%, 50%, 0%)
    expect(texts).toHaveLength(6);
  });
});
