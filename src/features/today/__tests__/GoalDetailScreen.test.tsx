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

import { fireEvent, render, screen, waitFor } from "@testing-library/react-native";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import React from "react";

import GoalDetailScreen from "@/features/today/screens/GoalDetailScreen";
import { resetClockForTesting, setNowForTesting } from "@/utils/clock";

const mockPush = jest.fn();
const mockReplace = jest.fn();

jest.mock("expo-router", () => ({
  router: {
    back: jest.fn(),
    push: (...args: unknown[]) => mockPush(...args),
    replace: (...args: unknown[]) => mockReplace(...args),
  },
  useLocalSearchParams: () => ({ identityPhrase: "a%20reader" }),
}));

jest.mock("@/features/today/hooks", () => ({
  useGoalDetail: jest.fn(),
}));

jest.mock("@/features/reviews/hooks", () => ({
  useGoalReviewStatusQuery: jest.fn(() => ({ data: undefined, isError: false })),
}));

jest.mock("@/features/habits/hooks", () => ({
  useArchiveGoalMutation: jest.fn(),
  useGoalCascadeCountQuery: jest.fn(),
  useGoalHabitCountQuery: jest.fn(),
}));

const { useGoalReviewStatusQuery: mockUseGoalReviewStatusQuery } = jest.requireMock(
  "@/features/reviews/hooks",
) as { useGoalReviewStatusQuery: jest.Mock };

const { useGoalDetail } = jest.requireMock("@/features/today/hooks") as {
  useGoalDetail: jest.Mock;
};

const {
  useArchiveGoalMutation,
  useGoalCascadeCountQuery,
  useGoalHabitCountQuery,
} = jest.requireMock("@/features/habits/hooks") as {
  useArchiveGoalMutation: jest.Mock;
  useGoalCascadeCountQuery: jest.Mock;
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
  // Default: counts have settled. Tests that exercise stale-route paths
  // override these. Most tests need at least one active habit (via
  // useGoalDetail's habits mock), so the default cascade count of 1
  // reflects that — keeps the Archive card visible by default.
  useGoalCascadeCountQuery.mockReturnValue({ data: 1, isLoading: false });
  useGoalHabitCountQuery.mockReturnValue({ data: 1, isLoading: false });
  useArchiveGoalMutation.mockReturnValue({
    mutate: jest.fn(),
    mutateAsync: jest.fn().mockResolvedValue({ cascadedHabitCount: 0 }),
    isPending: false,
  });
  setNowForTesting(new Date("2026-05-05T10:00:00.000Z"));
});
afterEach(() => {
  resetClockForTesting();
});

