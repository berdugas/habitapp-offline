import { fireEvent, render, screen } from "@testing-library/react-native";

import { TertiaryButton } from "@/components/buttons/TertiaryButton";

describe("TertiaryButton", () => {
  it("renders the label", () => {
    render(<TertiaryButton label="Skip today" onPress={() => {}} />);
    expect(screen.getByText("Skip today")).toBeTruthy();
  });

  it("calls onPress when tapped", () => {
    const onPress = jest.fn();
    render(<TertiaryButton label="Just close" onPress={onPress} />);
    fireEvent.press(screen.getByText("Just close"));
    expect(onPress).toHaveBeenCalledTimes(1);
  });

  it("has button accessibility role", () => {
    render(<TertiaryButton label="Back to Today" onPress={() => {}} />);
    expect(screen.getByRole("button", { name: "Back to Today" })).toBeTruthy();
  });
});
