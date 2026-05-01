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
  useHabitDetail: jest.fn(),
  useUpsertHabitLogMutation: jest.fn(),
}));

jest.mock("@/features/today/hooks", () => ({
  useHabitLogsForRange: jest.fn(),
}));

const {
  useHabitDetail,
  useArchiveHabitMutation,
  useUpsertHabitLogMutation,
} = jest.requireMock("@/features/habits/hooks") as {
  useHabitDetail: jest.Mock;
  useArchiveHabitMutation: jest.Mock;
  useUpsertHabitLogMutation: jest.Mock;
};

const { useHabitLogsForRange } = jest.requireMock(
  "@/features/today/hooks",
) as { useHabitLogsForRange: jest.Mock };

function renderWithClient(ui: React.ReactElement) {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return render(<QueryClientProvider client={client}>{ui}</QueryClientProvider>);
}

function makeHabit(overrides: Partial<Record<string, unknown>> = {}) {
  return {
    archived_at: null,
    created_at: "2026-04-01T00:00:00.000Z",
    cue: "morning coffee",
    habit_state: "focus",
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
    useUpsertHabitLogMutation.mockReturnValue({
      mutateAsync: jest.fn().mockResolvedValue(undefined),
      isPending: false,
      error: null,
    });
    useHabitLogsForRange.mockReturnValue({ data: [] });
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
    expect(screen.getByText("Become a runner")).toBeTruthy();
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

  it("renders identity-flavored streak copy with the extracted noun", () => {
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
    expect(screen.getByText("You've been a runner for 12 days.")).toBeTruthy();
  });

  it("renders consistency with the §10.2 'over the last 30 days' suffix", () => {
    useHabitDetail.mockReturnValue({
      error: null,
      formula: "After morning coffee, run for 2 minutes",
      habit: makeHabit(),
      isLoading: false,
      isUpcoming: false,
      latestReview: null,
      progress: makeProgress({ consistencyRate: 0.85 }),
      recentLogs: [],
    });
    renderWithClient(<HabitDetailScreen />);
    expect(screen.getByText("85% over the last 30 days")).toBeTruthy();
  });

  it("renders the 90-day heatmap when logs are loaded", () => {
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

  it("does not render the heatmap when habit is upcoming", () => {
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
    expect(screen.getByText(/Starts on /)).toBeTruthy();
    expect(screen.queryByLabelText("Today, not logged")).toBeNull();
  });

  it("opens the selector with canEdit=true when an in-window cell is tapped", async () => {
    // Today is April 30 10:00. April 29 is ~34h ago — within the 48h window.
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

    fireEvent.press(screen.getByLabelText("2026-04-29, not logged"));

    await waitFor(() => {
      expect(screen.getByText("Done")).toBeTruthy();
      expect(screen.getByText("Skip")).toBeTruthy();
    });
  });

  it("opens the selector with canEdit=false when an out-of-window cell is tapped", async () => {
    // April 25 is 5 days ago — outside the 48h window.
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

    fireEvent.press(screen.getByLabelText("2026-04-25, not logged"));

    await waitFor(() => {
      expect(
        screen.getByText("This day is locked. Logs older than 48 hours can't be changed."),
      ).toBeTruthy();
    });
    expect(screen.queryByText("Done")).toBeNull();
    expect(screen.queryByText("Skip")).toBeNull();
  });

  it("does not open the selector when a cell before habit.start_date is tapped", async () => {
    // start_date = April 27 (3 days ago). Tap April 25 (before start_date).
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

    fireEvent.press(screen.getByLabelText("2026-04-25, not logged"));

    // Selector should not appear.
    expect(screen.queryByText("Done")).toBeNull();
    expect(screen.queryByText("Skip")).toBeNull();
    expect(
      screen.queryByText("This day is locked. Logs older than 48 hours can't be changed."),
    ).toBeNull();
  });
});