function baseDetail(overrides: Partial<Record<string, unknown>> = {}) {
  return {
    earliestStartDate: "2026-05-05",
    error: null,
    goalConsistencyRate: 0,
    goalDailyStates: Array(28).fill("off"),
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

  // Stale-route redirects: the live Goal Detail surface requires at least
  // one active habit. Every other shape (empty phrase, backlog-only,
  // fully-archived, mixed-no-active) routes the user away. Plan §5
  // contract: backlog-only is "neither surface"; fully-archived belongs
  // on the archived route.
  describe("stale-route redirect (no active habits)", () => {
    it("redirects to Today when the phrase has no habits at all", async () => {
      useGoalDetail.mockReturnValue(baseDetail());
      useGoalCascadeCountQuery.mockReturnValue({ data: 0, isLoading: false });
      useGoalHabitCountQuery.mockReturnValue({ data: 0, isLoading: false });
      renderWithClient(<GoalDetailScreen />);
      await waitFor(() => {
        expect(mockReplace).toHaveBeenCalledWith("/(app)/(tabs)/today");
      });
    });

    it("redirects to archived detail when the phrase is fully archived (cascade=0, total>0)", async () => {
      useGoalDetail.mockReturnValue(baseDetail());
      useGoalCascadeCountQuery.mockReturnValue({ data: 0, isLoading: false });
      useGoalHabitCountQuery.mockReturnValue({ data: 2, isLoading: false });
      renderWithClient(<GoalDetailScreen />);
      await waitFor(() => {
        expect(mockReplace).toHaveBeenCalledWith({
          pathname: "/(app)/goals/archived/[identityPhrase]",
          params: { identityPhrase: encodeURIComponent("a reader") },
        });
      });
    });

    it("redirects to Today when the phrase is backlog-only (cascade>0, no active habits)", async () => {
      // Backlog-only matches the "neither surface" rule in the plan —
      // backlog rows aren't a live goal yet, and aren't an archived goal
      // either. Today is the safe landing.
      useGoalDetail.mockReturnValue(baseDetail({ habits: [] }));
      useGoalCascadeCountQuery.mockReturnValue({ data: 1, isLoading: false });
      useGoalHabitCountQuery.mockReturnValue({ data: 1, isLoading: false });
      renderWithClient(<GoalDetailScreen />);
      await waitFor(() => {
        expect(mockReplace).toHaveBeenCalledWith("/(app)/(tabs)/today");
      });
    });

    it("does NOT redirect while the count queries are still loading", () => {
      useGoalDetail.mockReturnValue(baseDetail());
      useGoalCascadeCountQuery.mockReturnValue({ data: undefined, isLoading: true });
      useGoalHabitCountQuery.mockReturnValue({ data: undefined, isLoading: true });
      renderWithClient(<GoalDetailScreen />);
      expect(mockReplace).not.toHaveBeenCalled();
    });

    it("does NOT redirect while useGoalDetail is still loading", () => {
      useGoalDetail.mockReturnValue(baseDetail({ isLoading: true }));
      useGoalCascadeCountQuery.mockReturnValue({ data: 0, isLoading: false });
      useGoalHabitCountQuery.mockReturnValue({ data: 0, isLoading: false });
      renderWithClient(<GoalDetailScreen />);
      expect(mockReplace).not.toHaveBeenCalled();
    });

    it("suppresses the empty shell during redirect — no 'No habits' card, no Archive CTA", () => {
      useGoalDetail.mockReturnValue(baseDetail());
      useGoalCascadeCountQuery.mockReturnValue({ data: 0, isLoading: false });
      useGoalHabitCountQuery.mockReturnValue({ data: 0, isLoading: false });
      renderWithClient(<GoalDetailScreen />);
      // The old "No habits found for this goal." card is gone — replaced
      // by the redirect path.
      expect(screen.queryByText("No habits found for this goal.")).toBeNull();
      expect(screen.queryByText("ARCHIVE GOAL")).toBeNull();
      expect(screen.getByText("Loading goal...")).toBeTruthy();
    });

    it("does NOT redirect on error — surfaces the existing error card instead", () => {
      useGoalDetail.mockReturnValue(baseDetail({ error: new Error("boom") }));
      useGoalCascadeCountQuery.mockReturnValue({ data: 0, isLoading: false });
      useGoalHabitCountQuery.mockReturnValue({ data: 0, isLoading: false });
      renderWithClient(<GoalDetailScreen />);
      expect(mockReplace).not.toHaveBeenCalled();
    });
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

  it("renders the goal consistency donut at the pooled rate (regression for 1-of-2-done → 50%)", () => {
    useGoalDetail.mockReturnValue(
      baseDetail({
        goalConsistencyRate: 0.5,
        goalStreak: 0,
        habits: [makeHabit()],
        oldestActiveDaysCount: 30,
      }),
    );
    renderWithClient(<GoalDetailScreen />);
    expect(screen.getByTestId("goal-consistency-donut")).toBeTruthy();
    expect(screen.getByText("50%")).toBeTruthy();
  });

  it("hides the donut and shows NOT_STARTED copy when goalConsistencyRate is null", () => {
    useGoalDetail.mockReturnValue(
      baseDetail({
        goalConsistencyRate: null,
        goalStreak: 0,
        habits: [makeHabit()],
        oldestActiveDaysCount: 0,
      }),
    );
    renderWithClient(<GoalDetailScreen />);
    expect(screen.queryByTestId("goal-consistency-donut")).toBeNull();
    expect(screen.getByText("This goal hasn't started yet.")).toBeTruthy();
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

  describe("Archive — soft delete on live Goal Detail", () => {
    function setupAlertSpy() {
      const { Alert } = require("react-native");
      return jest.spyOn(Alert, "alert").mockImplementation(() => undefined);
    }

    it("renders the Archive card when count > 0 and not read-only", () => {
      useGoalDetail.mockReturnValue(
        baseDetail({ habits: [makeHabit()], oldestActiveDaysCount: 30 }),
      );
      useGoalCascadeCountQuery.mockReturnValue({ data: 2 });
      renderWithClient(<GoalDetailScreen />);
      expect(screen.getByText("ARCHIVE GOAL")).toBeTruthy();
      // No Delete button on the live surface — only Archive.
      expect(screen.queryByText("DELETE GOAL")).toBeNull();
    });

    it("does NOT render the Archive card when there are no active habits — stale-route redirect takes over", () => {
      // Previously codified the inverse behavior (Archive CTA on a screen
      // with no visible habits). That contradicted the plan §5 contract:
      // backlog-only is "neither surface", fully-archived belongs on the
      // archived route. Now the redirect short-circuits before any CTA
      // mounts.
      useGoalDetail.mockReturnValue(baseDetail({ habits: [] }));
      useGoalCascadeCountQuery.mockReturnValue({ data: 1, isLoading: false });
      useGoalHabitCountQuery.mockReturnValue({ data: 1, isLoading: false });
      renderWithClient(<GoalDetailScreen />);
      expect(screen.queryByText("ARCHIVE GOAL")).toBeNull();
    });

    it("hides the Archive card when count is 0", () => {
      useGoalDetail.mockReturnValue(baseDetail({ habits: [makeHabit()] }));
      useGoalCascadeCountQuery.mockReturnValue({ data: 0 });
      renderWithClient(<GoalDetailScreen />);
      expect(screen.queryByText("ARCHIVE GOAL")).toBeNull();
    });

    it("hides the Archive card while the count query is still loading (data undefined)", () => {
      useGoalDetail.mockReturnValue(baseDetail({ habits: [makeHabit()] }));
      useGoalCascadeCountQuery.mockReturnValue({ data: undefined });
      renderWithClient(<GoalDetailScreen />);
      expect(screen.queryByText("ARCHIVE GOAL")).toBeNull();
    });

    it("hides the Archive card in read-only mode", () => {
      const { useTrialValidation } = jest.requireMock(
        "@/features/trial/hooks",
      ) as { useTrialValidation: jest.Mock };
      useTrialValidation.mockReturnValueOnce({
        accessMode: "read_only",
        isValidating: false,
        refresh: jest.fn(),
      });
      useGoalDetail.mockReturnValue(baseDetail({ habits: [makeHabit()] }));
      useGoalCascadeCountQuery.mockReturnValue({ data: 3 });
      renderWithClient(<GoalDetailScreen />);
      expect(screen.queryByText("ARCHIVE GOAL")).toBeNull();
    });

    it("confirmation copy uses the cascade count from useGoalCascadeCountQuery (active+backlog only)", () => {
      // Regression: previously used total habit count which overstated the
      // move when an already-archived habit existed under the same phrase.
      // archiveGoal's WHERE clause is `status IN ('active','backlog')`, so
      // the copy MUST reflect what actually moves.
      const alertSpy = setupAlertSpy();
      useGoalDetail.mockReturnValue(baseDetail({ habits: [makeHabit()] }));
      useGoalCascadeCountQuery.mockReturnValue({ data: 3 });
      renderWithClient(<GoalDetailScreen />);
      fireEvent.press(screen.getByRole("button", { name: "Archive goal" }));
      expect(alertSpy).toHaveBeenCalledWith(
        "Archive this goal?",
        expect.any(String),
        expect.any(Array),
      );
      const body = (alertSpy.mock.calls[0][1] ?? "") as string;
      expect(body).toMatch(/3 habits/);
      expect(body).toMatch(/restore/i);
      alertSpy.mockRestore();
    });

    it("hides Archive when cascade count is 0 even if total habits > 0 (all rows already archived)", () => {
      // Edge case: a phrase whose only habits are already archived has
      // nothing for the cascade to move. Archive button would be a no-op,
      // so hide it.
      useGoalDetail.mockReturnValue(baseDetail({ habits: [makeHabit()] }));
      useGoalCascadeCountQuery.mockReturnValue({ data: 0 });
      renderWithClient(<GoalDetailScreen />);
      expect(screen.queryByText("ARCHIVE GOAL")).toBeNull();
    });

    it("uses singular 'habit' when total count is exactly 1", () => {
      const alertSpy = setupAlertSpy();
      useGoalDetail.mockReturnValue(baseDetail({ habits: [makeHabit()] }));
      useGoalCascadeCountQuery.mockReturnValue({ data: 1 });
      renderWithClient(<GoalDetailScreen />);
      fireEvent.press(screen.getByRole("button", { name: "Archive goal" }));
      const body = (alertSpy.mock.calls[0][1] ?? "") as string;
      expect(body).toMatch(/1 habit\b/);
      expect(body).not.toMatch(/1 habits/);
      alertSpy.mockRestore();
    });

    it("shows 'Archiving…' label while the mutation is pending", () => {
      useGoalDetail.mockReturnValue(baseDetail({ habits: [makeHabit()] }));
      useGoalCascadeCountQuery.mockReturnValue({ data: 2 });
      useArchiveGoalMutation.mockReturnValue({
        mutate: jest.fn(),
        mutateAsync: jest.fn(),
        isPending: true,
      });
      renderWithClient(<GoalDetailScreen />);
      expect(screen.getByText("Archiving…")).toBeTruthy();
    });

    it("Archive button is NOT styled as destructive — no destructive-text on the alert option", () => {
      const alertSpy = setupAlertSpy();
      useGoalDetail.mockReturnValue(baseDetail({ habits: [makeHabit()] }));
      useGoalCascadeCountQuery.mockReturnValue({ data: 2 });
      renderWithClient(<GoalDetailScreen />);
      fireEvent.press(screen.getByRole("button", { name: "Archive goal" }));
      const buttons = (alertSpy.mock.calls[0][2] ?? []) as Array<{
        text: string;
        style?: string;
      }>;
      const archiveBtn = buttons.find((b) => b.text === "Archive");
      expect(archiveBtn).toBeDefined();
      // Archive is recoverable — must not carry the iOS destructive treatment.
      expect(archiveBtn?.style).not.toBe("destructive");
      alertSpy.mockRestore();
    });
  });
});
