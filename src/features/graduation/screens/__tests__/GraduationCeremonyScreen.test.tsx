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

import GraduationCeremonyScreen from "@/features/graduation/screens/GraduationCeremonyScreen";
import { resetClockForTesting, setNowForTesting } from "@/utils/clock";

const mockBack = jest.fn();
const mockReplace = jest.fn();
const mockCanGoBack = jest.fn(() => true);

jest.mock("expo-router", () => ({
  router: {
    back: () => mockBack(),
    canGoBack: () => mockCanGoBack(),
    push: jest.fn(),
    replace: (...args: unknown[]) => mockReplace(...args),
  },
  useLocalSearchParams: () => ({ habitId: "habit-1" }),
}));

jest.mock("@/features/habits/hooks", () => ({
  useHabitDetail: jest.fn(),
}));

jest.mock("@/features/graduation/hooks", () => ({
  useRecordGraduationMutation: jest.fn(),
}));

const { useHabitDetail } = jest.requireMock("@/features/habits/hooks") as {
  useHabitDetail: jest.Mock;
};

const { useRecordGraduationMutation } = jest.requireMock(
  "@/features/graduation/hooks",
) as { useRecordGraduationMutation: jest.Mock };

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
    automated_at: null,
    created_at: "2026-01-01T00:00:00.000Z",
    cue: "morning coffee",
    habit_state: "active",
    icon: null,
    id: "habit-1",
    identity_phrase: "a runner",
    minimum_viable_action: null,
    preferred_time_window: null,
    start_date: "2026-01-01",
    status: "active",
    tiny_action: "run for 2 minutes",
    title: "Run",
    updated_at: "2026-01-01T00:00:00.000Z",
    user_id: "user-1",
    ...overrides,
  };
}

function detailReturn(overrides: Partial<Record<string, unknown>> = {}) {
  return {
    error: null,
    formula: "After morning coffee, run for 2 minutes",
    habit: makeHabit(),
    isLoading: false,
    isUpcoming: false,
    latestReview: null,
    progress: {
      consistencyDenominator: 30,
      consistencyRate: 0.85,
      skipCount: 0,
      streak: 30,
    },
    recentLogs: [],
    ...overrides,
  };
}

