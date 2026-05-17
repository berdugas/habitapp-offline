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

import { fireEvent, render, screen, waitFor } from "@testing-library/react-native";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import React from "react";

import HabitDetailScreen from "@/features/habits/screens/HabitDetailScreen";
import { resetClockForTesting, setNowForTesting } from "@/utils/clock";

jest.mock("expo-router", () => ({
  router: { push: jest.fn() },
  useLocalSearchParams: () => ({ habitId: "habit-1" }),
}));

jest.mock("@/features/habits/hooks", () => ({
  useArchiveHabitMutation: jest.fn(),
  useDeleteHabitMutation: jest.fn(),
  useHabitDetail: jest.fn(),
  useUpsertHabitLogMutation: jest.fn(),
}));

jest.mock("@/features/today/hooks", () => ({
  useHabitLogsForRange: jest.fn(),
}));

jest.mock("@/features/graduation/hooks", () => ({
  useLatestSRHIQuery: jest.fn(() => ({
    data: null,
    isLoading: false,
    isSuccess: true,
  })),
}));

jest.mock("@/features/auth/hooks", () => ({
  useAuthSession: jest.fn(() => ({ user: { id: "user-1" } })),
}));

jest.mock("@/features/reviews/hooks", () => ({
  useLatestWeeklyReviewQuery: jest.fn(() => ({
    data: null,
    error: null,
    isFetching: false,
    refetch: jest.fn().mockResolvedValue(undefined),
  })),
}));

const { useLatestWeeklyReviewQuery } = jest.requireMock(
  "@/features/reviews/hooks",
) as { useLatestWeeklyReviewQuery: jest.Mock };

jest.mock("@/lib/db/repositories/reminders", () => ({
  getReminderByHabitId: jest.fn().mockResolvedValue(null),
}));

jest.mock("@/features/reminders/notifications", () => ({
  cancelReminder: jest.fn().mockResolvedValue(undefined),
  hasBeenPrompted: jest.fn().mockResolvedValue(true),
  markPrompted: jest.fn().mockResolvedValue(undefined),
  requestPermission: jest.fn().mockResolvedValue(true),
  scheduleReminder: jest.fn().mockResolvedValue(undefined),
}));

const {
  useHabitDetail,
  useArchiveHabitMutation,
  useDeleteHabitMutation,
  useUpsertHabitLogMutation,
} = jest.requireMock("@/features/habits/hooks") as {
  useHabitDetail: jest.Mock;
  useArchiveHabitMutation: jest.Mock;
  useDeleteHabitMutation: jest.Mock;
  useUpsertHabitLogMutation: jest.Mock;
};

const { useHabitLogsForRange } = jest.requireMock(
  "@/features/today/hooks",
) as { useHabitLogsForRange: jest.Mock };

const { useLatestSRHIQuery } = jest.requireMock(
  "@/features/graduation/hooks",
) as { useLatestSRHIQuery: jest.Mock };

const { useTrialValidation } = jest.requireMock(
  "@/features/trial/hooks",
) as { useTrialValidation: jest.Mock };

function renderWithClient(ui: React.ReactElement) {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return render(<QueryClientProvider client={client}>{ui}</QueryClientProvider>);
}

function makeHabit(overrides: Partial<Record<string, unknown>> = {}) {
  return {
    active_days: "[1,2,3,4,5,6,7]",
    archived_at: null,
    created_at: "2026-04-01T00:00:00.000Z",
    cue: "morning coffee",
    habit_state: "active",
    icon: null,
    id: "habit-1",
    identity_phrase: "a runner",
    minimum_viable_action: null,
    preferred_time_window: null,
    start_date: "2026-04-01",
    status: "active",
    tiny_action: "run for 2 minutes",
    title: "Run",
    updated_at: "2026-04-01T00:00:00.000Z",
    user_id: "user-1",
    ...overrides,
  };
}

