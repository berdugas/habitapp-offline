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

  it("shows inactive habits loading state without the empty state", () => {
    mockUseInactiveHabitsQuery.mockReturnValue({
      data: undefined,
      error: null,
      isLoading: true,
    });

    render(<SettingsScreen />);

    expect(screen.getByText("Loading inactive habits...")).toBeTruthy();
    expect(screen.queryByText("No inactive habits")).toBeNull();
  });

  it("shows inactive habits error state without the empty state", () => {
    mockUseInactiveHabitsQuery.mockReturnValue({
      data: undefined,
      error: new Error("boom"),
      isLoading: false,
    });

    render(<SettingsScreen />);

    expect(
      screen.getByText("We couldn't load inactive habits right now. Try again."),
    ).toBeTruthy();
    expect(screen.queryByText("No inactive habits")).toBeNull();
  });

  it("shows an empty inactive state after a successful empty load", () => {
    render(<SettingsScreen />);

    expect(screen.getByText("Foundation status")).toBeTruthy();
    expect(
      screen.getByText(
        "Current version: full non-AI habit builder. Weekly reviews and rule-based suggestions are enabled. AI coaching is planned for a later premium phase.",
      ),
    ).toBeTruthy();
    expect(screen.getByText("Inactive habits")).toBeTruthy();
    expect(screen.getByText("No inactive habits")).toBeTruthy();
  });

  it("shows inactive habits and opens detail from settings", () => {
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

    expect(screen.getByText("Open any inactive habit to reactivate it from Habit Detail.")).toBeTruthy();
    expect(screen.getByText("After breakfast, I will Read 1 page.")).toBeTruthy();
    expect(screen.queryByText("After After breakfast, I will Read 1 page.")).toBeNull();

    fireEvent.press(screen.getByLabelText("Reading details"));

    expect(mockPush).toHaveBeenCalledWith("/(app)/habits/habit-1");
  });
});
