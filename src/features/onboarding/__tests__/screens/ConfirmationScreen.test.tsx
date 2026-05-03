import { fireEvent, render, screen } from "@testing-library/react-native";

import ConfirmationScreen from "@/features/onboarding/screens/ConfirmationScreen";
import { OnboardingFinalizationError } from "@/features/onboarding/completion";

jest.mock("expo-router", () => ({
  useRouter: jest.fn(() => ({ back: jest.fn() })),
}));

jest.mock("@/features/onboarding/OnboardingProvider", () => ({
  useOnboarding: jest.fn(),
}));

jest.mock("@/features/onboarding/hooks", () => ({
  useFinalizeOnboardingMutation: jest.fn(),
}));

const { useOnboarding } = jest.requireMock(
  "@/features/onboarding/OnboardingProvider",
) as { useOnboarding: jest.Mock };

const { useFinalizeOnboardingMutation } = jest.requireMock(
  "@/features/onboarding/hooks",
) as { useFinalizeOnboardingMutation: jest.Mock };

function makeDraft(overrides: object = {}) {
  return {
    step: "confirmation",
    becomingPhrase: "a runner",
    dailyAction: "Run for 30 minutes",
    tinyAction: "Run for 2 minutes",
    cueExisting: "morning coffee",
    worstDayPassed: true,
    habitName: "Running habit",
    habitIcon: "PersonRunning",
    ...overrides,
  };
}

function makeMutation(overrides: object = {}) {
  return {
    mutate: jest.fn(),
    isPending: false,
    isError: false,
    error: null,
    ...overrides,
  };
}

describe("ConfirmationScreen", () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it("renders the summary fields with values from the draft", () => {
    useOnboarding.mockReturnValue({ draft: makeDraft() });
    useFinalizeOnboardingMutation.mockReturnValue(makeMutation());

    render(<ConfirmationScreen />);

    expect(screen.getByText("Becoming a runner")).toBeTruthy();
    expect(
      screen.getByText("After morning coffee, I will Run for 2 minutes."),
    ).toBeTruthy();
    expect(screen.getByText("Running habit")).toBeTruthy();
  });

  it("tapping the CTA calls the mutation's mutate function", () => {
    const mockMutate = jest.fn();
    useOnboarding.mockReturnValue({ draft: makeDraft() });
    useFinalizeOnboardingMutation.mockReturnValue(
      makeMutation({ mutate: mockMutate }),
    );

    render(<ConfirmationScreen />);

    fireEvent.press(screen.getByText("Let's go"));
    expect(mockMutate).toHaveBeenCalledTimes(1);
  });

  it("shows cap_failed error copy when mutation fails with cap_failed reason", () => {
    useOnboarding.mockReturnValue({ draft: makeDraft() });
    useFinalizeOnboardingMutation.mockReturnValue(
      makeMutation({
        isError: true,
        error: new OnboardingFinalizationError(
          "cap_failed",
          "Cannot create Focus habit",
        ),
      }),
    );

    render(<ConfirmationScreen />);

    expect(
      screen.getByText("You already have a Focus habit. Finish that one first."),
    ).toBeTruthy();
  });

  it("shows generic error copy when mutation fails with write_failed reason", () => {
    useOnboarding.mockReturnValue({ draft: makeDraft() });
    useFinalizeOnboardingMutation.mockReturnValue(
      makeMutation({
        isError: true,
        error: new OnboardingFinalizationError(
          "write_failed",
          "Transaction failed",
        ),
      }),
    );

    render(<ConfirmationScreen />);

    expect(
      screen.getByText(
        "Something went wrong while saving your habit. Please try again.",
      ),
    ).toBeTruthy();
    // Button is still enabled (not pending) so user can retry.
    expect(screen.getByText("Let's go")).toBeTruthy();
  });
});
