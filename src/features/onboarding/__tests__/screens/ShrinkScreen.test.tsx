import { fireEvent, render, screen } from "@testing-library/react-native";

import ShrinkScreen from "@/features/onboarding/screens/ShrinkScreen";

jest.mock("expo-router", () => ({
  router: { push: jest.fn(), replace: jest.fn() },
  useRouter: jest.fn(() => ({ back: jest.fn() })),
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
    habitName: "",
    habitIcon: null,
    ...overrides,
  };
}

describe("ShrinkScreen", () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it("renders the headline", () => {
    const mockUpdate = jest.fn();
    useOnboarding.mockReturnValue({ draft: makeDraft(), update: mockUpdate });

    render(<ShrinkScreen />);

    expect(
      screen.getByText("Now make the action laughably small."),
    ).toBeTruthy();
  });

  it("shows the daily action context chip when dailyAction is set", () => {
    const mockUpdate = jest.fn();
    useOnboarding.mockReturnValue({
      draft: makeDraft({ dailyAction: "Run for 30 minutes" }),
      update: mockUpdate,
    });

    render(<ShrinkScreen />);

    expect(screen.getByText(/Run for 30 minutes/)).toBeTruthy();
  });

  it("Continue button is disabled when tinyAction is empty", () => {
    const mockUpdate = jest.fn();
    useOnboarding.mockReturnValue({ draft: makeDraft(), update: mockUpdate });

    render(<ShrinkScreen />);

    // Disabled when empty — pressing should not call update or router.push.
    fireEvent.press(screen.getByText("Continue"));
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

    expect(mockUpdate).toHaveBeenCalledWith({ step: "cue-insight" });
    expect(router.push).toHaveBeenCalledWith("/(onboarding)/cue-insight");
  });
});
