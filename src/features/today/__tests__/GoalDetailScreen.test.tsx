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

function baseDetail(overrides: Partial<Record<string, unknown>> = {}) {
  return {
    error: null,
    goalConsistencyRate: 0,
    goalDailyStates: Array(14).fill("off"),
    goalStreak: 0,
    habits: [],
    identityPhrase: "a reader",
    isLoading: false,
    oldestActiveDaysCount: 0,
    weeklyData: [],
    ...overrides,
  };
}

describe("GoalDetailScreen", () => {
  it("renders loading state", () => {
    useGoalDetail.mockReturnValue(baseDetail({ isLoading: true }));
    renderWithClient(<GoalDetailScreen />);
    expect(screen.getByText("Loading goal...")).toBeTruthy();
  });

  it("renders goal headline and streak copy", () => {
    useGoalDetail.mockReturnValue(
      baseDetail({
        goalConsistencyRate: 0.75,
        goalStreak: 12,
        habits: [makeHabit()],
        oldestActiveDaysCount: 30,
      }),
    );
    renderWithClient(<GoalDetailScreen />);
    expect(screen.getByText("Become a reader")).toBeTruthy();
    expect(screen.getByText("12-day streak. One day at a time.")).toBeTruthy();
  });

  it("renders habit rows with name and metrics", () => {
    useGoalDetail.mockReturnValue(
      baseDetail({
        goalConsistencyRate: 0.8,
        goalStreak: 5,
        habits: [
          makeHabit({ id: "h1", name: "Read", consistencyRate: 0.8, streak: 5 }),
          makeHabit({ id: "h2", name: "Run", consistencyRate: 0.6, streak: 3 }),
        ],
        oldestActiveDaysCount: 30,
      }),
    );
    renderWithClient(<GoalDetailScreen />);
    expect(screen.getByText("Read")).toBeTruthy();
    expect(screen.getByText("Run")).toBeTruthy();
  });

  it("navigates to HabitDetail with goalConsistency when a habit row is tapped", () => {
    useGoalDetail.mockReturnValue(
      baseDetail({
        goalConsistencyRate: 0.75,
        goalStreak: 5,
        habits: [makeHabit({ id: "h1", name: "Read" })],
        oldestActiveDaysCount: 30,
      }),
    );
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
    useGoalDetail.mockReturnValue(baseDetail());
    renderWithClient(<GoalDetailScreen />);
    expect(screen.getByText("No habits found for this goal.")).toBeTruthy();
  });

  it("renders a suppressed narrative when oldest habit has <7 active days", () => {
    useGoalDetail.mockReturnValue(
      baseDetail({
        goalConsistencyRate: 0.5,
        goalStreak: 1,
        habits: [makeHabit({ startDate: "2026-05-05" })],
        oldestActiveDaysCount: 0,
      }),
    );
    renderWithClient(<GoalDetailScreen />);
    expect(
      screen.getByText(
        "Day one done. Keep showing up — a picture will form after a week.",
      ),
    ).toBeTruthy();
  });

  it("decodes URL-encoded identityPhrase param", () => {
    useGoalDetail.mockReturnValue(baseDetail());
    renderWithClient(<GoalDetailScreen />);
    expect(useGoalDetail).toHaveBeenCalledWith("a reader");
  });

  it("shows the (Graduated) suffix on the headline when goalGraduated=true", () => {
    useGoalDetail.mockReturnValue(
      baseDetail({
        goalConsistencyRate: 0.9,
        goalGraduated: true,
        goalStreak: 50,
        habits: [makeHabit()],
        oldestActiveDaysCount: 90,
      }),
    );
    renderWithClient(<GoalDetailScreen />);
    expect(screen.getByText("(Graduated)")).toBeTruthy();
  });

  it("hides the (Graduated) suffix when goalGraduated=false", () => {
    useGoalDetail.mockReturnValue(
      baseDetail({
        goalConsistencyRate: 0.5,
        goalGraduated: false,
        goalStreak: 3,
        habits: [makeHabit()],
        oldestActiveDaysCount: 30,
      }),
    );
    renderWithClient(<GoalDetailScreen />);
    expect(screen.queryByText("(Graduated)")).toBeNull();
  });

  it("hides the (Graduated) suffix when an upcoming habit exists in the goal (hook reports goalGraduated=false)", () => {
    // The screen trusts the hook's goalGraduated boolean; this test asserts
    // the contract by passing the false value the upstream hook computes when
    // upcoming habits are part of the goal.
    useGoalDetail.mockReturnValue(
      baseDetail({
        goalConsistencyRate: 0.9,
        goalGraduated: false,
        goalStreak: 50,
        habits: [makeHabit()],
        oldestActiveDaysCount: 90,
      }),
    );
    renderWithClient(<GoalDetailScreen />);
    expect(screen.queryByText("(Graduated)")).toBeNull();
  });
});
