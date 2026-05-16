jest.mock("@/features/trial/hooks", () => ({
  useTrialValidation: jest.fn(() => ({
    accessMode: "full",
    isBootstrapping: false,
    isValidating: false,
    refresh: jest.fn().mockResolvedValue(undefined),
  })),
}));

import {
  act,
  fireEvent,
  render,
  screen,
  waitFor,
} from "@testing-library/react-native";

import WeeklyReviewScreen from "@/features/reviews/screens/WeeklyReviewScreen";

const mockReplace = jest.fn();
const mockUseLocalSearchParams = jest.fn();
const mockUseHabitDetail = jest.fn();
const mockUseCurrentWeeklyReviewQuery = jest.fn();
const mockUseUpsertWeeklyReviewMutation = jest.fn();
const mockMutateAsync = jest.fn();

jest.mock("expo-router", () => ({
  router: {
    replace: (...args: unknown[]) => mockReplace(...args),
  },
  useLocalSearchParams: () => mockUseLocalSearchParams(),
}));

jest.mock("@/features/habits/hooks", () => ({
  useHabitDetail: (habitId: string | string[] | undefined) =>
    mockUseHabitDetail(habitId),
}));

jest.mock("@/features/reviews/hooks", () => ({
  useCurrentWeeklyReviewQuery: (habitId: string | string[] | undefined) =>
    mockUseCurrentWeeklyReviewQuery(habitId),
  useUpsertWeeklyReviewMutation: () => mockUseUpsertWeeklyReviewMutation(),
}));

jest.mock("@/utils/dates", () => ({
  getWeekStartDateString: () => "2026-04-20",
}));

const savedReview = {
  adjustment_note: "Move the book",
  created_at: "2026-04-24T00:00:00.000Z",
  habit_id: "habit-1",
  id: "review-1",
  tiny_action_too_hard: false,
  trigger_worked: true,
  updated_at: "2026-04-24T00:00:00.000Z",
  user_id: "user-1",
  was_hard: null,
  week_start: "2026-04-20",
  went_well: "Breakfast cue worked",
};

