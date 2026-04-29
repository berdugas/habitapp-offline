import { render, screen } from "@testing-library/react-native";

import RootEntryScreen from "@/features/entry/screens/RootEntryScreen";

jest.mock("expo-router", () => ({
  Redirect: ({ href }: { href: string }) => {
    const { Text } = require("react-native");
    return <Text>{`redirect:${href}`}</Text>;
  },
}));

jest.mock("@tanstack/react-query", () => ({
  useQueryClient: () => ({ invalidateQueries: jest.fn() }),
}));

jest.mock("@/features/auth/hooks", () => ({
  useAuthSession: jest.fn(),
}));

jest.mock("@/features/habits/hooks", () => ({
  useEligibleHabitsQuery: jest.fn(),
  useUpcomingActiveHabitsQuery: jest.fn(),
}));

jest.mock("@/features/onboarding/hooks", () => ({
  useIsOnboardingCompletedQuery: jest.fn(),
  getIsOnboardingCompletedQueryKey: () => ["onboarding", "completed"],
}));

jest.mock("@/features/onboarding/storage", () => ({
  markOnboardingCompleted: jest.fn().mockResolvedValue(undefined),
}));

const { useAuthSession } = jest.requireMock("@/features/auth/hooks") as {
  useAuthSession: jest.Mock;
};
const {
  useEligibleHabitsQuery,
  useUpcomingActiveHabitsQuery,
} = jest.requireMock("@/features/habits/hooks") as {
  useEligibleHabitsQuery: jest.Mock;
  useUpcomingActiveHabitsQuery: jest.Mock;
};
const { useIsOnboardingCompletedQuery } = jest.requireMock(
  "@/features/onboarding/hooks",
) as { useIsOnboardingCompletedQuery: jest.Mock };

type SetupOptions = {
  isBootstrapping?: boolean;
  session?: object | null;
  user?: { id: string } | null;
  eligibleHabits?: object[];
  upcomingHabits?: object[];
  eligibleLoading?: boolean;
  upcomingLoading?: boolean;
  eligibleError?: Error | null;
  upcomingError?: Error | null;
  onboardingCompleted?: boolean;
  onboardingLoading?: boolean;
  onboardingError?: Error | null;
};

function setup({
  isBootstrapping = false,
  session = { user: { id: "user-1" } },
  user = { id: "user-1" },
  eligibleHabits = [],
  upcomingHabits = [],
  eligibleLoading = false,
  upcomingLoading = false,
  eligibleError = null,
  upcomingError = null,
  onboardingCompleted = false,
  onboardingLoading = false,
  onboardingError = null,
}: SetupOptions = {}) {
  useAuthSession.mockReturnValue({ isBootstrapping, session, user });
  useEligibleHabitsQuery.mockReturnValue({
    data: eligibleHabits,
    isLoading: eligibleLoading,
    isSuccess: !eligibleLoading && !eligibleError,
    error: eligibleError,
  });
  useUpcomingActiveHabitsQuery.mockReturnValue({
    data: upcomingHabits,
    isLoading: upcomingLoading,
    isSuccess: !upcomingLoading && !upcomingError,
    error: upcomingError,
  });
  useIsOnboardingCompletedQuery.mockReturnValue({
    data: onboardingCompleted,
    isLoading: onboardingLoading,
    isSuccess: !onboardingLoading && !onboardingError,
    error: onboardingError,
  });
}

describe("RootEntryScreen", () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it("shows loading while auth bootstraps", () => {
    setup({ isBootstrapping: true, session: null, user: null });
    render(<RootEntryScreen />);
    expect(screen.getByText(/checking your session/i)).toBeTruthy();
  });

  it("shows the pre-auth WelcomeScreen when there is no session", () => {
    setup({ session: null, user: null });
    render(<RootEntryScreen />);
    expect(
      screen.getByText(/build habits through small actions/i),
    ).toBeTruthy();
  });

  it("shows loading while any query is still resolving", () => {
    setup({ eligibleLoading: true });
    render(<RootEntryScreen />);
    expect(screen.getByText(/loading your habits/i)).toBeTruthy();
  });

  it("shows an error when any query fails", () => {
    setup({ eligibleError: new Error("boom") });
    render(<RootEntryScreen />);
    expect(
      screen.getByText("We couldn't load your habits right now. Try again."),
    ).toBeTruthy();
  });

  it("redirects to today when user has eligible habits (regardless of completion flag)", () => {
    setup({ eligibleHabits: [{ id: "habit-1" }], onboardingCompleted: false });
    render(<RootEntryScreen />);
    expect(screen.getByText("redirect:/(app)/(tabs)/today")).toBeTruthy();
  });

  it("redirects to today when user has upcoming active habits (regardless of completion flag)", () => {
    setup({ upcomingHabits: [{ id: "habit-2" }], onboardingCompleted: false });
    render(<RootEntryScreen />);
    expect(screen.getByText("redirect:/(app)/(tabs)/today")).toBeTruthy();
  });

  it("redirects to habits/create when no habits and onboarding is completed", () => {
    setup({ onboardingCompleted: true });
    render(<RootEntryScreen />);
    expect(
      screen.getByText("redirect:/(app)/habits/create"),
    ).toBeTruthy();
  });

  it("redirects to onboarding when no habits and onboarding is not completed", () => {
    setup({ onboardingCompleted: false });
    render(<RootEntryScreen />);
    expect(screen.getByText("redirect:/(onboarding)")).toBeTruthy();
  });
});
