import { fireEvent, render, screen } from "@testing-library/react-native";
import React from "react";

const mockMutate = jest.fn();
const mockUseExportData = jest.fn();
const mockBack = jest.fn();

jest.mock("@/features/settings/hooks", () => ({
  useExportData: () => mockUseExportData(),
}));

jest.mock("expo-router", () => ({
  router: {
    back: (...args: unknown[]) => mockBack(...args),
  },
}));

import ExportScreen from "@/features/settings/screens/ExportScreen";

function setMutationState(overrides: {
  isPending?: boolean;
  isError?: boolean;
} = {}) {
  mockUseExportData.mockReturnValue({
    mutate: mockMutate,
    isPending: overrides.isPending ?? false,
    isError: overrides.isError ?? false,
    error: null,
  });
}

describe("ExportScreen", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    setMutationState();
  });

  it("renders the 'What's included' and 'Privacy' info cards and the Export button", () => {
    render(<ExportScreen />);

    expect(screen.getByText("WHAT'S INCLUDED")).toBeTruthy();
    expect(screen.getByText("PRIVACY")).toBeTruthy();
    expect(screen.getByText("Export Data")).toBeTruthy();
  });

  it("tapping the Export button calls the mutation", () => {
    render(<ExportScreen />);

    fireEvent.press(screen.getByText("Export Data"));

    expect(mockMutate).toHaveBeenCalledTimes(1);
  });

  it("when pending, the button label is 'Building export...' and the Pressable is disabled", () => {
    setMutationState({ isPending: true });
    render(<ExportScreen />);

    expect(screen.queryByText("Export Data")).toBeNull();

    // Query the actual PrimaryButton Pressable, not the Text child. Asserting on
    // the Pressable proves the button itself is disabled — a regression where the
    // button stayed tappable would not satisfy this.
    const button = screen.getByRole("button", { name: "Building export..." });
    expect(button.props.accessibilityState?.disabled).toBe(true);

    fireEvent.press(button);
    expect(mockMutate).not.toHaveBeenCalled();
  });

  it("when the mutation errors, error copy is rendered below the button", () => {
    setMutationState({ isError: true });
    render(<ExportScreen />);

    expect(
      screen.getByText("Something went wrong. Please try again."),
    ).toBeTruthy();
    // Button remains enabled so the user can retry
    expect(screen.getByText("Export Data")).toBeTruthy();
  });

  it("tapping the back button calls router.back()", () => {
    render(<ExportScreen />);

    const back = screen.getByLabelText("Go back");
    fireEvent.press(back);
    expect(mockBack).toHaveBeenCalledTimes(1);
  });
});
