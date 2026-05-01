import { fireEvent, render, screen } from "@testing-library/react-native";

import { Heatmap } from "@/components/Heatmap";
import { colors } from "@/theme/colors";
import { resetClockForTesting, setNowForTesting } from "@/utils/clock";

describe("Heatmap", () => {
  beforeEach(() => {
    setNowForTesting(new Date("2026-04-30T10:00:00.000Z"));
  });

  afterEach(() => {
    resetClockForTesting();
  });

  it("renders 30 cells when days=30", () => {
    render(<Heatmap logs={[]} days={30} />);
    expect(screen.queryAllByLabelText(/not logged|done|skipped|missed/)).toHaveLength(30);
  });

  it("renders 90 cells when days=90", () => {
    render(<Heatmap logs={[]} days={90} />);
    expect(screen.queryAllByLabelText(/not logged|done|skipped|missed/)).toHaveLength(90);
  });

  it("colors a Done log green", () => {
    render(<Heatmap logs={[{ log_date: "2026-04-29", status: "done" }]} days={30} />);
    const cell = screen.getByLabelText("2026-04-29, done");
    expect(cell.props.style).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ backgroundColor: colors.heatDone }),
      ]),
    );
  });

  it("outlines today when unlogged", () => {
    render(<Heatmap logs={[]} days={30} />);
    const todayCell = screen.getByLabelText("Today, not logged");
    expect(todayCell.props.style).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ borderWidth: 2 }),
      ]),
    );
  });

  it("does not outline today when it has a log", () => {
    render(<Heatmap logs={[{ log_date: "2026-04-30", status: "done" }]} days={30} />);
    const todayCell = screen.getByLabelText("Today, done");
    const styles = (todayCell.props.style as Array<object>).flat().filter(Boolean);
    expect(styles.some((s: { borderWidth?: number }) => s.borderWidth === 2)).toBe(false);
  });

  it("calls onCellPress with the date when a cell is tapped", () => {
    const onCellPress = jest.fn();
    render(
      <Heatmap
        logs={[{ log_date: "2026-04-29", status: "done" }]}
        days={30}
        onCellPress={onCellPress}
      />,
    );
    fireEvent.press(screen.getByLabelText("2026-04-29, done"));
    expect(onCellPress).toHaveBeenCalledWith("2026-04-29");
  });

  it("does not register press handlers when onCellPress is omitted", () => {
    const { root } = render(
      <Heatmap logs={[{ log_date: "2026-04-29", status: "done" }]} days={30} />,
    );
    const buttons = root.findAllByProps({ accessibilityRole: "button" });
    expect(buttons).toHaveLength(0);
  });
});
