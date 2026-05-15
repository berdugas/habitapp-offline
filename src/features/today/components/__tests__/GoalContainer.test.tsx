import { render, screen } from "@testing-library/react-native";
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