describe("GraduationCeremonyScreen", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    setNowForTesting(new Date("2026-05-15T10:00:00.000Z"));
    useRecordGraduationMutation.mockReturnValue({
      isPending: false,
      mutateAsync: jest.fn().mockResolvedValue({
        habit: makeHabit({ habit_state: "automatic" }),
        response: { average_score: 4.67, graduated: true },
      }),
    });
  });

  afterEach(() => {
    resetClockForTesting();
  });

  it("renders the three SRHI questions", () => {
    useHabitDetail.mockReturnValue(detailReturn());
    renderWithClient(<GraduationCeremonyScreen />);
    expect(screen.getByText("I do this without having to consciously remember.")).toBeTruthy();
    expect(screen.getByText("It would feel strange not to do this.")).toBeTruthy();
    expect(screen.getByText("I do this automatically.")).toBeTruthy();
  });

  it("submit button is disabled until all three questions are answered (does not call mutation when pressed)", () => {
    useHabitDetail.mockReturnValue(detailReturn());
    const mutateAsync = jest.fn().mockResolvedValue({
      habit: makeHabit({ habit_state: "automatic" }),
      response: { graduated: true },
    });
    useRecordGraduationMutation.mockReturnValue({ isPending: false, mutateAsync });
    renderWithClient(<GraduationCeremonyScreen />);
    fireEvent.press(screen.getByText("See result"));
    expect(mutateAsync).not.toHaveBeenCalled();
  });

  it("submit button enables after all three scores are selected", async () => {
    useHabitDetail.mockReturnValue(detailReturn());
    const mutateAsync = jest.fn().mockResolvedValue({
      habit: makeHabit({ habit_state: "automatic" }),
      response: { graduated: true },
    });
    useRecordGraduationMutation.mockReturnValue({ isPending: false, mutateAsync });
    renderWithClient(<GraduationCeremonyScreen />);

    fireEvent.press(screen.getByLabelText("Question 1 score 5"));
    fireEvent.press(screen.getByLabelText("Question 2 score 4"));
    fireEvent.press(screen.getByLabelText("Question 3 score 4"));
    fireEvent.press(screen.getByText("See result"));

    await waitFor(() => {
      expect(mutateAsync).toHaveBeenCalledWith({
        habit_id: "habit-1",
        q1_score: 5,
        q2_score: 4,
        q3_score: 4,
      });
    });
  });

  it("renders the passing outcome message after submit when scores average >= 4.0", async () => {
    useRecordGraduationMutation.mockReturnValue({
      isPending: false,
      mutateAsync: jest.fn().mockResolvedValue({
        habit: makeHabit({ habit_state: "automatic" }),
        response: { average_score: 4.67, graduated: true },
      }),
    });
    useHabitDetail.mockReturnValue(detailReturn());
    renderWithClient(<GraduationCeremonyScreen />);

    fireEvent.press(screen.getByLabelText("Question 1 score 5"));
    fireEvent.press(screen.getByLabelText("Question 2 score 5"));
    fireEvent.press(screen.getByLabelText("Question 3 score 4"));
    fireEvent.press(screen.getByText("See result"));

    await waitFor(() => {
      expect(screen.queryByText("See result")).toBeNull();
      // Outcome shows score line sourced from response.average_score
      expect(screen.getByText(/Score: 4\.7 \/ 5/)).toBeTruthy();
      expect(screen.getByText("Back to habit")).toBeTruthy();
    });
  });

  it("keeps showing the outcome card even when the habit detail refetches as automatic (regression: blocked-state guard ordering)", async () => {
    // Real-world race: mutation succeeds → invalidates habit detail → refetch
    // returns habit_state="automatic" → next render must STILL show the user's
    // outcome card, not bounce them to the "already marked Automatic" blocked
    // screen.
    let mutationResolved = false;
    useHabitDetail.mockImplementation(() =>
      mutationResolved
        ? detailReturn({
            habit: makeHabit({
              automated_at: "2026-05-15T10:00:00.000Z",
              habit_state: "automatic",
            }),
          })
        : detailReturn(),
    );
    useRecordGraduationMutation.mockReturnValue({
      isPending: false,
      mutateAsync: jest.fn().mockImplementation(async () => {
        mutationResolved = true;
        return {
          habit: makeHabit({ habit_state: "automatic" }),
          response: { average_score: 5.0, graduated: true },
        };
      }),
    });

    renderWithClient(<GraduationCeremonyScreen />);

    fireEvent.press(screen.getByLabelText("Question 1 score 5"));
    fireEvent.press(screen.getByLabelText("Question 2 score 5"));
    fireEvent.press(screen.getByLabelText("Question 3 score 5"));
    fireEvent.press(screen.getByText("See result"));

    await waitFor(() => {
      expect(screen.getByText(/Score: 5\.0 \/ 5/)).toBeTruthy();
      expect(screen.getByText("Back to habit")).toBeTruthy();
    });
    // Crucially, the blocked-state copy must not appear even though the habit
    // is now automatic on subsequent renders.
    expect(screen.queryByText("This habit is already marked Automatic.")).toBeNull();
  });

  it("renders the failing outcome message after submit when scores average < 4.0", async () => {
    useRecordGraduationMutation.mockReturnValue({
      isPending: false,
      mutateAsync: jest.fn().mockResolvedValue({
        habit: makeHabit({ habit_state: "active" }),
        response: { average_score: 2.33, graduated: false },
      }),
    });
    useHabitDetail.mockReturnValue(detailReturn());
    renderWithClient(<GraduationCeremonyScreen />);

    fireEvent.press(screen.getByLabelText("Question 1 score 2"));
    fireEvent.press(screen.getByLabelText("Question 2 score 3"));
    fireEvent.press(screen.getByLabelText("Question 3 score 2"));
    fireEvent.press(screen.getByText("See result"));

    await waitFor(() => {
      expect(screen.getByText(/Score: 2\.3 \/ 5/)).toBeTruthy();
      expect(screen.getByText("Back to habit")).toBeTruthy();
    });
  });

  it("back button navigates back when history exists", () => {
    mockCanGoBack.mockReturnValueOnce(true);
    useHabitDetail.mockReturnValue(detailReturn());
    renderWithClient(<GraduationCeremonyScreen />);
    fireEvent.press(screen.getByLabelText("Back"));
    expect(mockBack).toHaveBeenCalled();
    expect(mockReplace).not.toHaveBeenCalled();
  });

  it("back button falls back to /(app)/(tabs)/today when there is no history (deep-linked entry)", () => {
    mockCanGoBack.mockReturnValueOnce(false);
    useHabitDetail.mockReturnValue(detailReturn());
    renderWithClient(<GraduationCeremonyScreen />);
    fireEvent.press(screen.getByLabelText("Back"));
    expect(mockBack).not.toHaveBeenCalled();
    expect(mockReplace).toHaveBeenCalledWith("/(app)/(tabs)/today");
  });

  it("blocked-state 'Go back' falls back to today when there is no history", () => {
    mockCanGoBack.mockReturnValueOnce(false);
    useHabitDetail.mockReturnValue(
      detailReturn({
        habit: makeHabit({
          automated_at: "2026-05-10T00:00:00.000Z",
          habit_state: "automatic",
        }),
      }),
    );
    renderWithClient(<GraduationCeremonyScreen />);
    fireEvent.press(screen.getByText("Go back"));
    expect(mockBack).not.toHaveBeenCalled();
    expect(mockReplace).toHaveBeenCalledWith("/(app)/(tabs)/today");
  });

  it("counts inclusive calendar days since start_date in the framing copy (start day = 1)", () => {
    // mocked now = 2026-05-15; start_date = 2026-05-15 → 1 day, not 0
    useHabitDetail.mockReturnValue(
      detailReturn({ habit: makeHabit({ start_date: "2026-05-15" }) }),
    );
    renderWithClient(<GraduationCeremonyScreen />);
    expect(
      screen.getByText(/This habit has been part of your life for 1 days/),
    ).toBeTruthy();
  });

  it("counts the start date as day 1 across longer windows (2026-01-01 → 2026-05-15 = 135 days)", () => {
    useHabitDetail.mockReturnValue(
      detailReturn({ habit: makeHabit({ start_date: "2026-01-01" }) }),
    );
    renderWithClient(<GraduationCeremonyScreen />);
    // Jan has 31 + Feb 28 + Mar 31 + Apr 30 + 15 (May 1–15 inclusive) = 135
    expect(
      screen.getByText(/This habit has been part of your life for 135 days/),
    ).toBeTruthy();
  });

  it("renders the blocked-state when access mode is read_only", () => {
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
    useHabitDetail.mockReturnValue(detailReturn());
    renderWithClient(<GraduationCeremonyScreen />);

    expect(
      screen.getByText(/Graduation isn.t available while the app is in read-only mode/),
    ).toBeTruthy();
    expect(screen.queryByText("See result")).toBeNull();
    expect(screen.getByText("Go back")).toBeTruthy();
  });

  it("renders the blocked-state when the habit is already automatic", () => {
    useHabitDetail.mockReturnValue(
      detailReturn({
        habit: makeHabit({
          automated_at: "2026-05-10T00:00:00.000Z",
          habit_state: "automatic",
        }),
      }),
    );
    renderWithClient(<GraduationCeremonyScreen />);

    expect(screen.getByText("This habit is already marked Automatic.")).toBeTruthy();
    expect(screen.queryByText("See result")).toBeNull();
  });

  it("renders the generic error path when the habit is not found", () => {
    useHabitDetail.mockReturnValue(detailReturn({ error: null, habit: null }));
    renderWithClient(<GraduationCeremonyScreen />);

    expect(
      screen.getByText("We couldn't load this habit's graduation right now. Try again."),
    ).toBeTruthy();
  });
});
