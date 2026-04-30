import { fireEvent, render, screen } from "@testing-library/react-native";

import WorstDayCheckScreen from "@/features/onboarding/screens/WorstDayCheckScreen";

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
    step: "worst-day",
    becomingPhrase: "a runner",
    dailyAction: "Run for 30 minutes",
    tinyAction: "Run for 2 minutes",
    cueExisting: "morning coffee",
    worstDayPassed: null,
    ...overrides,
  };
}

describe("WorstDayCheckScreen", () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it("tapping Yes calls update with worstDayPassed:true and router.push to confirmation", () => {
    const mockUpdate = jest.fn();
    useOnboarding.mockReturnValue({ draft: makeDraft(), update: mockUpdate });

    render(<WorstDayCheckScreen />);

    fireEvent.press(screen.getByText("Yes, I could"));

    expect(mockUpdate).toHaveBeenCalledWith({
      worstDayPassed: true,
      step: "confirmation",
    });
    expect(router.push).toHaveBeenCalledWith("/(onboarding)/confirmation");
    expect(router.replace).not.toHaveBeenCalled();
  });

  it("tapping No calls update with worstDayPassed:false and router.replace (not push) to shrink", () => {
    const mockUpdate = jest.fn();
    useOnboarding.mockReturnValue({ draft: makeDraft(), update: mockUpdate });

    render(<WorstDayCheckScreen />);

    fireEvent.press(screen.getByText("Probably not"));

    expect(mockUpdate).toHaveBeenCalledWith({
      worstDayPassed: false,
      step: "shrink",
    });
    // Critical: must be replace, not push — pins decision D3.
    expect(router.replace).toHaveBeenCalledWith("/(onboarding)/shrink");
    expect(router.push).not.toHaveBeenCalled();
  });
});
