import { render, screen } from "@testing-library/react-native";

import { HabitRow } from "@/features/today/components/HabitRow";
import { colors } from "@/theme/colors";

import type { TodayHabitCardData } from "@/features/today/types";

function flatten<T = Record<string, unknown>>(style: unknown): T {
  if (Array.isArray(style)) {
    return Object.assign({}, ...style.filter(Boolean)) as T;
  }
  return (style ?? {}) as T;
}

function makeHabit(overrides: Partial<TodayHabitCardData> = {}): TodayHabitCardData {
  return {
    activeDays: [1, 2, 3, 4, 5, 6, 7],
    consistencyDenominator: 10,
    consistencyRate: 0.9,
    cue: "morning coffee",
    formula: "After morning coffee, run for 2 minutes",
    habitState: "active",
    icon: null,
    id: "habit-1",
    identityPhrase: "a runner",
    name: "Run",
    offDay: false,
    skipCount: 0,
    startDate: "2026-04-01",
    streak: 12,
    tinyAction: "run for 2 minutes",
    todayStatus: null,
    ...overrides,
  };
}

function baseProps() {
  return {
    disabled: false,
    onDone: jest.fn(),
    onNavigate: jest.fn(),
    onSkip: jest.fn(),
    onUndo: jest.fn(),
  };
}

describe("HabitRow graduated treatment", () => {
  it("uses the graduatedCircle border on the pending circle when graduated", () => {
    render(
      <HabitRow {...baseProps()} graduated habit={makeHabit()} />,
    );

    const circleNode = screen.getByLabelText("Log Run").children[0] as {
      props: { style: unknown };
    };
    const flat = flatten<{ borderColor: string }>(circleNode.props.style);
    expect(flat.borderColor).toBe(colors.graduatedCircle);
  });

  it("shows 'Automatic' instead of the formula when graduated", () => {
    render(
      <HabitRow {...baseProps()} graduated habit={makeHabit()} />,
    );

    expect(screen.getByText("Automatic")).toBeTruthy();
    expect(
      screen.queryByText("After morning coffee, run for 2 minutes"),
    ).toBeNull();
  });

  it("still shows the formula text when not graduated", () => {
    render(<HabitRow {...baseProps()} habit={makeHabit()} />);

    expect(
      screen.getByText("After morning coffee, run for 2 minutes"),
    ).toBeTruthy();
    expect(screen.queryByText("Automatic")).toBeNull();
  });

  it("uses the primary border on the pending circle when not graduated (regression)", () => {
    render(<HabitRow {...baseProps()} habit={makeHabit()} />);

    const circleNode = screen.getByLabelText("Log Run").children[0] as {
      props: { style: unknown };
    };
    const flat = flatten<{ borderColor: string }>(circleNode.props.style);
    expect(flat.borderColor).toBe(colors.primary);
  });

  it("still renders the done gradient when graduated + done (no state-machine regression)", () => {
    render(
      <HabitRow
        {...baseProps()}
        graduated
        habit={makeHabit({ todayStatus: "done" })}
      />,
    );

    // "Run — done" label persists for graduated habits in the done state
    expect(screen.getByLabelText("Run — done")).toBeTruthy();
    // No "Automatic" label when done (the formula slot is suppressed by line-through name treatment)
    // but the row still includes the name "Run"
    expect(screen.getByText("Run")).toBeTruthy();
  });
});
