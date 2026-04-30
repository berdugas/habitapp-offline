import { fireEvent, render, screen } from "@testing-library/react-native";

import CueScreen from "@/features/onboarding/screens/CueScreen";

jest.mock("expo-router", () => ({
  router: { push: jest.fn(), replace: jest.fn() },
}));

jest.mock("@/features/onboarding/OnboardingProvider", () => ({
  useOnboarding: jest.fn(),
}));

const { useOnboarding } = jest.requireMock(
  "@/features/onboarding/OnboardingProvider",
) as { useOnboarding: jest.Mock };

const { router } = jest.requireMock("expo-router") as {
  router: { push: jest.Mock; replace: jest.Mock };
};

function makeDraft(overrides: object = {}) {
  return {
    step: "cue",
    becomingPhrase: "a runner",
    dailyAction: "Run for 30 minutes",
    tinyAction: "Run for 2 minutes",
    cueExisting: "",
    worstDayPassed: null,
    ...overrides,
  };
}

describe("CueScreen", () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it("renders both input fields with values from the draft", () => {
    const mockUpdate = jest.fn();
    useOnboarding.mockReturnValue({
      draft: makeDraft({ cueExisting: "morning coffee" }),
      update: mockUpdate,
    });

    render(<CueScreen />);

    // The "I will" field shows tinyAction from draft.
    expect(screen.getByDisplayValue("Run for 2 minutes")).toBeTruthy();
    // The "After I" field shows cueExisting from draft.
    expect(screen.getByDisplayValue("morning coffee")).toBeTruthy();
  });

  it("Continue is disabled when cueExisting is empty, enabled when both fields are filled", () => {
    const mockUpdate = jest.fn();
    // cueExisting empty → canContinue is false.
    useOnboarding.mockReturnValue({ draft: makeDraft(), update: mockUpdate });

    render(<CueScreen />);

    fireEvent.press(screen.getByText("Continue"));
    expect(mockUpdate).not.toHaveBeenCalled();
    expect(router.push).not.toHaveBeenCalled();
  });

  it("Continue calls update and router.push when both fields are filled", () => {
    const mockUpdate = jest.fn();
    useOnboarding.mockReturnValue({
      draft: makeDraft({ cueExisting: "morning coffee" }),
      update: mockUpdate,
    });

    render(<CueScreen />);

    fireEvent.press(screen.getByText("Continue"));

    expect(mockUpdate).toHaveBeenCalledWith({ step: "worst-day" });
    expect(router.push).toHaveBeenCalledWith("/(onboarding)/worst-day");
  });

  it("typing in the After-I field calls update with cueExisting", () => {
    const mockUpdate = jest.fn();
    useOnboarding.mockReturnValue({ draft: makeDraft(), update: mockUpdate });

    render(<CueScreen />);

    // The placeholder identifies the After-I input.
    fireEvent.changeText(
      screen.getByPlaceholderText("my morning coffee"),
      "after my run",
    );

    expect(mockUpdate).toHaveBeenCalledWith({ cueExisting: "after my run" });
  });

  it("typing in the I-will field calls update with tinyAction, not cueAction", () => {
    const mockUpdate = jest.fn();
    useOnboarding.mockReturnValue({ draft: makeDraft(), update: mockUpdate });

    render(<CueScreen />);

    // The "I will" input has no placeholder — find it by display value.
    fireEvent.changeText(
      screen.getByDisplayValue("Run for 2 minutes"),
      "Put on running shoes",
    );

    expect(mockUpdate).toHaveBeenCalledWith({ tinyAction: "Put on running shoes" });
    // Confirm no call was made with cueAction (the removed field).
    expect(mockUpdate).not.toHaveBeenCalledWith(
      expect.objectContaining({ cueAction: expect.anything() }),
    );
  });
});
