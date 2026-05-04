jest.mock("@/features/reviews/hooks", () => ({
  useLatestWeeklyReviewQuery: jest.fn().mockReturnValue({
    data: null,
    error: null,
    isLoading: false,
  }),
}));

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

import { fireEvent, render, screen } from "@testing-library/react-native";

import HabitDetailScreen from "@/features/habits/screens/HabitDetailScreen";
import { useTrialValidation } from "@/features/trial/hooks";

const mockPush = jest.fn();
const mockUseHabitDetail = jest.fn();
const mockUseArchiveHabitMutation = jest.fn();
const mockMutateAsync = jest.fn();
const mockUseLocalSearchParams = jest.fn();

jest.mock("expo-router", () => ({
  router: {
    push: (...args: unknown[]) => mockPush(...args),
  },
  useLocalSearchParams: () => mockUseLocalSearchParams(),
}));

jest.mock("@/features/habits/hooks", () => ({
  useHabitDetail: (habitId: string | string[] | undefined) =>
    mockUseHabitDetail(habitId),
  useArchiveHabitMutation: () => mockUseArchiveHabitMutation(),
  useUpsertHabitLogMutation: () => ({
    mutateAsync: jest.fn().mockResolvedValue(undefined),
    isPending: false,
    error: null,
  }),
}));

jest.mock("@/features/today/hooks", () => ({
  useHabitLogsForRange: jest.fn().mockReturnValue({ data: [] }),
}));

jest.mock("@/features/auth/hooks", () => ({
  useAuthSession: jest.fn(() => ({ user: { id: "user-1" } })),
}));

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

const baseHabit = {
  active_days: "[1,2,3,4,5,6,7]",
  icon: null,
  id: "habit-1",
  title: "Reading",
  identity_phrase: null,
  cue: "breakfast",
  tiny_action: "Read 1 page",
  minimum_viable_action: null,
  preferred_time_window: null,
  habit_state: "active",
  status: "active",
  start_date: "2026-04-24",
};

const emptyProgress = {
  consistencyRate: 0,
  skipCount: 0,
  streak: 0,
  todayStatus: null,
};

