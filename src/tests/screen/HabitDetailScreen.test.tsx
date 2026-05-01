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

const baseHabit = {
  id: "habit-1",
  title: "Reading",
  identity_phrase: null,
  cue: "breakfast",
  tiny_action: "Read 1 page",
  minimum_viable_action: null,
  preferred_time_window: null,
  habit_state: "focus",
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

  it("renders habit setup, progress, and recent history", () => {
    mockUseHabitDetail.mockReturnValue({
      error: null,
      formula: "After I brush my teeth, I will Read 1 page.",
      habit: {
        ...baseHabit,
        title: "Reading",
        identity_phrase: "Become a reader",
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
      recentLogs: [
        {
          created_at: "2026-04-24T00:00:00.000Z",
          habit_id: "habit-1",
          id: "log-1",
          log_date: "2026-04-24",
          note: "Felt easy today",
          status: "done",
          updated_at: "2026-04-24T00:00:00.000Z",
          user_id: "user-1",
        },
        {
          created_at: "2026-04-23T00:00:00.000Z",
          habit_id: "habit-1",
          id: "log-2",
          log_date: "2026-04-23",
          note: null,
          status: "skipped",
          updated_at: "2026-04-23T00:00:00.000Z",
          user_id: "user-1",
        },
      ],
    });

    render(<HabitDetailScreen />);

    expect(mockUseHabitDetail).toHaveBeenCalledWith("habit-1");
    expect(screen.getByText("Reading")).toBeTruthy();
    expect(screen.getByText("Become a reader")).toBeTruthy();
    expect(
      screen.getAllByText("After I brush my teeth, I will Read 1 page.").length,
    ).toBeGreaterThan(0);
    expect(screen.getByText("Evening")).toBeTruthy();
    expect(screen.getByText("Today: Done")).toBeTruthy();
    expect(screen.getByText("1")).toBeTruthy();
    expect(screen.getByText("67% over the last 30 days")).toBeTruthy();
    expect(screen.getByText("You've shown up 2 days for this habit.")).toBeTruthy();
    expect(screen.getByText("Felt easy today")).toBeTruthy();
    expect(screen.getAllByText("Archive habit").length).toBeGreaterThan(0);
    expect(
      screen.getByText("This removes the habit from Today, but keeps its history."),
    ).toBeTruthy();
    expect(screen.getByText("Weekly review")).toBeTruthy();
    expect(
      screen.getByText("Reflect on what worked and what to adjust for this habit."),
    ).toBeTruthy();
    expect(screen.getByText("Start weekly review")).toBeTruthy();
    expect(screen.queryByText("Suggested adjustment")).toBeNull();
    expect(screen.queryByText("Delete habit")).toBeNull();
    expect(screen.queryByText("Pause habit")).toBeNull();

    fireEvent.press(screen.getByText("Edit habit"));

    expect(mockPush).toHaveBeenCalledWith("/(app)/habits/habit-1/edit");
  });

  it("shows the latest weekly review and routes to the review screen", () => {
    mockUseHabitDetail.mockReturnValue({
      error: null,
      formula: "After breakfast, I will Read 1 page.",
      habit: baseHabit,
      isLoading: false,
      isUpcoming: false,
      latestReview: {
        adjustment_note: "Move the book to the table",
        created_at: "2026-04-24T00:00:00.000Z",
        habit_id: "habit-1",
        id: "review-1",
        tiny_action_too_hard: false,
        trigger_worked: true,
        updated_at: "2026-04-24T00:00:00.000Z",
        user_id: "user-1",
        was_hard: "Rushed mornings",
        week_start: "2026-04-20",
        went_well: "Breakfast cue worked",
      },
      progress: emptyProgress,
      recentLogs: [],
    });

    render(<HabitDetailScreen />);

    expect(screen.getByText("Latest weekly review")).toBeTruthy();
    expect(screen.getByText("Breakfast cue worked")).toBeTruthy();
    expect(screen.getByText("Rushed mornings")).toBeTruthy();
    expect(screen.getByText("Move the book to the table")).toBeTruthy();
    expect(screen.getByText("Yes")).toBeTruthy();
    expect(screen.getByText("No")).toBeTruthy();
    expect(screen.getByText("Suggested adjustment")).toBeTruthy();
    expect(screen.getByText("Reduce the friction")).toBeTruthy();
    expect(screen.getByText("Why this suggestion")).toBeTruthy();
    expect(
      screen.getByText(
        "An easier setup may help with your recent consistency or skip pattern.",
      ),
    ).toBeTruthy();
    expect(screen.getByText("Review suggestion")).toBeTruthy();

    fireEvent.press(screen.getByText("Update weekly review"));

    expect(mockPush).toHaveBeenCalledWith("/(app)/reviews/habit-1");
  });

  it("shows the tiny-action suggestion when the latest review says it was too hard", () => {
    mockUseHabitDetail.mockReturnValue({
      error: null,
      formula: "After breakfast, I will Read 1 page.",
      habit: baseHabit,
      isLoading: false,
      isUpcoming: false,
      latestReview: {
        adjustment_note: null,
        created_at: "2026-04-24T00:00:00.000Z",
        habit_id: "habit-1",
        id: "review-1",
        tiny_action_too_hard: true,
        trigger_worked: true,
        updated_at: "2026-04-24T00:00:00.000Z",
        user_id: "user-1",
        was_hard: null,
        week_start: "2026-04-20",
        went_well: "Breakfast cue worked",
      },
      progress: { consistencyRate: 1, skipCount: 0, streak: 2, todayStatus: "done" },
      recentLogs: [],
    });

    render(<HabitDetailScreen />);

    expect(screen.getByText("Suggested adjustment")).toBeTruthy();
    expect(screen.getByText("Make it smaller next week")).toBeTruthy();
    expect(screen.getByText("Why this suggestion")).toBeTruthy();
    expect(
      screen.getByText("You answered that the tiny action was too hard."),
    ).toBeTruthy();
    expect(screen.getByText("Review suggestion")).toBeTruthy();
  });

  it("routes from Review suggestion to edit with the suggestion type", () => {
    mockUseHabitDetail.mockReturnValue({
      error: null,
      formula: "After breakfast, I will Read 1 page.",
      habit: baseHabit,
      isLoading: false,
      isUpcoming: false,
      latestReview: {
        adjustment_note: null,
        created_at: "2026-04-24T00:00:00.000Z",
        habit_id: "habit-1",
        id: "review-1",
        tiny_action_too_hard: true,
        trigger_worked: true,
        updated_at: "2026-04-24T00:00:00.000Z",
        user_id: "user-1",
        was_hard: null,
        week_start: "2026-04-20",
        went_well: "Breakfast cue worked",
      },
      progress: { consistencyRate: 1, skipCount: 0, streak: 2, todayStatus: "done" },
      recentLogs: [],
    });

    render(<HabitDetailScreen />);

    fireEvent.press(screen.getByText("Review suggestion"));

    expect(mockPush).toHaveBeenCalledWith({
      pathname: "/(app)/habits/[habitId]/edit",
      params: {
        habitId: "habit-1",
        suggestionType: "make_tiny_action_smaller",
      },
    });
  });

  it("shows the trigger suggestion when the latest review says the trigger did not work", () => {
    mockUseHabitDetail.mockReturnValue({
      error: null,
      formula: "After breakfast, I will Read 1 page.",
      habit: baseHabit,
      isLoading: false,
      isUpcoming: false,
      latestReview: {
        adjustment_note: null,
        created_at: "2026-04-24T00:00:00.000Z",
        habit_id: "habit-1",
        id: "review-1",
        tiny_action_too_hard: false,
        trigger_worked: false,
        updated_at: "2026-04-24T00:00:00.000Z",
        user_id: "user-1",
        was_hard: null,
        week_start: "2026-04-20",
        went_well: "Breakfast cue worked",
      },
      progress: { consistencyRate: 1, skipCount: 0, streak: 2, todayStatus: "done" },
      recentLogs: [],
    });

    render(<HabitDetailScreen />);

    expect(screen.getByText("Suggested adjustment")).toBeTruthy();
    expect(screen.getByText("Adjust your trigger")).toBeTruthy();
    expect(screen.getByText("Why this suggestion")).toBeTruthy();
    expect(
      screen.getByText("You answered that the trigger did not work."),
    ).toBeTruthy();
  });

  it("shows a combined suggestion when trigger and tiny action both need work", () => {
    mockUseHabitDetail.mockReturnValue({
      error: null,
      formula: "After breakfast, I will Read 1 page.",
      habit: baseHabit,
      isLoading: false,
      isUpcoming: false,
      latestReview: {
        adjustment_note: null,
        created_at: "2026-04-24T00:00:00.000Z",
        habit_id: "habit-1",
        id: "review-1",
        tiny_action_too_hard: true,
        trigger_worked: false,
        updated_at: "2026-04-24T00:00:00.000Z",
        user_id: "user-1",
        was_hard: null,
        week_start: "2026-04-20",
        went_well: "Breakfast cue worked",
      },
      progress: { consistencyRate: 1, skipCount: 0, streak: 2, todayStatus: "done" },
      recentLogs: [],
    });

    render(<HabitDetailScreen />);

    expect(screen.getByText("Suggested adjustment")).toBeTruthy();
    expect(screen.getByText("Adjust trigger and action")).toBeTruthy();
    expect(
      screen.getByText(
        "You answered that the trigger did not work and the tiny action was too hard.",
      ),
    ).toBeTruthy();

    fireEvent.press(screen.getByText("Review suggestion"));

    expect(mockPush).toHaveBeenCalledWith({
      pathname: "/(app)/habits/[habitId]/edit",
      params: {
        habitId: "habit-1",
        suggestionType: "fix_trigger_and_tiny_action",
      },
    });
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

  it("shows active future-start context and empty history for upcoming habits", () => {
    mockUseHabitDetail.mockReturnValue({
      error: null,
      formula: "After lunch, I will Stretch for 1 minute.",
      habit: {
        ...baseHabit,
        id: "habit-3",
        title: "Stretching",
        cue: "After lunch",
        tiny_action: "Stretch for 1 minute",
        start_date: "2026-04-26",
      },
      isLoading: false,
      isUpcoming: true,
      progress: emptyProgress,
      recentLogs: [],
    });

    render(<HabitDetailScreen />);

    expect(screen.getByText(/Starts on/i)).toBeTruthy();
    expect(
      screen.getByText(
        "This habit is scheduled and will become loggable on its start date.",
      ),
    ).toBeTruthy();
    expect(screen.getByText("No recent history yet")).toBeTruthy();
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
});
