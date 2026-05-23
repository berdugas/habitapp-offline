const mockUseMutation = jest.fn();
const mockUseQuery = jest.fn();
const mockInvalidateQueries = jest.fn();
const mockSetQueryData = jest.fn();
const mockUseAuthSession = jest.fn();
const mockGetLatestWeeklyReview = jest.fn();
const mockGetWeeklyReviewForWeek = jest.fn();
const mockUpsertWeeklyReview = jest.fn();
const mockGetWeekStartDateString = jest.fn();
const mockLoggerError = jest.fn();

jest.mock("@tanstack/react-query", () => ({
  useMutation: (options: unknown) => mockUseMutation(options),
  useQuery: (options: unknown) => mockUseQuery(options),
  useQueryClient: () => ({
    invalidateQueries: (options: unknown) => mockInvalidateQueries(options),
    setQueryData: (queryKey: unknown, data: unknown) =>
      mockSetQueryData(queryKey, data),
  }),
}));

jest.mock("@/features/auth/hooks", () => ({
  useAuthSession: () => mockUseAuthSession(),
}));

jest.mock("@/features/habits/hooks", () => ({
  getHabitDetailQueryKey: (userId: string | undefined, habitId: string | undefined) => [
    "habits",
    "detail",
    userId ?? "guest",
    habitId ?? "unknown",
  ],
}));

jest.mock("@/features/reviews/api", () => ({
  getLatestWeeklyReview: (userId: string, habitId: string) =>
    mockGetLatestWeeklyReview(userId, habitId),
  getWeeklyReviewForWeek: (
    userId: string,
    habitId: string,
    weekStart: string,
  ) => mockGetWeeklyReviewForWeek(userId, habitId, weekStart),
  upsertWeeklyReview: (userId: string, payload: unknown) =>
    mockUpsertWeeklyReview(userId, payload),
}));

jest.mock("@/utils/dates", () => ({
  getWeekStartDateString: () => mockGetWeekStartDateString(),
}));

jest.mock("@/services/logger", () => ({
  logger: {
    error: (...args: unknown[]) => mockLoggerError(...args),
  },
}));

import {
  useCurrentWeeklyReviewQuery,
  useLatestWeeklyReviewQuery,
  useUpsertWeeklyReviewMutation,
} from "@/features/reviews/hooks";
import {
  getCurrentWeeklyReviewQueryKey,
  getLatestWeeklyReviewQueryKey,
} from "@/features/reviews/queryKeys";

describe("weekly review hooks", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockUseAuthSession.mockReturnValue({
      session: { user: { id: "user-1" } },
      user: { id: "user-1" },
    });
    mockUseMutation.mockImplementation((options: unknown) => options);
    mockUseQuery.mockImplementation((options: unknown) => options);
    mockGetWeekStartDateString.mockReturnValue("2026-04-20");
    mockInvalidateQueries.mockResolvedValue(undefined);
    mockSetQueryData.mockReturnValue(undefined);
    mockUpsertWeeklyReview.mockResolvedValue({
      id: "review-1",
    });
  });

  it("uses current Monday week start for the current review query", () => {
    useCurrentWeeklyReviewQuery("habit-1");

    const queryOptions = mockUseQuery.mock.calls[0]?.[0] as {
      queryFn: () => Promise<unknown>;
      queryKey: unknown[];
    };

    expect(queryOptions.queryKey).toEqual(
      getCurrentWeeklyReviewQueryKey("user-1", "habit-1", "2026-04-20"),
    );

    void queryOptions.queryFn();

    expect(mockGetWeeklyReviewForWeek).toHaveBeenCalledWith(
      "user-1",
      "habit-1",
      "2026-04-20",
    );
  });

  it("queries the latest weekly review with user and habit scope", () => {
    useLatestWeeklyReviewQuery("habit-1");

    const queryOptions = mockUseQuery.mock.calls[0]?.[0] as {
      queryFn: () => Promise<unknown>;
      queryKey: unknown[];
    };

    expect(queryOptions.queryKey).toEqual(
      getLatestWeeklyReviewQueryKey("user-1", "habit-1"),
    );

    void queryOptions.queryFn();

    expect(mockGetLatestWeeklyReview).toHaveBeenCalledWith("user-1", "habit-1");
  });

  it("rejects unauthenticated saves before calling the API", async () => {
    mockUseAuthSession.mockReturnValue({
      session: null,
      user: null,
    });

    useUpsertWeeklyReviewMutation();

    const mutationOptions = mockUseMutation.mock.calls[0]?.[0] as {
      mutationFn: (payload: object) => Promise<unknown>;
    };

    await expect(
      mutationOptions.mutationFn({
        habitId: "habit-1",
      }),
    ).rejects.toThrow("You need an account session before saving a weekly review.");

    expect(mockUpsertWeeklyReview).not.toHaveBeenCalled();
  });

  it("calls the API, caches the saved review, and invalidates dependent queries", async () => {
    useUpsertWeeklyReviewMutation();

    const mutationOptions = mockUseMutation.mock.calls[0]?.[0] as {
      mutationFn: (payload: object) => Promise<unknown>;
      onSuccess: (_data: unknown, payload: {
        habitId: string;
        weekStart: string;
      }) => Promise<void>;
    };
    const payload = {
      adjustmentNote: "Try earlier",
      habitId: "habit-1",
      tinyActionTooHard: false,
      triggerWorked: true,
      weekStart: "2026-04-20",
    };
    const savedReview = {
      adjustment_note: "Try earlier",
      habit_id: "habit-1",
      id: "review-1",
      tiny_action_too_hard: false,
      trigger_worked: true,
      user_id: "user-1",
      week_start: "2026-04-20",
    };

    await mutationOptions.mutationFn(payload);

    expect(mockUpsertWeeklyReview).toHaveBeenCalledWith("user-1", payload);

    await mutationOptions.onSuccess(savedReview, payload);

    expect(mockSetQueryData).toHaveBeenCalledWith(
      getLatestWeeklyReviewQueryKey("user-1", "habit-1"),
      savedReview,
    );
    expect(mockSetQueryData).toHaveBeenCalledWith(
      getCurrentWeeklyReviewQueryKey("user-1", "habit-1", "2026-04-20"),
      savedReview,
    );

    expect(mockInvalidateQueries).toHaveBeenCalledWith({
      queryKey: getLatestWeeklyReviewQueryKey("user-1", "habit-1"),
    });
    expect(mockInvalidateQueries).toHaveBeenCalledWith({
      queryKey: getCurrentWeeklyReviewQueryKey(
        "user-1",
        "habit-1",
        "2026-04-20",
      ),
    });
    expect(mockInvalidateQueries).toHaveBeenCalledWith({
      queryKey: ["habits", "detail", "user-1", "habit-1"],
    });
  });

  it("logs mutation failures with habit, user, and week context", () => {
    useUpsertWeeklyReviewMutation();

    const mutationOptions = mockUseMutation.mock.calls[0]?.[0] as {
      onError: (error: Error, payload: {
        habitId: string;
        weekStart: string;
      }) => void;
    };
    const saveError = new Error("save failed");

    mutationOptions.onError(saveError, {
      habitId: "habit-1",
      weekStart: "2026-04-20",
    });

    expect(mockLoggerError).toHaveBeenCalledWith("Weekly review mutation failed", {
      error: saveError,
      habitId: "habit-1",
      userId: "user-1",
      weekStart: "2026-04-20",
    });
  });
});
