import { render, screen } from "@testing-library/react-native";

import { WeeklyConsistencyChart } from "@/features/today/components/WeeklyConsistencyChart";

describe("WeeklyConsistencyChart", () => {
  it("renders null when given 0 data points", () => {
    const { toJSON } = render(<WeeklyConsistencyChart weeklyData={[]} />);
    expect(toJSON()).toBeNull();
  });

  it("renders a single dot (no line/area) when given 1 data point", () => {
    render(
      <WeeklyConsistencyChart weeklyData={[{ weekLabel: "W1", rate: 0.5 }]} />,
    );
    expect(screen.getByText("Weekly consistency")).toBeTruthy();
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
        weeklyData={[
          { weekLabel: "W1", rate: 0.5 },
          { weekLabel: "W2", rate: 0.75 },
        ]}
      />,
    );
    expect(screen.getByText("Weekly consistency")).toBeTruthy();
  });

  it("renders one point circle and one label per data point, plus the two Y-axis end labels", () => {
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
    // 3 week labels + 2 Y-axis end labels ("100%", "30%")
    expect(texts).toHaveLength(5);
  });

  it("renders the Y-axis end labels at 100% and 30% regardless of data-point count", () => {
    render(
      <WeeklyConsistencyChart
        weeklyData={[{ weekLabel: "W1", rate: 0.5 }]}
      />,
    );
    // react-native-svg renders <Text> as RNSVGText > RNSVGTSpan; the literal
    // string is stashed under RNSVGTSpan's props.content.
    const tspans = screen.UNSAFE_root.findAll(
      (n: { type: unknown }) =>
        typeof n.type === "string" && n.type === "RNSVGTSpan",
    );
    const contents = tspans
      .map(
        (n: { props?: { content?: unknown } }) => n.props?.content,
      )
      .filter((c: unknown): c is string => typeof c === "string");
    expect(contents).toContain("100%");
    expect(contents).toContain("30%");
  });
});
