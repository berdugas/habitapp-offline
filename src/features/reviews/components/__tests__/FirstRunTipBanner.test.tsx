import { fireEvent, render, screen } from "@testing-library/react-native";
import React from "react";

import { FirstRunTipBanner } from "@/features/reviews/components/FirstRunTipBanner";

describe("FirstRunTipBanner", () => {
  it("renders the message", () => {
    render(
      <FirstRunTipBanner message="This is the framing tip." onDismiss={jest.fn()} />,
    );
    expect(screen.queryByText("This is the framing tip.")).toBeTruthy();
  });

  it("calls onDismiss when the dismiss control is pressed", () => {
    const onDismiss = jest.fn();
    render(<FirstRunTipBanner message="tip" onDismiss={onDismiss} />);
    fireEvent.press(screen.getByLabelText("Dismiss tip"));
    expect(onDismiss).toHaveBeenCalledTimes(1);
  });
});
