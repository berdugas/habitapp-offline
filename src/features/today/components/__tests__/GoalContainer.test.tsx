import { fireEvent, render, screen } from "@testing-library/react-native";
import { Text } from "react-native";

import { GoalContainer } from "@/features/today/components/GoalContainer";

function baseProps() {
  return {
    children: <Text>habit-children</Text>,
    consistencyRate: 0.8,
    identityPhrase: "a reader",
    remainingCount: 0,
    streak: 5,
  };
}

describe("GoalContainer graduated treatment", () => {
  it("shows the (Graduated) suffix on the identity phrase when goalGraduated=true", () => {
    render(<GoalContainer {...baseProps()} goalGraduated />);

    // The suffix is rendered as a nested Text inside the same line; text query
    // returns the first matching node, so search for the suffix string itself.
    expect(screen.getByText("(Graduated)")).toBeTruthy();
  });

  it("hides the (Graduated) suffix when goalGraduated=false", () => {
    render(<GoalContainer {...baseProps()} goalGraduated={false} />);

    expect(screen.queryByText("(Graduated)")).toBeNull();
  });

  it("hides the (Graduated) suffix when goalGraduated prop is omitted", () => {
    render(<GoalContainer {...baseProps()} />);

    expect(screen.queryByText("(Graduated)")).toBeNull();
  });
});

describe("GoalContainer weekly review pill", () => {
  it("invokes onGoalPress when the 'Weekly review' pill is pressed", () => {
    const onGoalPress = jest.fn();
    render(
      <GoalContainer {...baseProps()} reviewDue onGoalPress={onGoalPress} />,
    );

    // accessibilityLabel disambiguates from the title-row Pressable that
    // shares the same handler.
    fireEvent.press(screen.getByLabelText("Open weekly review"));
    expect(onGoalPress).toHaveBeenCalledTimes(1);
  });

  it("hides the 'Weekly review' pill when reviewStatusError is true even if reviewDue is true", () => {
    render(
      <GoalContainer
        {...baseProps()}
        reviewDue
        reviewStatusError
        onGoalPress={jest.fn()}
      />,
    );

    expect(screen.queryByLabelText("Open weekly review")).toBeNull();
    expect(screen.getByText("Review status unavailable")).toBeTruthy();
  });
});

describe("GoalContainer donut attention dot", () => {
  it("renders the donut attention dot when reviewDue and !reviewStatusError", () => {
    render(<GoalContainer {...baseProps()} reviewDue />);

    expect(screen.getByTestId("donut-attention-dot")).toBeTruthy();
  });

  it("omits the donut attention dot in the default props", () => {
    // baseProps() supplies consistencyRate: 0.8, so the donut is rendered.
    // The absence of the dot here proves GoalContainer is actually
    // forwarding showAttentionDot=false (the prop has a false default in
    // ConsistencyDonut, so a missed forward would also produce no dot — but
    // any future forwarding bug that hard-codes `true` would be caught).
    render(<GoalContainer {...baseProps()} />);

    expect(screen.queryByTestId("donut-attention-dot")).toBeNull();
  });

  it("omits the donut attention dot when reviewStatusError shadows reviewDue", () => {
    render(<GoalContainer {...baseProps()} reviewDue reviewStatusError />);

    expect(screen.queryByTestId("donut-attention-dot")).toBeNull();
  });
});