describe("WeeklyReviewScreen", () => {
  afterEach(() => {
    jest.useRealTimers();
  });

  beforeEach(() => {
    jest.clearAllMocks();
    mockUseLocalSearchParams.mockReturnValue({
      habitId: "habit-1",
    });
    mockUseHabitDetail.mockReturnValue({
      error: null,
      formula: "After breakfast, I will Read 1 page.",
      habit: {
        id: "habit-1",
        title: "Reading",
      },
      isLoading: false,
      isUpcoming: false,
      latestReview: null,
      progress: {
        consistencyRate: 1,
        skipCount: 0,
        streak: 3,
        todayStatus: "done",
      },
      recentLogs: [],
    });
    mockUseCurrentWeeklyReviewQuery.mockReturnValue({
      data: null,
      error: null,
      isLoading: false,
    });
    mockUseUpsertWeeklyReviewMutation.mockReturnValue({
      error: null,
      isPending: false,
      mutateAsync: mockMutateAsync,
    });
    mockMutateAsync.mockResolvedValue(savedReview);
  });

  it("shows a loading state while habit or review data is resolving", () => {
    mockUseHabitDetail.mockReturnValue({
      error: null,
      habit: null,
      isLoading: true,
      progress: {
        consistencyRate: 0,
        skipCount: 0,
        streak: 0,
        todayStatus: null,
      },
    });

    render(<WeeklyReviewScreen />);

    expect(screen.getByText("Loading weekly review...")).toBeTruthy();
  });

  it("shows a friendly error when the habit or review cannot load", () => {
    mockUseCurrentWeeklyReviewQuery.mockReturnValue({
      data: null,
      error: new Error("boom"),
      isLoading: false,
    });

    render(<WeeklyReviewScreen />);

    expect(
      screen.getByText(
        "We couldn't load this weekly review right now. Try again.",
      ),
    ).toBeTruthy();
  });

  it("renders the habit name and empty form for a new current-week review", () => {
    render(<WeeklyReviewScreen />);

    expect(mockUseHabitDetail).toHaveBeenCalledWith("habit-1");
    expect(mockUseCurrentWeeklyReviewQuery).toHaveBeenCalledWith("habit-1");
    expect(screen.getByText("Reading")).toBeTruthy();
    expect(screen.getByText("Week of 2026-04-20")).toBeTruthy();
    expect(screen.getByText("What went well this week?")).toBeTruthy();
    expect(screen.getByText("What was hard this week?")).toBeTruthy();
    expect(screen.getByText("Did your trigger work?")).toBeTruthy();
    expect(screen.getByText("Was the tiny action too hard?")).toBeTruthy();
    expect(
      screen.getByText(
        "These answers help the app suggest what to adjust next week.",
      ),
    ).toBeTruthy();
    expect(screen.queryByText("Unanswered")).toBeNull();
    expect(
      screen.getByText("What small adjustment do you want to try next week?"),
    ).toBeTruthy();
  });

  it("prefills an existing current-week review", () => {
    mockUseCurrentWeeklyReviewQuery.mockReturnValue({
      data: {
        adjustment_note: "Move the book to the table",
        habit_id: "habit-1",
        id: "review-1",
        tiny_action_too_hard: false,
        trigger_worked: true,
        user_id: "user-1",
        was_hard: "Rushed mornings",
        week_start: "2026-04-20",
        went_well: "Breakfast cue worked",
      },
      error: null,
      isLoading: false,
    });

    render(<WeeklyReviewScreen />);

    expect(screen.getByDisplayValue("Breakfast cue worked")).toBeTruthy();
    expect(screen.getByDisplayValue("Rushed mornings")).toBeTruthy();
    expect(screen.getByDisplayValue("Move the book to the table")).toBeTruthy();
  });

  it("blocks a completely blank review", async () => {
    render(<WeeklyReviewScreen />);

    fireEvent.press(screen.getByText("Save weekly review"));

    await waitFor(() => {
      expect(
        screen.getByText("Answer both yes/no questions before saving."),
      ).toBeTruthy();
    });
    expect(mockMutateAsync).not.toHaveBeenCalled();
  });

  it("requires both yes/no questions before saving", async () => {
    render(<WeeklyReviewScreen />);

    fireEvent.press(screen.getByLabelText("Did your trigger work?: No"));
    fireEvent.press(screen.getByText("Save weekly review"));

    await waitFor(() => {
      expect(
        screen.getByText("Answer both yes/no questions before saving."),
      ).toBeTruthy();
    });
    expect(mockMutateAsync).not.toHaveBeenCalled();
  });

  it("saves a review when both yes/no questions are answered", async () => {
    render(<WeeklyReviewScreen />);

    fireEvent.press(screen.getByLabelText("Did your trigger work?: No"));
    fireEvent.press(screen.getByLabelText("Was the tiny action too hard?: No"));
    fireEvent.press(screen.getByText("Save weekly review"));

    await waitFor(() => {
      expect(mockMutateAsync).toHaveBeenCalledWith({
        adjustmentNote: "",
        habitId: "habit-1",
        tinyActionTooHard: false,
        triggerWorked: false,
        wasHard: "",
        weekStart: "2026-04-20",
        wentWell: "",
      });
    });
  });

  it("does not fire a second mutation when save is double-pressed", async () => {
    let resolveMutation: (value: typeof savedReview) => void = () => {};
    mockMutateAsync.mockImplementationOnce(
      () =>
        new Promise((resolve) => {
          resolveMutation = resolve;
        }),
    );

    render(<WeeklyReviewScreen />);

    fireEvent.press(screen.getByLabelText("Did your trigger work?: No"));
    fireEvent.press(screen.getByLabelText("Was the tiny action too hard?: No"));

    const saveButton = screen.getByText("Save weekly review");
    fireEvent.press(saveButton);
    fireEvent.press(saveButton);

    expect(mockMutateAsync).toHaveBeenCalledTimes(1);

    await act(async () => {
      resolveMutation(savedReview);
    });
  });

  it("saves trimmed values and returns to Habit Detail when Done is pressed", async () => {
    render(<WeeklyReviewScreen />);

    fireEvent.changeText(
      screen.getByPlaceholderText("The moment that felt easiest"),
      " Breakfast cue worked ",
    );
    fireEvent.changeText(
      screen.getByPlaceholderText("The part that got in the way"),
      " Rushed mornings ",
    );
    fireEvent.changeText(
      screen.getByPlaceholderText("One small change for next week"),
      " Move the book ",
    );
    fireEvent.press(screen.getByLabelText("Did your trigger work?: Yes"));
    fireEvent.press(screen.getByLabelText("Was the tiny action too hard?: No"));
    fireEvent.press(screen.getByText("Save weekly review"));

    await waitFor(() => {
      expect(mockMutateAsync).toHaveBeenCalledWith({
        adjustmentNote: "Move the book",
        habitId: "habit-1",
        tinyActionTooHard: false,
        triggerWorked: true,
        wasHard: "Rushed mornings",
        weekStart: "2026-04-20",
        wentWell: "Breakfast cue worked",
      });
    });
    await waitFor(() => {
      expect(screen.getByText("Review saved")).toBeTruthy();
    });
    expect(
      screen.getByText(
        "Your habit reflection has been updated for this week.",
      ),
    ).toBeTruthy();
    expect(screen.getByText("SUGGESTED ADJUSTMENT")).toBeTruthy();
    expect(screen.getByText("Keep it stable")).toBeTruthy();
    expect(screen.getByText("Why this suggestion")).toBeTruthy();
    expect(
      screen.getByText("Your review does not point to a major change yet."),
    ).toBeTruthy();
    expect(screen.queryByText("Save weekly review")).toBeNull();
    expect(mockReplace).not.toHaveBeenCalled();

    fireEvent.press(screen.getByText("Done"));

    expect(mockReplace).toHaveBeenCalledWith("/(app)/habits/habit-1");
  });

  it("returns to Today when Done is pressed and returnTo is today", async () => {
    mockUseLocalSearchParams.mockReturnValue({
      habitId: "habit-1",
      returnTo: "today",
    });

    render(<WeeklyReviewScreen />);

    fireEvent.changeText(
      screen.getByPlaceholderText("The moment that felt easiest"),
      "I showed up",
    );
    fireEvent.press(screen.getByLabelText("Did your trigger work?: Yes"));
    fireEvent.press(screen.getByLabelText("Was the tiny action too hard?: No"));
    fireEvent.press(screen.getByText("Save weekly review"));

    await waitFor(() => {
      expect(screen.getByText("Review saved")).toBeTruthy();
    });
    expect(mockReplace).not.toHaveBeenCalled();

    fireEvent.press(screen.getByText("Done"));

    expect(mockReplace).toHaveBeenCalledWith("/(app)/(tabs)/today");
  });

  it("shows a tiny-action suggestion after saving a review that says the action was too hard", async () => {
    mockMutateAsync.mockResolvedValueOnce({
      ...savedReview,
      tiny_action_too_hard: true,
    });

    render(<WeeklyReviewScreen />);

    fireEvent.press(screen.getByLabelText("Did your trigger work?: Yes"));
    fireEvent.press(screen.getByLabelText("Was the tiny action too hard?: Yes"));
    fireEvent.press(screen.getByText("Save weekly review"));

    await waitFor(() => {
      expect(screen.getByText("SUGGESTED ADJUSTMENT")).toBeTruthy();
    });
    expect(screen.getByText("Make it smaller next week")).toBeTruthy();
    expect(screen.getByText("Why this suggestion")).toBeTruthy();
    expect(
      screen.getByText("You answered that the tiny action was too hard."),
    ).toBeTruthy();
  });

  it("shows a trigger suggestion after saving a review that says the trigger did not work", async () => {
    mockMutateAsync.mockResolvedValueOnce({
      ...savedReview,
      trigger_worked: false,
    });

    render(<WeeklyReviewScreen />);

    fireEvent.press(screen.getByLabelText("Did your trigger work?: No"));
    fireEvent.press(screen.getByLabelText("Was the tiny action too hard?: No"));
    fireEvent.press(screen.getByText("Save weekly review"));

    await waitFor(() => {
      expect(screen.getByText("SUGGESTED ADJUSTMENT")).toBeTruthy();
    });
    expect(screen.getByText("Adjust your trigger")).toBeTruthy();
    expect(screen.getByText("Why this suggestion")).toBeTruthy();
    expect(
      screen.getByText("You answered that the trigger did not work."),
    ).toBeTruthy();
  });

  it("falls back to Habit Detail for unrecognized returnTo values", async () => {
    mockUseLocalSearchParams.mockReturnValue({
      habitId: "habit-1",
      returnTo: "settings",
    });

    render(<WeeklyReviewScreen />);

    fireEvent.changeText(
      screen.getByPlaceholderText("The moment that felt easiest"),
      "I showed up",
    );
    fireEvent.press(screen.getByLabelText("Did your trigger work?: Yes"));
    fireEvent.press(screen.getByLabelText("Was the tiny action too hard?: No"));
    fireEvent.press(screen.getByText("Save weekly review"));

    await waitFor(() => {
      expect(screen.getByText("Review saved")).toBeTruthy();
    });
    expect(mockReplace).not.toHaveBeenCalled();

    fireEvent.press(screen.getByText("Done"));

    expect(mockReplace).toHaveBeenCalledWith("/(app)/habits/habit-1");
  });

  it("updates a prefilled current-week review through the same save payload", async () => {
    mockUseCurrentWeeklyReviewQuery.mockReturnValue({
      data: {
        adjustment_note: "Move the book to the table",
        habit_id: "habit-1",
        id: "review-1",
        tiny_action_too_hard: false,
        trigger_worked: true,
        user_id: "user-1",
        was_hard: "Rushed mornings",
        week_start: "2026-04-20",
        went_well: "Breakfast cue worked",
      },
      error: null,
      isLoading: false,
    });

    render(<WeeklyReviewScreen />);

    fireEvent.changeText(
      screen.getByPlaceholderText("One small change for next week"),
      "Keep the book by breakfast",
    );
    fireEvent.press(screen.getByText("Save weekly review"));

    await waitFor(() => {
      expect(mockMutateAsync).toHaveBeenCalledWith({
        adjustmentNote: "Keep the book by breakfast",
        habitId: "habit-1",
        tinyActionTooHard: false,
        triggerWorked: true,
        wasHard: "Rushed mornings",
        weekStart: "2026-04-20",
        wentWell: "Breakfast cue worked",
      });
    });
  });

  it("preserves input when save fails", async () => {
    mockMutateAsync.mockRejectedValueOnce(new Error("save failed"));

    render(<WeeklyReviewScreen />);

    fireEvent.changeText(
      screen.getByPlaceholderText("The moment that felt easiest"),
      "I showed up",
    );
    fireEvent.press(screen.getByLabelText("Did your trigger work?: Yes"));
    fireEvent.press(screen.getByLabelText("Was the tiny action too hard?: No"));
    fireEvent.press(screen.getByText("Save weekly review"));

    await waitFor(() => {
      expect(
        screen.getByText(
          "We couldn't save your weekly review right now. Try again.",
        ),
      ).toBeTruthy();
    });

    expect(screen.getByDisplayValue("I showed up")).toBeTruthy();
    expect(screen.queryByText("SUGGESTED ADJUSTMENT")).toBeNull();
    expect(mockReplace).not.toHaveBeenCalled();
  });
});
