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
const { useEligibleHabitsQuery, useUpcomingActiveHabitsQuery } =
  jest.requireMock("@/features/habits/hooks") as {
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
  queriesLoading?: boolean;
  queriesError?: boolean;
  onboardingCompleted?: boolean;
};

function setup({
  isBootstrapping = false,
  session = { user: { id: "user-1" } },
  user = { id: "user-1" },
  eligibleHabits = [],
  upcomingHabits = [],
  queriesLoading = false,
  queriesError = false,
  onboardingCompleted = false,
}: SetupOptions = {}) {
  useAuthSession.mockReturnValue({ isBootstrapping, session, user });
  useEligibleHabitsQuery.mockReturnValue({
    data: eligibleHabits,
    isLoading: queriesLoading,
    isSuccess: !queriesLoading && !queriesError,
    error: queriesError ? new Error("query failed") : null,
  });
  useUpcomingActiveHabitsQuery.mockReturnValue({
    data: upcomingHabits,
    isLoading: queriesLoading,
    isSuccess: !queriesLoading && !queriesError,
    error: queriesError ? new Error("query failed") : null,
  });
  useIsOnboardingCompletedQuery.mockReturnValue({
    data: onboardingCompleted,
    isLoading: queriesLoading,
    isSuccess: !queriesLoading && !queriesError,
    error: queriesError ? new Error("query failed") : null,
  });
}

describe("RootEntryScreen — entry routing", () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it("shows loading while auth is bootstrapping", () => {
    setup({ isBootstrapping: true, session: null, user: null });
    render(<RootEntryScreen />);
    expect(screen.getByText(/checking your session/i)).toBeTruthy();
  });

  it("shows the pre-auth WelcomeScreen when there is no session", () => {
    setup({ session: null, user: null });
    render(<RootEntryScreen />);
    expect(screen.getByText(/small actions/i)).toBeTruthy();
  });

  it("shows loading while any query is still resolving", () => {
    setup({ queriesLoading: true });
    render(<RootEntryScreen />);
    expect(screen.getByText(/loading your habits/i)).toBeTruthy();
  });

  it("shows an error state when any query fails", () => {
    setup({ queriesError: true });
    render(<RootEntryScreen />);
    expect(
      screen.getByText("We couldn't load your habits right now. Try again."),
    ).toBeTruthy();
  });

  it("redirects to today when active habits exist and onboarding is completed", () => {
    setup({
      eligibleHabits: [{ id: "habit-1" }],
      onboardingCompleted: true,
    });
    render(<RootEntryScreen />);
    expect(screen.getByText("redirect:/(app)/(tabs)/today")).toBeTruthy();
  });

  it("redirects to today when active habits exist even if onboarding is not completed (backfill will run)", () => {
    setup({
      eligibleHabits: [{ id: "habit-1" }],
      onboardingCompleted: false,
    });
    render(<RootEntryScreen />);
    expect(screen.getByText("redirect:/(app)/(tabs)/today")).toBeTruthy();
  });

  it("redirects to habit creation when onboarding is completed but no active habits remain", () => {
    setup({ onboardingCompleted: true });
    render(<RootEntryScreen />);
    expect(
      screen.getByText("redirect:/(app)/habits/create"),
    ).toBeTruthy();
  });

  it("redirects to onboarding when there are no habits and onboarding is not completed", () => {
    setup({ onboardingCompleted: false });
    render(<RootEntryScreen />);
    expect(screen.getByText("redirect:/(onboarding)")).toBeTruthy();
  });
});
