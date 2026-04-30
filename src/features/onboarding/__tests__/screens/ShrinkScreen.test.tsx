import { fireEvent, render, screen } from "@testing-library/react-native";

import ShrinkScreen from "@/features/onboarding/screens/ShrinkScreen";

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
    step: "shrink",
    becomingPhrase: "a runner",
    dailyAction: "Run for 30 minutes",
    tinyAction: "",
    cueExisting: "",
    worstDayPassed: null,
    ...overrides,
  };
}

describe("ShrinkScreen", () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it("renders the default header when worstDayPassed is null", () => {
    const mockUpdate = jest.fn();
    useOnboarding.mockReturnValue({ draft: makeDraft(), update: mockUpdate });

    render(<ShrinkScreen />);

    expect(
      screen.getByText(
        "That's a great direction. Now let's make it laughably small for tomorrow.",
      ),
    ).toBeTruthy();
  });

  it("renders the alternate header when worstDayPassed is false", () => {
    const mockUpdate = jest.fn();
    useOnboarding.mockReturnValue({
      draft: makeDraft({ worstDayPassed: false }),
      update: mockUpdate,
    });

    render(<ShrinkScreen />);

    expect(
      screen.getByText("Let's make it smaller. What would survive a hard day?"),
    ).toBeTruthy();
  });

  it("Continue button is disabled when tinyAction is empty and enabled when populated", () => {
    const mockUpdate = jest.fn();
    useOnboarding.mockReturnValue({ draft: makeDraft(), update: mockUpdate });

    render(<ShrinkScreen />);

    const button = screen.getByText("Continue");
    expect(button).toBeTruthy();

    // Disabled when empty — pressing it should not call update or router.push.
    fireEvent.press(button);
    expect(mockUpdate).not.toHaveBeenCalled();
    expect(router.push).not.toHaveBeenCalled();
  });

  it("Continue button calls update and router.push when tinyAction is non-empty", () => {
    const mockUpdate = jest.fn();
    useOnboarding.mockReturnValue({
      draft: makeDraft({ tinyAction: "Run for 2 minutes" }),
      update: mockUpdate,
    });

    render(<ShrinkScreen />);

    fireEvent.press(screen.getByText("Continue"));

    expect(mockUpdate).toHaveBeenCalledWith({ step: "cue" });
    expect(router.push).toHaveBeenCalledWith("/(onboarding)/cue");
  });
});
