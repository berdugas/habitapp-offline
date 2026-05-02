jest.mock("@/features/trial/hooks", () => ({
  useTrialValidation: jest.fn(() => ({
    isBootstrapping: false,
    isValidating: false,
    accessMode: "full",
    entitlementStatus: "trial",
    trialStartedAt: null,
    trialEndsAt: null,
    lastValidatedAt: null,
    refresh: jest.fn().mockResolvedValue(undefined),
  })),
}));

import { fireEvent, render, screen } from "@testing-library/react-native";

import SettingsScreen from "@/features/settings/screens/SettingsScreen";

const mockPush = jest.fn();
const mockReplace = jest.fn();
const mockSignOut = jest.fn();
const mockUseAuthSession = jest.fn();
const mockUseInactiveHabitsQuery = jest.fn();

jest.mock("expo-router", () => ({
  router: {
    push: (...args: unknown[]) => mockPush(...args),
    replace: (...args: unknown[]) => mockReplace(...args),
  },
}));

jest.mock("@/features/auth/hooks", () => ({
  useAuthSession: () => mockUseAuthSession(),
}));

jest.mock("@/features/auth/api", () => ({
  signOut: () => mockSignOut(),
}));

jest.mock("@/features/habits/hooks", () => ({
  useInactiveHabitsQuery: () => mockUseInactiveHabitsQuery(),
}));

describe("SettingsScreen", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockSignOut.mockResolvedValue(undefined);
    mockUseAuthSession.mockReturnValue({
      user: { email: "user@example.com" },
    });
    mockUseInactiveHabitsQuery.mockReturnValue({
      data: [],
      error: null,
      isLoading: false,
    });
  });

  it("shows archived habits loading state without the empty state", () => {
    mockUseInactiveHabitsQuery.mockReturnValue({
      data: undefined,
      error: null,
      isLoading: true,
    });

    render(<SettingsScreen />);

    expect(screen.getByText("Loading archived habits...")).toBeTruthy();
    expect(screen.queryByText("No archived habits")).toBeNull();
  });

  it("shows archived habits error state without the empty state", () => {
    mockUseInactiveHabitsQuery.mockReturnValue({
      data: undefined,
      error: new Error("boom"),
      isLoading: false,
    });

    render(<SettingsScreen />);

    expect(
      screen.getByText("We couldn't load inactive habits right now. Try again."),
    ).toBeTruthy();
    expect(screen.queryByText("No archived habits")).toBeNull();
  });

  it("shows updated section heading and empty state after a successful empty load", () => {
    render(<SettingsScreen />);

    expect(screen.queryByText("Foundation status")).toBeNull();
    expect(screen.getByText("YOUR ARCHIVED HABITS")).toBeTruthy();
    expect(screen.getByText("No archived habits")).toBeTruthy();
  });

  it("shows archived habits and opens detail from settings", () => {
    mockUseInactiveHabitsQuery.mockReturnValue({
      data: [
        {
          id: "habit-1",
          title: "Reading",
          cue: "After breakfast",
          tiny_action: "Read 1 page",
        },
      ],
      error: null,
      isLoading: false,
    });

    render(<SettingsScreen />);

    expect(screen.getByText("After breakfast, I will Read 1 page.")).toBeTruthy();

    fireEvent.press(screen.getByLabelText("Reading details"));

    expect(mockPush).toHaveBeenCalledWith("/(app)/habits/habit-1");
  });
});