function makeProgress(overrides: Partial<Record<string, unknown>> = {}) {
  return {
    consistencyRate: 0.85,
    skipCount: 2,
    streak: 12,
    todayStatus: null,
    ...overrides,
  };
}

describe("HabitDetailScreen", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    setNowForTesting(new Date("2026-04-30T10:00:00.000Z"));
    useArchiveHabitMutation.mockReturnValue({
      mutateAsync: jest.fn().mockResolvedValue(undefined),
      isPending: false,
      error: null,
    });
    useDeleteHabitMutation.mockReturnValue({
      mutateAsync: jest.fn().mockResolvedValue(undefined),
      isPending: false,
      error: null,
    });
    useUpsertHabitLogMutation.mockReturnValue({
      mutateAsync: jest.fn().mockResolvedValue(undefined),
      isPending: false,
      error: null,
    });
    useHabitLogsForRange.mockReturnValue({ data: [] });
    useLatestWeeklyReviewQuery.mockReturnValue({
      data: null,
      error: null,
      isFetching: false,
      refetch: jest.fn().mockResolvedValue(undefined),
    });
  });

  afterEach(() => {
    resetClockForTesting();
  });

  it("renders the 'Become [identity_phrase]' header when identity phrase is present", () => {
    useHabitDetail.mockReturnValue({
      error: null,
      formula: "After morning coffee, run for 2 minutes",
      habit: makeHabit(),
      isLoading: false,
      isUpcoming: false,
      latestReview: null,
      progress: makeProgress(),
      recentLogs: [],
    });
    renderWithClient(<HabitDetailScreen />);
    // "Become a runner" appears in the header AND the goal breadcrumb below metrics
    expect(screen.getAllByText("Become a runner").length).toBeGreaterThanOrEqual(1);
  });

  it("shows an explicit error card with an actionable Retry and suppresses the Start review prompt when the latest-review query errored", () => {
    const refetch = jest.fn().mockResolvedValue(undefined);
    useHabitDetail.mockReturnValue({
      error: null,
      formula: "After morning coffee, run for 2 minutes",
      // Habit started 30+ days ago so isWeeklyReviewDue would normally return true
      habit: makeHabit({ start_date: "2026-03-15" }),
      isLoading: false,
      isUpcoming: false,
      latestReview: null,
      progress: makeProgress(),
      recentLogs: [],
    });
    useLatestWeeklyReviewQuery.mockReturnValue({
      data: null,
      error: new Error("DB read failed"),
      isFetching: false,
      refetch,
    });
    renderWithClient(<HabitDetailScreen />);
    expect(
      screen.getByText(/couldn't check your review status/i),
    ).toBeTruthy();
    // The screen must NOT fall open to "Start review" when we can't confirm
    // that this week's review doesn't already exist.
    expect(screen.queryByText("Start review")).toBeNull();

    // Retry button calls the underlying query's refetch
    fireEvent.press(screen.getByText("Retry"));
    expect(refetch).toHaveBeenCalledTimes(1);
  });

  it("does not render the 'Become' header when identity_phrase is null", () => {
    useHabitDetail.mockReturnValue({
      error: null,
      formula: "After morning coffee, run for 2 minutes",
      habit: makeHabit({ identity_phrase: null }),
      isLoading: false,
      isUpcoming: false,
      latestReview: null,
      progress: makeProgress(),
      recentLogs: [],
    });
    renderWithClient(<HabitDetailScreen />);
    expect(screen.queryByText(/^Become /)).toBeNull();
  });

  it("renders streak number inside the Journey Card streak strip", () => {
    useHabitDetail.mockReturnValue({
      error: null,
      formula: "After morning coffee, run for 2 minutes",
      habit: makeHabit(),
      isLoading: false,
      isUpcoming: false,
      latestReview: null,
      progress: makeProgress({ streak: 12 }),
      recentLogs: [],
    });
    renderWithClient(<HabitDetailScreen />);
    expect(screen.getByText("12 day streak")).toBeTruthy();
  });

  it("does not render aggregate skip count (intentionally dropped in the Journey Card)", () => {
    useHabitDetail.mockReturnValue({
      error: null,
      formula: "After morning coffee, run for 2 minutes",
      habit: makeHabit(),
      isLoading: false,
      isUpcoming: false,
      latestReview: null,
      progress: makeProgress({ consistencyRate: 0.85, skipCount: 2 }),
      recentLogs: [],
    });
    renderWithClient(<HabitDetailScreen />);
    expect(screen.queryByText("2 skips")).toBeNull();
  });

  it("renders the calendar grid when logs are loaded", () => {
    useHabitLogsForRange.mockReturnValue({
      data: [
        { log_date: "2026-04-29", status: "done" },
        { log_date: "2026-04-28", status: "skipped" },
      ],
    });
    useHabitDetail.mockReturnValue({
      error: null,
      formula: "After morning coffee, run for 2 minutes",
      habit: makeHabit(),
      isLoading: false,
      isUpcoming: false,
      latestReview: null,
      progress: makeProgress(),
      recentLogs: [],
    });
    renderWithClient(<HabitDetailScreen />);
    expect(screen.getByLabelText("2026-04-29, done")).toBeTruthy();
    expect(screen.getByLabelText("2026-04-28, skipped")).toBeTruthy();
  });

  it("does not render the calendar or streak when habit is upcoming", () => {
    useHabitDetail.mockReturnValue({
      error: null,
      formula: "After morning coffee, run for 2 minutes",
      habit: makeHabit({ start_date: "2026-05-15" }),
      isLoading: false,
      isUpcoming: true,
      latestReview: null,
      progress: makeProgress({ streak: 0 }),
      recentLogs: [],
    });
    renderWithClient(<HabitDetailScreen />);
    expect(screen.queryByText("LAST 30 DAYS")).toBeNull();
    expect(screen.queryByText("CURRENT STREAK")).toBeNull();
  });

  it("opens the selector with canEdit=true when an in-window cell is tapped", async () => {
    // Today is April 30 10:00. April 29 is ~34h ago — within the 48h window.
    // April 29 has no log so the cell state is "missed".
    useHabitDetail.mockReturnValue({
      error: null,
      formula: "After morning coffee, run for 2 minutes",
      habit: makeHabit({ start_date: "2026-04-01" }),
      isLoading: false,
      isUpcoming: false,
      latestReview: null,
      progress: makeProgress(),
      recentLogs: [],
    });
    renderWithClient(<HabitDetailScreen />);

    fireEvent.press(screen.getByLabelText("2026-04-29, missed"));

    await waitFor(() => {
      // "Done" also appears in the CalendarGrid legend — use getAllByText
      expect(screen.getAllByText("Done").length).toBeGreaterThanOrEqual(1);
      expect(screen.getByText("Skip")).toBeTruthy();
    });
  });

  it("opens the selector with canEdit=false when an out-of-window cell is tapped", async () => {
    // April 25 is 5 days ago — outside the 48h window. State = "missed".
    useHabitDetail.mockReturnValue({
      error: null,
      formula: "After morning coffee, run for 2 minutes",
      habit: makeHabit({ start_date: "2026-04-01" }),
      isLoading: false,
      isUpcoming: false,
      latestReview: null,
      progress: makeProgress(),
      recentLogs: [],
    });
    renderWithClient(<HabitDetailScreen />);

    fireEvent.press(screen.getByLabelText("2026-04-25, missed"));

    await waitFor(() => {
      expect(
        screen.getByText("This day is locked. Logs older than 48 hours can't be changed."),
      ).toBeTruthy();
    });
    // "Done" exists in the CalendarGrid legend — verify selector actions are absent instead
    expect(screen.queryByText("Skip")).toBeNull();
  });

  it("cells before habit.start_date are not present in the growing grid", () => {
    // start_date = April 27. With today = April 30 (Thu), the grid starts on Monday Apr 27
    // and shows only that week (Apr 27 – May 3). Apr 25 is before startDate and not in grid.
    useHabitDetail.mockReturnValue({
      error: null,
      formula: "After morning coffee, run for 2 minutes",
      habit: makeHabit({ start_date: "2026-04-27" }),
      isLoading: false,
      isUpcoming: false,
      latestReview: null,
      progress: makeProgress(),
      recentLogs: [],
    });
    renderWithClient(<HabitDetailScreen />);
    expect(screen.queryByLabelText(/2026-04-25/)).toBeNull();
  });

  it("renders formula text in header", () => {
    useHabitDetail.mockReturnValue({
      error: null,
      formula: "After morning coffee, I will run for 2 minutes.",
      habit: makeHabit(),
      isLoading: false,
      isUpcoming: false,
      latestReview: null,
      progress: makeProgress(),
      recentLogs: [],
    });
    renderWithClient(<HabitDetailScreen />);
    // Formula appears in the header AND in the Setup card → multiple matches expected
    expect(screen.getAllByText("After morning coffee, I will run for 2 minutes.").length).toBeGreaterThanOrEqual(1);
  });

  it("renders a single Journey Card with streak strip for non-upcoming habit", () => {
    useHabitDetail.mockReturnValue({
      error: null,
      formula: "After morning coffee, I will run.",
      habit: makeHabit(),
      isLoading: false,
      isUpcoming: false,
      latestReview: null,
      progress: makeProgress({ streak: 5 }),
      recentLogs: [],
    });
    renderWithClient(<HabitDetailScreen />);
    // The Journey Card replaces the two side-by-side cards.
    expect(screen.queryByText("HABIT CONSISTENCY")).toBeNull();
    expect(screen.queryByText("HABIT STREAK")).toBeNull();
    // It renders the streak strip's hero label.
    expect(screen.getByText("5 day streak")).toBeTruthy();
    // And the 14-day eyebrow.
    expect(screen.getByText("LAST 14 DAYS")).toBeTruthy();
  });

  it("renders early-days narrative copy without the legacy suppression text", () => {
    // start_date = today (2026-04-30) → 0 active days elapsed → Journey Card
    // shows the donut + early-days narrative from getGoalNarrative, NOT the
    // old "Too early to tell" suppression text.
    useHabitDetail.mockReturnValue({
      error: null,
      formula: "After morning coffee, I will run.",
      habit: makeHabit({ start_date: "2026-04-30" }),
      isLoading: false,
      isUpcoming: false,
      latestReview: null,
      progress: makeProgress({ consistencyRate: 1.0 }),
      recentLogs: [],
    });
    renderWithClient(<HabitDetailScreen />);
    expect(screen.queryByText("Too early to tell — keep showing up")).toBeNull();
    // Some early-days narrative string must render. The exact one depends on
    // consistencyRate + activeDaysCount; we assert that at least one of the
    // known EARLY_HIGH pool strings is present.
    const earlyHighMatches = [
      "Day one done. Come back tomorrow.",
      "Perfect so far. The real test is next week.",
      "Strong start. The pattern will tell the story.",
    ];
    const hasEarly = earlyHighMatches.some((s) => screen.queryByText(s));
    expect(hasEarly).toBe(true);
  });

  it("renders goal breadcrumb with identity phrase", () => {
    useHabitDetail.mockReturnValue({
      error: null,
      formula: "After morning coffee, I will run.",
      habit: makeHabit({ identity_phrase: "a runner" }),
      isLoading: false,
      isUpcoming: false,
      latestReview: null,
      progress: makeProgress(),
      recentLogs: [],
    });
    renderWithClient(<HabitDetailScreen />);
    expect(screen.getAllByText("Become a runner").length).toBeGreaterThanOrEqual(1);
  });

  describe("graduation prompt card", () => {
    // start_date well over 60 days before mocked "today" (2026-04-30)
    const ELIGIBLE_HABIT = { start_date: "2026-01-01" };
    const ELIGIBLE_PROGRESS = makeProgress({ consistencyRate: 0.85 });

    it("renders the prompt card when the habit is eligible (>= 60 active days, consistency >= 0.75, no cooldown)", () => {
      useHabitDetail.mockReturnValue({
        error: null,
        formula: "After morning coffee, I will run.",
        habit: makeHabit(ELIGIBLE_HABIT),
        isLoading: false,
        isUpcoming: false,
        latestReview: null,
        progress: ELIGIBLE_PROGRESS,
        recentLogs: [],
      });
      renderWithClient(<HabitDetailScreen />);
      expect(screen.getByText(/Ready to check if it.s become automatic\?/)).toBeTruthy();
      expect(screen.getByText("Start reflection")).toBeTruthy();
    });

    it("hides the card when the habit is too young (< 60 active days elapsed)", () => {
      useHabitDetail.mockReturnValue({
        error: null,
        formula: "After morning coffee, I will run.",
        habit: makeHabit({ start_date: "2026-04-01" }), // only 30 days
        isLoading: false,
        isUpcoming: false,
        latestReview: null,
        progress: ELIGIBLE_PROGRESS,
        recentLogs: [],
      });
      renderWithClient(<HabitDetailScreen />);
      expect(screen.queryByText("Start reflection")).toBeNull();
    });

    it("hides the card when habit_state is already 'automatic'", () => {
      useHabitDetail.mockReturnValue({
        error: null,
        formula: "After morning coffee, I will run.",
        habit: makeHabit({
          ...ELIGIBLE_HABIT,
          automated_at: "2026-04-25T00:00:00.000Z",
          habit_state: "automatic",
        }),
        isLoading: false,
        isUpcoming: false,
        latestReview: null,
        progress: ELIGIBLE_PROGRESS,
        recentLogs: [],
      });
      renderWithClient(<HabitDetailScreen />);
      expect(screen.queryByText("Start reflection")).toBeNull();
    });

    it("hides the card during the 14-day cooldown after a failed SRHI", () => {
      // Today is 2026-04-30; a failing SRHI from 2026-04-25 is 5 days ago → cooldown
      useLatestSRHIQuery.mockReturnValueOnce({
        data: {
          average_score: 2.33,
          created_at: "2026-04-25T12:00:00.000Z",
          graduated: false,
          habit_id: "habit-1",
          id: "srhi-1",
          q1_score: 2,
          q2_score: 3,
          q3_score: 2,
          user_id: "user-1",
        },
        isLoading: false,
        isSuccess: true,
      });
      useHabitDetail.mockReturnValue({
        error: null,
        formula: "After morning coffee, I will run.",
        habit: makeHabit(ELIGIBLE_HABIT),
        isLoading: false,
        isUpcoming: false,
        latestReview: null,
        progress: ELIGIBLE_PROGRESS,
        recentLogs: [],
      });
      renderWithClient(<HabitDetailScreen />);
      expect(screen.queryByText("Start reflection")).toBeNull();
    });

    it("hides the card in read-only access mode even when otherwise eligible", () => {
      useTrialValidation.mockReturnValueOnce({
        accessMode: "read_only",
        entitlementStatus: "trial_expired",
        isBootstrapping: false,
        isValidating: false,
        lastValidatedAt: null,
        refresh: jest.fn().mockResolvedValue(undefined),
        trialEndsAt: null,
        trialStartedAt: null,
      });
      useHabitDetail.mockReturnValue({
        error: null,
        formula: "After morning coffee, I will run.",
        habit: makeHabit(ELIGIBLE_HABIT),
        isLoading: false,
        isUpcoming: false,
        latestReview: null,
        progress: ELIGIBLE_PROGRESS,
        recentLogs: [],
      });
      renderWithClient(<HabitDetailScreen />);
      expect(screen.queryByText("Start reflection")).toBeNull();
    });

    it("hides the card while the latest SRHI query is still loading (avoids a flash for habits in cooldown)", () => {
      useLatestSRHIQuery.mockReturnValueOnce({
        data: undefined,
        isLoading: true,
        isSuccess: false,
      });
      useHabitDetail.mockReturnValue({
        error: null,
        formula: "After morning coffee, I will run.",
        habit: makeHabit(ELIGIBLE_HABIT),
        isLoading: false,
        isUpcoming: false,
        latestReview: null,
        progress: ELIGIBLE_PROGRESS,
        recentLogs: [],
      });
      renderWithClient(<HabitDetailScreen />);
      expect(screen.queryByText("Start reflection")).toBeNull();
    });

    it("hides the card when the latest SRHI query errors (avoids silently treating failure as 'no prior response')", () => {
      useLatestSRHIQuery.mockReturnValueOnce({
        data: undefined,
        error: new Error("network down"),
        isLoading: false,
        isSuccess: false,
      });
      useHabitDetail.mockReturnValue({
        error: null,
        formula: "After morning coffee, I will run.",
        habit: makeHabit(ELIGIBLE_HABIT),
        isLoading: false,
        isUpcoming: false,
        latestReview: null,
        progress: ELIGIBLE_PROGRESS,
        recentLogs: [],
      });
      renderWithClient(<HabitDetailScreen />);
      expect(screen.queryByText("Start reflection")).toBeNull();
    });

    it("'Start reflection' navigates to /graduation/[habitId]", () => {
      useHabitDetail.mockReturnValue({
        error: null,
        formula: "After morning coffee, I will run.",
        habit: makeHabit(ELIGIBLE_HABIT),
        isLoading: false,
        isUpcoming: false,
        latestReview: null,
        progress: ELIGIBLE_PROGRESS,
        recentLogs: [],
      });
      renderWithClient(<HabitDetailScreen />);
      fireEvent.press(screen.getByText("Start reflection"));
      const { router } = jest.requireMock("expo-router") as {
        router: { push: jest.Mock };
      };
      expect(router.push).toHaveBeenCalledWith({
        pathname: "/(app)/graduation/[habitId]",
        params: { habitId: "habit-1" },
      });
    });
  });

  describe("graduated badge", () => {
    it("renders 'Automatic since {month year}' when habit_state is automatic and automated_at is set", () => {
      useHabitDetail.mockReturnValue({
        error: null,
        formula: "After morning coffee, I will run.",
        habit: makeHabit({
          automated_at: "2026-05-14T12:00:00.000Z",
          habit_state: "automatic",
        }),
        isLoading: false,
        isUpcoming: false,
        latestReview: null,
        progress: makeProgress(),
        recentLogs: [],
      });
      renderWithClient(<HabitDetailScreen />);
      expect(screen.getByText("Automatic since May 2026")).toBeTruthy();
    });

    it("hides the badge when habit_state is active", () => {
      useHabitDetail.mockReturnValue({
        error: null,
        formula: "After morning coffee, I will run.",
        habit: makeHabit({ habit_state: "active" }),
        isLoading: false,
        isUpcoming: false,
        latestReview: null,
        progress: makeProgress(),
        recentLogs: [],
      });
      renderWithClient(<HabitDetailScreen />);
      expect(screen.queryByText(/^Automatic/)).toBeNull();
    });

    it("falls back to plain 'Automatic' when habit_state is automatic but automated_at is null", () => {
      useHabitDetail.mockReturnValue({
        error: null,
        formula: "After morning coffee, I will run.",
        habit: makeHabit({
          automated_at: null,
          habit_state: "automatic",
        }),
        isLoading: false,
        isUpcoming: false,
        latestReview: null,
        progress: makeProgress(),
        recentLogs: [],
      });
      renderWithClient(<HabitDetailScreen />);
      expect(screen.getByText("Automatic")).toBeTruthy();
      // Must never render "Automatic since —" or "Automatic since "
      expect(screen.queryByText(/Automatic since/)).toBeNull();
    });
  });

  describe("DangerZone — permanent delete", () => {
    function setupAlertSpy() {
      // Alert.alert is a real Alert from react-native; spy on it.
      const { Alert } = require("react-native");
      return jest.spyOn(Alert, "alert").mockImplementation(() => undefined);
    }

    it("renders the danger zone for active habits", () => {
      useHabitDetail.mockReturnValue({
        error: null,
        formula: "After morning coffee, I will run.",
        habit: makeHabit(),
        isLoading: false,
        isUpcoming: false,
        latestReview: null,
        progress: makeProgress(),
        recentLogs: [],
      });
      renderWithClient(<HabitDetailScreen />);
      expect(screen.getByText("DELETE HABIT")).toBeTruthy();
      expect(
        screen.getByText(
          /Permanently removes this habit and all its history/i,
        ),
      ).toBeTruthy();
    });

    it("renders the danger zone for archived habits", () => {
      useHabitDetail.mockReturnValue({
        error: null,
        formula: "After morning coffee, I will run.",
        habit: makeHabit({ status: "archived", archived_at: "2026-04-29T00:00:00.000Z" }),
        isLoading: false,
        isUpcoming: false,
        latestReview: null,
        progress: makeProgress(),
        recentLogs: [],
      });
      renderWithClient(<HabitDetailScreen />);
      expect(screen.getByText("DELETE HABIT")).toBeTruthy();
    });

    it("shows confirmation alert with habit title when delete is tapped", () => {
      const alertSpy = setupAlertSpy();
      useHabitDetail.mockReturnValue({
        error: null,
        formula: "After morning coffee, I will run.",
        habit: makeHabit({ title: "Morning Run" }),
        isLoading: false,
        isUpcoming: false,
        latestReview: null,
        progress: makeProgress(),
        recentLogs: [],
      });
      renderWithClient(<HabitDetailScreen />);
      // Tap the danger button (the second occurrence — first is the eyebrow)
      const deleteButton = screen.getByRole("button", { name: "Delete habit" });
      fireEvent.press(deleteButton);
      expect(alertSpy).toHaveBeenCalledWith(
        "Delete this habit?",
        expect.stringContaining("Morning Run"),
        expect.any(Array),
      );
      alertSpy.mockRestore();
    });

    it("disables the danger button in read-only mode", () => {
      const alertSpy = setupAlertSpy();
      useTrialValidation.mockReturnValue({
        accessMode: "read_only",
        isValidating: false,
        refresh: jest.fn(),
      });
      useHabitDetail.mockReturnValue({
        error: null,
        formula: "After morning coffee, I will run.",
        habit: makeHabit(),
        isLoading: false,
        isUpcoming: false,
        latestReview: null,
        progress: makeProgress(),
        recentLogs: [],
      });
      renderWithClient(<HabitDetailScreen />);
      const deleteButton = screen.getByRole("button", { name: "Delete habit" });
      fireEvent.press(deleteButton);
      expect(alertSpy).not.toHaveBeenCalled();
      alertSpy.mockRestore();
    });

    it("swaps the label to 'Deleting…' while the mutation is pending", () => {
      useDeleteHabitMutation.mockReturnValue({
        mutateAsync: jest.fn(),
        isPending: true,
        error: null,
      });
      useHabitDetail.mockReturnValue({
        error: null,
        formula: "After morning coffee, I will run.",
        habit: makeHabit(),
        isLoading: false,
        isUpcoming: false,
        latestReview: null,
        progress: makeProgress(),
        recentLogs: [],
      });
      renderWithClient(<HabitDetailScreen />);
      expect(screen.getByText("Deleting…")).toBeTruthy();
    });
  });
});
