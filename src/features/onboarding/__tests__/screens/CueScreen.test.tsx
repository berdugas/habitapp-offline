import { fireEvent, render, screen } from "@testing-library/react-native";

import CueScreen from "@/features/onboarding/screens/CueScreen";

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
    activeDays: [1, 2, 3, 4, 5, 6, 7],
    step: "cue",
    becomingPhrase: "a runner",
    dailyAction: "Run for 30 minutes",
    tinyAction: "Run for 2 minutes",
    cueExisting: "",
    worstDayPassed: null,
    habitName: "",
    habitIcon: null,
    ...overrides,
  };
}

describe("CueScreen", () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it("renders the After-I input and readonly I-will display", () => {
    const mockUpdate = jest.fn();
    useOnboarding.mockReturnValue({
      draft: makeDraft({ cueExisting: "morning coffee" }),
      update: mockUpdate,
    });

    render(<CueScreen />);

    // The "I will" display shows tinyAction from draft (read-only Text, not TextInput).
    expect(screen.getByText("Run for 2 minutes")).toBeTruthy();
    // The "After I" field is an editable input.
    expect(screen.getByDisplayValue("morning coffee")).toBeTruthy();
  });

  it("Continue is disabled when cueExisting is empty", () => {
    const mockUpdate = jest.fn();
    useOnboarding.mockReturnValue({ draft: makeDraft(), update: mockUpdate });

    render(<CueScreen />);

    fireEvent.press(screen.getByText("Continue"));
    expect(mockUpdate).not.toHaveBeenCalled();
    expect(router.push).not.toHaveBeenCalled();
  });

  it("Continue calls update and navigates to personalize when cueExisting is filled", () => {
    const mockUpdate = jest.fn();
    useOnboarding.mockReturnValue({
      draft: makeDraft({ cueExisting: "morning coffee" }),
      update: mockUpdate,
    });

    render(<CueScreen />);

    fireEvent.press(screen.getByText("Continue"));

    expect(mockUpdate).toHaveBeenCalledWith({ step: "personalize" });
    expect(router.push).toHaveBeenCalledWith("/(onboarding)/personalize");
  });

  it("typing in the After-I field calls update with cueExisting", () => {
    const mockUpdate = jest.fn();
    useOnboarding.mockReturnValue({ draft: makeDraft(), update: mockUpdate });

    render(<CueScreen />);

    fireEvent.changeText(
      screen.getByPlaceholderText("something you already do..."),
      "after my run",
    );

    expect(mockUpdate).toHaveBeenCalledWith({ cueExisting: "after my run" });
  });
});
