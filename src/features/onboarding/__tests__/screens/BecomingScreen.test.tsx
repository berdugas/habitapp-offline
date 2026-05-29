import { fireEvent, render, screen } from "@testing-library/react-native";

import BecomingScreen from "@/features/onboarding/screens/BecomingScreen";

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
    step: "becoming",
    becomingPhrase: "",
    dailyAction: "",
    tinyAction: "",
    cueExisting: "",
    worstDayPassed: null,
    habitName: "",
    habitIcon: null,
    ...overrides,
  };
}

describe("BecomingScreen — identity gate", () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it("blocks Continue when the phrase cleans to fewer than 2 chars", () => {
    const mockUpdate = jest.fn();
    // "become a" strips the "become " lead-in -> "a" (1 char) -> invalid.
    useOnboarding.mockReturnValue({
      draft: makeDraft({ becomingPhrase: "become a" }),
      update: mockUpdate,
    });

    render(<BecomingScreen />);

    fireEvent.press(screen.getByText("Continue"));

    expect(mockUpdate).not.toHaveBeenCalled();
    expect(router.push).not.toHaveBeenCalled();
  });

  it("advances when the phrase is valid", () => {
    const mockUpdate = jest.fn();
    useOnboarding.mockReturnValue({
      draft: makeDraft({ becomingPhrase: "healthy" }),
      update: mockUpdate,
    });

    render(<BecomingScreen />);

    fireEvent.press(screen.getByText("Continue"));

    expect(router.push).toHaveBeenCalledWith("/(onboarding)/action-insight");
  });
});
