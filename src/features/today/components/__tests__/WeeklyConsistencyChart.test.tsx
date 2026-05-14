import { render, screen } from "@testing-library/react-native";

import { WeeklyConsistencyChart } from "@/features/today/components/WeeklyConsistencyChart";

describe("WeeklyConsistencyChart", () => {
  it("renders null when given 0 data points", () => {
    const { toJSON } = render(<WeeklyConsistencyChart weeklyData={[]} />);
    expect(toJSON()).toBeNull();
  });

  it("renders null when given 1 data point", () => {
    const { toJSON } = render(
      <WeeklyConsistencyChart weeklyData={[{ weekLabel: "W1", rate: 0.5 }]} />,
    );
    expect(toJSON()).toBeNull();
  });

  it("renders the caption when given 2+ data points", () => {
    render(
      <WeeklyConsistencyChart
        weeklyData={[
          { weekLabel: "W1", rate: 0.5 },
          { weekLabel: "W2", rate: 0.75 },
        ]}
      />,
    );
    expect(screen.getByText("Weekly consistency")).toBeTruthy();
  });

  it("renders one point circle and one label per data point", () => {
    render(
      <WeeklyConsistencyChart
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
    expect(texts).toHaveLength(3);
  });
});