describe("HabitDetailScreen", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockUseLocalSearchParams.mockReturnValue({
      habitId: "habit-1",
    });
    mockUseArchiveHabitMutation.mockReturnValue({
      error: null,
      isPending: false,
      mutateAsync: mockMutateAsync,
    });
  });

  it("shows a loading state while the habit detail is resolving", () => {
    mockUseHabitDetail.mockReturnValue({
      error: null,
      formula: "",
      habit: null,
      isLoading: true,
      isUpcoming: false,
      progress: emptyProgress,
      recentLogs: [],
    });

    render(<HabitDetailScreen />);

    expect(screen.getByText("Loading habit details...")).toBeTruthy();
  });

  it("shows a friendly error and safe return path when detail cannot load", () => {
    mockUseHabitDetail.mockReturnValue({
      error: new Error("boom"),
      formula: "",
      habit: null,
      isLoading: false,
      isUpcoming: false,
      progress: emptyProgress,
      recentLogs: [],
    });

    render(<HabitDetailScreen />);

    expect(
      screen.getByText("We couldn't load this habit right now. Try again."),
    ).toBeTruthy();

    fireEvent.press(screen.getByText("Back to Today"));

    expect(mockPush).toHaveBeenCalledWith("/(app)/(tabs)/today");
  });

  it("renders habit header, calendar, streak, and setup sections", () => {
    mockUseHabitDetail.mockReturnValue({
      error: null,
      formula: "After I brush my teeth, I will Read 1 page.",
      habit: {
        ...baseHabit,
        title: "Reading",
        identity_phrase: "a reader",
        cue: "I brush my teeth",
        preferred_time_window: "Evening",
      },
      isLoading: false,
      isUpcoming: false,
      progress: {
        consistencyRate: 2 / 3,
        skipCount: 1,
        streak: 2,
        todayStatus: "done",
      },
      recentLogs: [],
    });

    render(<HabitDetailScreen />);

    expect(mockUseHabitDetail).toHaveBeenCalledWith("habit-1");
    expect(screen.getByText("Reading")).toBeTruthy();
    expect(screen.getByText("Become a reader")).toBeTruthy();
    expect(screen.getByText("Evening")).toBeTruthy();
    // Streak copy for streak=2 (index 2%5=2 → "N-day streak. One day at a time.")
    expect(screen.getByText("2-day streak. One day at a time.")).toBeTruthy();
    // Setup card shows active days label (may appear in multiple places)
    expect(screen.getAllByText("Every day").length).toBeGreaterThan(0);
    expect(screen.getAllByText("Archive habit").length).toBeGreaterThan(0);
    expect(
      screen.getByText("This removes the habit from Today, but keeps its history."),
    ).toBeTruthy();
    // Removed sections from old design
    expect(screen.queryByText("SUGGESTED ADJUSTMENT")).toBeNull();
    expect(screen.queryByText("Recent history")).toBeNull();
  });

  it("hides optional setup fields when they are absent", () => {
    mockUseHabitDetail.mockReturnValue({
      error: null,
      formula: "After I wake up, I will Meditate for 1 minute.",
      habit: {
        ...baseHabit,
        id: "habit-2",
        title: "Meditation",
        cue: "I wake up",
        tiny_action: "Meditate for 1 minute",
        identity_phrase: null,
        preferred_time_window: null,
      },
      isLoading: false,
      isUpcoming: false,
      progress: emptyProgress,
      recentLogs: [],
    });

    render(<HabitDetailScreen />);

    expect(screen.queryByText("Identity")).toBeNull();
    expect(screen.queryByText("Preferred time")).toBeNull();
  });

  it("shows upcoming habit context and hides calendar/streak for future habits", () => {
    mockUseHabitDetail.mockReturnValue({
      error: null,
      formula: "After lunch, I will Stretch for 1 minute.",
      habit: {
        ...baseHabit,
        id: "habit-3",
        title: "Stretching",
        cue: "After lunch",
        tiny_action: "Stretch for 1 minute",
        start_date: "2026-06-01",
      },
      isLoading: false,
      isUpcoming: true,
      progress: emptyProgress,
      recentLogs: [],
    });

    render(<HabitDetailScreen />);

    expect(screen.getByText("Stretching")).toBeTruthy();
    // Calendar and streak are hidden for upcoming habits
    expect(screen.queryByText("LAST 30 DAYS")).toBeNull();
    expect(screen.queryByText("CURRENT STREAK")).toBeNull();
  });

  it("shows archive button for active habits and calls archiveHabitMutation on press", () => {
    mockUseHabitDetail.mockReturnValue({
      error: null,
      formula: "After breakfast, I will Read 1 page.",
      habit: { ...baseHabit, status: "active" },
      isLoading: false,
      isUpcoming: false,
      progress: emptyProgress,
      recentLogs: [],
    });

    render(<HabitDetailScreen />);

    // The screen renders a title "Archive habit" and a button "Archive habit".
    // Press the last one (the SecondaryButton).
    const archiveButtons = screen.getAllByText("Archive habit");
    fireEvent.press(archiveButtons[archiveButtons.length - 1]!);

    expect(mockMutateAsync).toHaveBeenCalledWith({
      habitId: "habit-1",
    });
  });

  it("shows archived state for archived habits (no archive button)", () => {
    mockUseHabitDetail.mockReturnValue({
      error: null,
      formula: "After breakfast, I will Read 1 page.",
      habit: { ...baseHabit, status: "archived" },
      isLoading: false,
      isUpcoming: false,
      progress: emptyProgress,
      recentLogs: [],
    });

    render(<HabitDetailScreen />);

    expect(screen.getByText("Archived")).toBeTruthy();
    expect(
      screen.getByText("This habit is archived. Reactivation coming in a future release."),
    ).toBeTruthy();
    expect(screen.queryByText("Archive habit")).toBeNull();
  });

  it("shows a friendly archive error instead of the raw mutation message", () => {
    mockUseArchiveHabitMutation.mockReturnValue({
      error: new Error("database exploded"),
      isPending: false,
      mutateAsync: mockMutateAsync,
    });
    mockUseHabitDetail.mockReturnValue({
      error: null,
      formula: "After breakfast, I will Read 1 page.",
      habit: { ...baseHabit, status: "active" },
      isLoading: false,
      isUpcoming: false,
      progress: emptyProgress,
      recentLogs: [],
    });

    render(<HabitDetailScreen />);

    expect(
      screen.getByText("We couldn't update this habit right now. Try again."),
    ).toBeTruthy();
  });

  it("hides the weekly review card when the app is in read-only mode (I9)", () => {
    (useTrialValidation as jest.Mock).mockReturnValueOnce({
      accessMode: "read_only",
      entitlementStatus: "trial",
      isBootstrapping: false,
      isValidating: false,
      lastValidatedAt: null,
      refresh: jest.fn().mockResolvedValue(undefined),
      trialEndsAt: null,
      trialStartedAt: null,
    });
    mockUseHabitDetail.mockReturnValue({
      error: null,
      formula: "After breakfast, I will Read 1 page.",
      habit: { ...baseHabit, status: "active" },
      isLoading: false,
      isUpcoming: false,
      progress: emptyProgress,
      recentLogs: [],
    });

    render(<HabitDetailScreen />);

    expect(screen.queryByText("Start review")).toBeNull();
    expect(screen.queryByText("Reviewed this week ✓")).toBeNull();
  });
});
