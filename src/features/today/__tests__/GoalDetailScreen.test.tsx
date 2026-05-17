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

jest.mock("@/features/reviews/hooks", () => ({
  useGoalReviewStatusQuery: jest.fn(() => ({ data: undefined, isError: false })),
}));

jest.mock("@/features/habits/hooks", () => ({
  useDeleteGoalMutation: jest.fn(),
  useGoalHabitCountQuery: jest.fn(),
}));

const { useGoalReviewStatusQuery: mockUseGoalReviewStatusQuery } = jest.requireMock(
  "@/features/reviews/hooks",
) as { useGoalReviewStatusQuery: jest.Mock };

const { useGoalDetail } = jest.requireMock("@/features/today/hooks") as {
  useGoalDetail: jest.Mock;
};

const {
  useDeleteGoalMutation,
  useGoalHabitCountQuery,
} = jest.requireMock("@/features/habits/hooks") as {
  useDeleteGoalMutation: jest.Mock;
  useGoalHabitCountQuery: jest.Mock;
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
  mockUseGoalReviewStatusQuery.mockReturnValue({
    data: undefined,
    isError: false,
    isFetching: false,
    refetch: jest.fn().mockResolvedValue(undefined),
  });
  useGoalHabitCountQuery.mockReturnValue({ data: 0 });
  useDeleteGoalMutation.mockReturnValue({
    mutate: jest.fn(),
    mutateAsync: jest.fn().mockResolvedValue({ deletedHabitCount: 0 }),
    isPending: false,
  });
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
  it("renders the review prompt card when goal-review status reports isDue", () => {
    useGoalDetail.mockReturnValue(
      baseDetail({ habits: [makeHabit()], oldestActiveDaysCount: 30 }),
    );
    mockUseGoalReviewStatusQuery.mockReturnValue({
      data: { allReviewed: false, habitsDue: ["h1"], habitsReviewed: [], isDue: true },
      isError: false,
    });
    renderWithClient(<GoalDetailScreen />);
    expect(screen.getByText(/Time to reflect on your week/)).toBeTruthy();
  });

  it("renders 'Reviewed this week' when goal-review status reports allReviewed", () => {
    useGoalDetail.mockReturnValue(
      baseDetail({ habits: [makeHabit()], oldestActiveDaysCount: 30 }),
    );
    mockUseGoalReviewStatusQuery.mockReturnValue({
      data: { allReviewed: true, habitsDue: [], habitsReviewed: ["h1"], isDue: false },
      isError: false,
    });
    renderWithClient(<GoalDetailScreen />);
    expect(screen.getByText("Reviewed this week ✓")).toBeTruthy();
  });

  it("surfaces an explicit error card when the eligible-habits upstream query (not the status query itself) fails", () => {
    const refetch = jest.fn().mockResolvedValue(undefined);
    useGoalDetail.mockReturnValue(
      baseDetail({ habits: [makeHabit()], oldestActiveDaysCount: 30 }),
    );
    // Status query never fires because upstream eligible-habits errored — but
    // the hook composes both states, so isError is still true here.
    mockUseGoalReviewStatusQuery.mockReturnValue({
      data: undefined,
      isError: true,
      isFetching: false,
      refetch,
    });
    renderWithClient(<GoalDetailScreen />);
    expect(
      screen.getByText(/couldn't check your review status/i),
    ).toBeTruthy();
    expect(screen.getByText("Retry")).toBeTruthy();
  });

  it("renders an explicit error card with an actionable Retry when the goal-review status query fails", () => {
    const refetch = jest.fn().mockResolvedValue(undefined);
    useGoalDetail.mockReturnValue(
      baseDetail({ habits: [makeHabit()], oldestActiveDaysCount: 30 }),
    );
    mockUseGoalReviewStatusQuery.mockReturnValue({
      data: undefined,
      isError: true,
      isFetching: false,
      refetch,
    });
    renderWithClient(<GoalDetailScreen />);
    expect(
      screen.getByText(/couldn't check your review status/i),
    ).toBeTruthy();
    expect(screen.queryByText(/Time to reflect on your week/)).toBeNull();
    expect(screen.queryByText("Reviewed this week ✓")).toBeNull();

    // Retry button is wired to the query's refetch
    const retryBtn = screen.getByText("Retry");
    fireEvent.press(retryBtn);
    expect(refetch).toHaveBeenCalledTimes(1);
  });

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

  it("renders an early-days narrative (rate-aware, not suppressed) when oldest habit has <7 active days", () => {
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
      screen.getByText("Finding your rhythm. Give it a week to settle."),
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

  describe("DangerZone — permanent delete", () => {
    function setupAlertSpy() {
      const { Alert } = require("react-native");
      return jest.spyOn(Alert, "alert").mockImplementation(() => undefined);
    }

    it("renders the danger zone when count > 0 and not read-only", () => {
      useGoalDetail.mockReturnValue(
        baseDetail({ habits: [makeHabit()], oldestActiveDaysCount: 30 }),
      );
      useGoalHabitCountQuery.mockReturnValue({ data: 2 });
      renderWithClient(<GoalDetailScreen />);
      expect(screen.getByText("DELETE GOAL")).toBeTruthy();
    });

    it("renders the danger zone when only archived/backlog habits exist (eligible=0, count>0)", () => {
      // useGoalDetail returns no eligible habits, but the count hook reports 1
      // (representing an archived or backlog habit under the same phrase).
      useGoalDetail.mockReturnValue(baseDetail({ habits: [] }));
      useGoalHabitCountQuery.mockReturnValue({ data: 1 });
      renderWithClient(<GoalDetailScreen />);
      expect(screen.getByText("DELETE GOAL")).toBeTruthy();
    });

    it("hides the danger zone when count is 0", () => {
      useGoalDetail.mockReturnValue(baseDetail({ habits: [makeHabit()] }));
      useGoalHabitCountQuery.mockReturnValue({ data: 0 });
      renderWithClient(<GoalDetailScreen />);
      expect(screen.queryByText("DELETE GOAL")).toBeNull();
    });

    it("hides the danger zone while the count query is still loading (data undefined)", () => {
      useGoalDetail.mockReturnValue(baseDetail({ habits: [makeHabit()] }));
      useGoalHabitCountQuery.mockReturnValue({ data: undefined });
      renderWithClient(<GoalDetailScreen />);
      expect(screen.queryByText("DELETE GOAL")).toBeNull();
    });

    it("hides the danger zone in read-only mode", () => {
      const { useTrialValidation } = jest.requireMock(
        "@/features/trial/hooks",
      ) as { useTrialValidation: jest.Mock };
      useTrialValidation.mockReturnValueOnce({
        accessMode: "read_only",
        isValidating: false,
        refresh: jest.fn(),
      });
      useGoalDetail.mockReturnValue(baseDetail({ habits: [makeHabit()] }));
      useGoalHabitCountQuery.mockReturnValue({ data: 3 });
      renderWithClient(<GoalDetailScreen />);
      expect(screen.queryByText("DELETE GOAL")).toBeNull();
    });

    it("confirmation count reflects all-status count from useGoalHabitCountQuery", () => {
      const alertSpy = setupAlertSpy();
      useGoalDetail.mockReturnValue(baseDetail({ habits: [makeHabit()] }));
      useGoalHabitCountQuery.mockReturnValue({ data: 3 });
      renderWithClient(<GoalDetailScreen />);
      fireEvent.press(screen.getByRole("button", { name: "Delete goal" }));
      expect(alertSpy).toHaveBeenCalledWith(
        "Delete this goal?",
        expect.stringContaining("Become a reader"),
        expect.any(Array),
      );
      const body = (alertSpy.mock.calls[0][1] ?? "") as string;
      expect(body).toMatch(/3 habits/);
      alertSpy.mockRestore();
    });

    it("uses singular 'habit' when total count is exactly 1", () => {
      const alertSpy = setupAlertSpy();
      useGoalDetail.mockReturnValue(baseDetail({ habits: [makeHabit()] }));
      useGoalHabitCountQuery.mockReturnValue({ data: 1 });
      renderWithClient(<GoalDetailScreen />);
      fireEvent.press(screen.getByRole("button", { name: "Delete goal" }));
      const body = (alertSpy.mock.calls[0][1] ?? "") as string;
      expect(body).toMatch(/1 habit\b/);
      expect(body).not.toMatch(/1 habits/);
      alertSpy.mockRestore();
    });

    it("shows 'Deleting…' label while the mutation is pending", () => {
      useGoalDetail.mockReturnValue(baseDetail({ habits: [makeHabit()] }));
      useGoalHabitCountQuery.mockReturnValue({ data: 2 });
      useDeleteGoalMutation.mockReturnValue({
        mutate: jest.fn(),
        mutateAsync: jest.fn(),
        isPending: true,
      });
      renderWithClient(<GoalDetailScreen />);
      expect(screen.getByText("Deleting…")).toBeTruthy();
    });
  });
});
