jest.mock("@/features/trial/hooks", () => ({
  useTrialValidation: jest.fn(() => ({
    accessMode: "full",
    entitlementStatus: "trial",
    isBootstrapping: false,
    isValidating: false,
    lastValidatedAt: null,
    refresh: jest.fn().mockResolvedValue(undefined),
    trialEndsAt: null,
    trialStartedAt: null,
  })),
}));

import { fireEvent, render, screen } from "@testing-library/react-native";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import React from "react";

import GoalDetailScreen from "@/features/today/screens/GoalDetailScreen";
import { resetClockForTesting, setNowForTesting } from "@/utils/clock";

const mockPush = jest.fn();

jest.mock("expo-router", () => ({
  router: { back: jest.fn(), push: (...args: unknown[]) => mockPush(...args) },
  useLocalSearchParams: () => ({ identityPhrase: "a%20reader" }),
}));

jest.mock("@/features/today/hooks", () => ({
  useGoalDetail: jest.fn(),
}));

const { useGoalDetail } = jest.requireMock("@/features/today/hooks") as {
  useGoalDetail: jest.Mock;
};

function renderWithClient(ui: React.ReactElement) {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return render(<QueryClientProvider client={client}>{ui}</QueryClientProvider>);
}

function makeHabit(overrides: Partial<Record<string, unknown>> = {}) {
  return {
    activeDays: [1, 2, 3, 4, 5, 6, 7],
    consistencyRate: 0.8,
    icon: null,
    id: "h1",
    logs: [],
    name: "Run",
    skipCount: 0,
    startDate: "2026-04-01",
    streak: 10,
    ...overrides,
  };
}

beforeEach(() => {
  jest.clearAllMocks();
  setNowForTesting(new Date("2026-05-05T10:00:00.000Z"));
});
afterEach(() => {
  resetClockForTesting();
});

describe("GoalDetailScreen", () => {
  it("renders loading state", () => {
    useGoalDetail.mockReturnValue({
      error: null,
      goalConsistencyRate: 0,
      goalStreak: 0,
      habits: [],
      identityPhrase: "a reader",
      isLoading: true,
    });
    renderWithClient(<GoalDetailScreen />);
    expect(screen.getByText("Loading goal...")).toBeTruthy();
  });

  it("renders goal headline and streak copy", () => {
    useGoalDetail.mockReturnValue({
      error: null,
      goalConsistencyRate: 0.75,
      goalStreak: 12,
      habits: [makeHabit()],
      identityPhrase: "a reader",
      isLoading: false,
    });
    renderWithClient(<GoalDetailScreen />);
    expect(screen.getByText("Become a reader")).toBeTruthy();
    // streak copy for 12 → "12-day streak. One day at a time."
    expect(screen.getByText("12-day streak. One day at a time.")).toBeTruthy();
  });

  it("renders habit rows with name and metrics", () => {
    useGoalDetail.mockReturnValue({
      error: null,
      goalConsistencyRate: 0.8,
      goalStreak: 5,
      habits: [
        makeHabit({ id: "h1", name: "Read", consistencyRate: 0.8, streak: 5 }),
        makeHabit({ id: "h2", name: "Run", consistencyRate: 0.6, streak: 3 }),
      ],
      identityPhrase: "a reader",
      isLoading: false,
    });
    renderWithClient(<GoalDetailScreen />);
    expect(screen.getByText("Read")).toBeTruthy();
    expect(screen.getByText("Run")).toBeTruthy();
  });

  it("navigates to HabitDetail with goalConsistency when a habit row is tapped", () => {
    useGoalDetail.mockReturnValue({
      error: null,
      goalConsistencyRate: 0.75,
      goalStreak: 5,
      habits: [makeHabit({ id: "h1", name: "Read" })],
      identityPhrase: "a reader",
      isLoading: false,
    });
    renderWithClient(<GoalDetailScreen />);
    fireEvent.press(screen.getByText("Read"));
    expect(mockPush).toHaveBeenCalledWith(
      expect.objectContaining({
        pathname: "/(app)/habits/[habitId]",
        params: expect.objectContaining({ habitId: "h1" }),
      }),
    );
  });

  it("shows empty state when no habits match the identity phrase", () => {
    useGoalDetail.mockReturnValue({
      error: null,
      goalConsistencyRate: 0,
      goalStreak: 0,
      habits: [],
      identityPhrase: "a reader",
      isLoading: false,
    });
    renderWithClient(<GoalDetailScreen />);
    expect(screen.getByText("No habits found for this goal.")).toBeTruthy();
  });

  it("shows 'Too early to tell' when oldest habit has <7 active days", () => {
    // startDate = today → 0 active days counted
    useGoalDetail.mockReturnValue({
      error: null,
      goalConsistencyRate: 0.5,
      goalStreak: 1,
      habits: [makeHabit({ startDate: "2026-05-05" })],
      identityPhrase: "a reader",
      isLoading: false,
    });
    renderWithClient(<GoalDetailScreen />);
    expect(screen.getByText("Too early to tell — keep showing up")).toBeTruthy();
  });

  it("decodes URL-encoded identityPhrase param", () => {
    // useLocalSearchParams returns "a%20reader" → decoded to "a reader"
    useGoalDetail.mockReturnValue({
      error: null,
      goalConsistencyRate: 0,
      goalStreak: 0,
      habits: [],
      identityPhrase: "a reader",
      isLoading: false,
    });
    renderWithClient(<GoalDetailScreen />);
    // useGoalDetail should have been called with the decoded phrase
    expect(useGoalDetail).toHaveBeenCalledWith("a reader");
  });
});
