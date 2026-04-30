import { fireEvent, render, screen } from "@testing-library/react-native";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";

import TodayScreen from "@/features/today/screens/TodayScreen";
import { resetClockForTesting, setNowForTesting } from "@/utils/clock";

jest.mock("expo-router", () => ({
  router: { push: jest.fn(), replace: jest.fn() },
}));

jest.mock("@/features/today/hooks", () => ({
  useHabitLogsForRange: jest.fn(),
  useTodayHabits: jest.fn(),
  useUpsertTodayHabitStatusMutation: jest.fn(),
}));

const {
  useHabitLogsForRange,
  useTodayHabits,
  useUpsertTodayHabitStatusMutation,
} = jest.requireMock("@/features/today/hooks") as {
  useHabitLogsForRange: jest.Mock;
  useTodayHabits: jest.Mock;
  useUpsertTodayHabitStatusMutation: jest.Mock;
};

function renderWithClient(ui: React.ReactElement) {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return render(<QueryClientProvider client={client}>{ui}</QueryClientProvider>);
}

function makeHabit(overrides: Record<string, unknown> = {}) {
  return {
    consistencyRate: 0.9,
    cue: "morning coffee",
    formula: "After morning coffee, run for 2 minutes",
    habitState: "focus",
    id: "habit-1",
    identityPhrase: "a runner",
    isWeeklyReviewDue: false,
    latestReviewWeekStart: null,
    name: "Run",
    skipCount: 0,
    startDate: "2026-04-01",
    streak: 12,
    tinyAction: "run for 2 minutes",
    todayStatus: null,
    ...overrides,
  };
}

describe("TodayScreen", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    setNowForTesting(new Date("2026-04-30T10:00:00.000Z"));
    useUpsertTodayHabitStatusMutation.mockReturnValue({
      error: null,
      isPending: false,
      mutateAsync: jest.fn().mockResolvedValue(undefined),
    });
    useHabitLogsForRange.mockReturnValue({ data: [] });
  });

  afterEach(() => {
    resetClockForTesting();
  });

  it("renders the no-habits empty state with CTA when no Focus habit exists", () => {
    useTodayHabits.mockReturnValue({
      error: null,
      habits: [],
      isLoading: false,
      upcomingHabits: [],
    });
    renderWithClient(<TodayScreen />);
    expect(screen.getByText("No active habits yet")).toBeTruthy();
    expect(screen.getByText("Create your first habit")).toBeTruthy();
  });

  it("renders the Focus card with becoming header and identity streak", () => {
    useTodayHabits.mockReturnValue({
      error: null,
      habits: [makeHabit()],
      isLoading: false,
      upcomingHabits: [],
    });
    renderWithClient(<TodayScreen />);
    expect(screen.getByText("Become a runner")).toBeTruthy();
    expect(screen.getByText("After morning coffee, run for 2 minutes")).toBeTruthy();
    expect(screen.getByText("You've been a runner for 12 days.")).toBeTruthy();
    expect(screen.getByText("Done")).toBeTruthy();
    expect(screen.getByText("Skip")).toBeTruthy();
  });

  it("renders the first-day copy when start_date is today, todayStatus is null, and streak is 0", () => {
    useTodayHabits.mockReturnValue({
      error: null,
      habits: [makeHabit({ startDate: "2026-04-30", streak: 0, todayStatus: null })],
      isLoading: false,
      upcomingHabits: [],
    });
    renderWithClient(<TodayScreen />);
    expect(screen.getByText("Your first day. Start small.")).toBeTruthy();
    expect(screen.queryByText("Day one. Start showing up.")).toBeNull();
  });

  it("renders standard streak copy after first log on Day 1", () => {
    useTodayHabits.mockReturnValue({
      error: null,
      habits: [makeHabit({ startDate: "2026-04-30", streak: 1, todayStatus: "done" })],
      isLoading: false,
      upcomingHabits: [],
    });
    renderWithClient(<TodayScreen />);
    expect(screen.queryByText("Your first day. Start small.")).toBeNull();
    expect(screen.getByText("You've been a runner for 1 day.")).toBeTruthy();
  });

  it("calls the mutation with status='done' when Done is tapped", () => {
    const mutateAsync = jest.fn().mockResolvedValue(undefined);
    useUpsertTodayHabitStatusMutation.mockReturnValue({
      error: null,
      isPending: false,
      mutateAsync,
    });
    useTodayHabits.mockReturnValue({
      error: null,
      habits: [makeHabit()],
      isLoading: false,
      upcomingHabits: [],
    });
    renderWithClient(<TodayScreen />);
    fireEvent.press(screen.getByText("Done"));
    expect(mutateAsync).toHaveBeenCalledWith({ habitId: "habit-1", status: "done" });
  });

  it("calls the mutation with status='skipped' when Skip is tapped", () => {
    const mutateAsync = jest.fn().mockResolvedValue(undefined);
    useUpsertTodayHabitStatusMutation.mockReturnValue({
      error: null,
      isPending: false,
      mutateAsync,
    });
    useTodayHabits.mockReturnValue({
      error: null,
      habits: [makeHabit()],
      isLoading: false,
      upcomingHabits: [],
    });
    renderWithClient(<TodayScreen />);
    fireEvent.press(screen.getByText("Skip"));
    expect(mutateAsync).toHaveBeenCalledWith({ habitId: "habit-1", status: "skipped" });
  });

  it("does not render a Missed button on Today", () => {
    useTodayHabits.mockReturnValue({
      error: null,
      habits: [makeHabit()],
      isLoading: false,
      upcomingHabits: [],
    });
    renderWithClient(<TodayScreen />);
    expect(screen.queryByText("Missed")).toBeNull();
  });
});
