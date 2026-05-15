const mockUseMutation = jest.fn();
const mockUseQuery = jest.fn();
const mockInvalidateQueries = jest.fn();
const mockUseAuthSession = jest.fn();
const mockGetLatestSRHIResponse = jest.fn();
const mockGetSRHIResponsesForHabit = jest.fn();
const mockRecordAndProcessGraduation = jest.fn();
const mockToDeviceDateString = jest.fn();
const mockLoggerError = jest.fn();

jest.mock("@tanstack/react-query", () => ({
  useMutation: (options: unknown) => mockUseMutation(options),
  useQuery: (options: unknown) => mockUseQuery(options),
  useQueryClient: () => ({
    invalidateQueries: (options: unknown) => mockInvalidateQueries(options),
  }),
}));

jest.mock("@/features/auth/hooks", () => ({
  useAuthSession: () => mockUseAuthSession(),
}));

jest.mock("@/features/habits/hooks", () => ({
  getEligibleHabitsQueryKey: (
    userId: string | undefined,
    todayDate: string,
  ) => ["habits", "eligible", userId ?? "guest", todayDate],
  getHabitDetailQueryKey: (
    userId: string | undefined,
    habitId: string | undefined,
  ) => ["habits", "detail", userId ?? "guest", habitId ?? "unknown"],
}));

jest.mock("@/lib/db/repositories/srhi_responses", () => ({
  getLatestSRHIResponse: (habitId: string) =>
    mockGetLatestSRHIResponse(habitId),
  getSRHIResponsesForHabit: (habitId: string) =>
    mockGetSRHIResponsesForHabit(habitId),
}));

jest.mock("@/features/graduation/graduation", () => ({
  recordAndProcessGraduation: (input: unknown) =>
    mockRecordAndProcessGraduation(input),
}));

jest.mock("@/utils/dates", () => ({
  toDeviceDateString: () => mockToDeviceDateString(),
}));

jest.mock("@/services/logger", () => ({
  logger: {
    error: (...args: unknown[]) => mockLoggerError(...args),
  },
}));

import {
  getLatestSRHIQueryKey,
  getSRHIHistoryQueryKey,
  useLatestSRHIQuery,
  useRecordGraduationMutation,
  useSRHIHistoryQuery,
} from "@/features/graduation/hooks";

describe("graduation hooks", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockUseAuthSession.mockReturnValue({
      session: { user: { id: "user-1" } },
      user: { id: "user-1" },
    });
    mockUseMutation.mockImplementation((options: unknown) => options);
    mockUseQuery.mockImplementation((options: unknown) => options);
    mockToDeviceDateString.mockReturnValue("2026-05-15");
    mockInvalidateQueries.mockResolvedValue(undefined);
  });

  it("returns null for habit with no SRHI responses", async () => {
    mockGetLatestSRHIResponse.mockResolvedValue(null);

    useLatestSRHIQuery("habit-1");

    const queryOptions = mockUseQuery.mock.calls[0]?.[0] as {
      queryFn: () => Promise<unknown>;
      queryKey: unknown[];
    };

    expect(queryOptions.queryKey).toEqual(getLatestSRHIQueryKey("habit-1"));

    await expect(queryOptions.queryFn()).resolves.toBeNull();
    expect(mockGetLatestSRHIResponse).toHaveBeenCalledWith("habit-1");
  });

  it("returns the latest SRHI response when one exists", async () => {
    const latest = {
      average_score: 4.33,
      created_at: "2026-05-14T12:00:00.000Z",
      graduated: true,
      habit_id: "habit-1",
      id: "srhi-1",
      q1_score: 5,
      q2_score: 4,
      q3_score: 4,
      user_id: "user-1",
    };
    mockGetLatestSRHIResponse.mockResolvedValue(latest);

    useLatestSRHIQuery("habit-1");

    const queryOptions = mockUseQuery.mock.calls[0]?.[0] as {
      queryFn: () => Promise<unknown>;
    };

    await expect(queryOptions.queryFn()).resolves.toEqual(latest);
  });

  it("queries SRHI history with a habit-scoped key", async () => {
    mockGetSRHIResponsesForHabit.mockResolvedValue([]);

    useSRHIHistoryQuery("habit-2");

    const queryOptions = mockUseQuery.mock.calls[0]?.[0] as {
      queryFn: () => Promise<unknown>;
      queryKey: unknown[];
    };

    expect(queryOptions.queryKey).toEqual(getSRHIHistoryQueryKey("habit-2"));

    await queryOptions.queryFn();
    expect(mockGetSRHIResponsesForHabit).toHaveBeenCalledWith("habit-2");
  });

  it("rejects unauthenticated graduation submissions before calling the API", async () => {
    mockUseAuthSession.mockReturnValue({
      session: null,
      user: null,
    });

    useRecordGraduationMutation();

    const mutationOptions = mockUseMutation.mock.calls[0]?.[0] as {
      mutationFn: (payload: object) => Promise<unknown>;
    };

    await expect(
      mutationOptions.mutationFn({
        habit_id: "habit-1",
        q1_score: 5,
        q2_score: 4,
        q3_score: 5,
      }),
    ).rejects.toThrow(
      "You need an account session before recording a graduation.",
    );

    expect(mockRecordAndProcessGraduation).not.toHaveBeenCalled();
  });

  it("calls recordAndProcessGraduation with scores and the authed user", async () => {
    mockRecordAndProcessGraduation.mockResolvedValue({
      habit: { id: "habit-1", habit_state: "automatic" },
      response: { graduated: true },
    });

    useRecordGraduationMutation();

    const mutationOptions = mockUseMutation.mock.calls[0]?.[0] as {
      mutationFn: (payload: object) => Promise<unknown>;
    };

    await mutationOptions.mutationFn({
      habit_id: "habit-1",
      q1_score: 5,
      q2_score: 5,
      q3_score: 4,
    });

    expect(mockRecordAndProcessGraduation).toHaveBeenCalledWith({
      habit_id: "habit-1",
      q1_score: 5,
      q2_score: 5,
      q3_score: 4,
      user_id: "user-1",
    });
  });

  it("invalidates the four dependent query keys on successful graduation", async () => {
    useRecordGraduationMutation();

    const mutationOptions = mockUseMutation.mock.calls[0]?.[0] as {
      onSuccess: (
        result: unknown,
        variables: { habit_id: string },
      ) => Promise<void>;
    };

    await mutationOptions.onSuccess(
      { habit: null, response: { graduated: false } },
      { habit_id: "habit-1" },
    );

    expect(mockInvalidateQueries).toHaveBeenCalledWith({
      queryKey: ["habits", "detail", "user-1", "habit-1"],
    });
    expect(mockInvalidateQueries).toHaveBeenCalledWith({
      queryKey: ["habits", "eligible", "user-1", "2026-05-15"],
    });
    expect(mockInvalidateQueries).toHaveBeenCalledWith({
      queryKey: getLatestSRHIQueryKey("habit-1"),
    });
    expect(mockInvalidateQueries).toHaveBeenCalledWith({
      queryKey: getSRHIHistoryQueryKey("habit-1"),
    });
  });

  it("logs mutation failures with habit and user context", () => {
    useRecordGraduationMutation();

    const mutationOptions = mockUseMutation.mock.calls[0]?.[0] as {
      onError: (error: Error, variables: { habit_id: string }) => void;
    };
    const saveError = new Error("save failed");

    mutationOptions.onError(saveError, { habit_id: "habit-1" });

    expect(mockLoggerError).toHaveBeenCalledWith("Graduation mutation failed", {
      error: saveError,
      habitId: "habit-1",
      userId: "user-1",
    });
  });
});
