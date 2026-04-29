import { fireEvent, render, screen, waitFor } from "@testing-library/react-native";

import CreateHabitScreen from "@/features/habits/screens/CreateHabitScreen";

const mockReplace = jest.fn();
const mockPush = jest.fn();
const mockMutateAsync = jest.fn();
const mockInvalidateQueries = jest.fn();
const mockFetchQuery = jest.fn();
const mockUseAuthSession = jest.fn();
const mockUseInactiveHabitsQuery = jest.fn();

jest.mock("expo-router", () => ({
  router: {
    push: (...args: unknown[]) => mockPush(...args),
    replace: (...args: unknown[]) => mockReplace(...args),
  },
}));

jest.mock("@tanstack/react-query", () => ({
  useQueryClient: () => ({
    fetchQuery: (...args: unknown[]) => mockFetchQuery(...args),
    invalidateQueries: (...args: unknown[]) => mockInvalidateQueries(...args),
  }),
}));

jest.mock("@/features/auth/hooks", () => ({
  useAuthSession: () => mockUseAuthSession(),
}));

jest.mock("@/features/habits/api", () => ({
  listEligibleHabitsForToday: jest.fn(),
}));

jest.mock("@/features/habits/hooks", () => ({
  useCreateHabitMutation: jest.fn(),
  getEligibleHabitsQueryKey: jest.fn(
    (userId: string | undefined, todayDate: string) => [
      "habits",
      "eligible",
      userId ?? "guest",
      todayDate,
    ],
  ),
  useInactiveHabitsQuery: () => mockUseInactiveHabitsQuery(),
}));

jest.mock("@/utils/dates", () => ({
  toDeviceDateString: jest.fn(() => "2026-04-23"),
}));

const { getEligibleHabitsQueryKey, useCreateHabitMutation } = jest.requireMock(
  "@/features/habits/hooks",
) as {
  getEligibleHabitsQueryKey: jest.Mock;
  useCreateHabitMutation: jest.Mock;
};

describe("CreateHabitScreen", () => {
  let consoleErrorSpy: jest.SpyInstance;
  let consoleWarnSpy: jest.SpyInstance;

  beforeEach(() => {
    jest.clearAllMocks();
    consoleErrorSpy = jest.spyOn(console, "error").mockImplementation(() => undefined);
    consoleWarnSpy = jest.spyOn(console, "warn").mockImplementation(() => undefined);
    mockUseAuthSession.mockReturnValue({
      isBootstrapping: false,
      session: { user: { id: "user-1" } },
      user: { id: "user-1" },
    });
    mockUseInactiveHabitsQuery.mockReturnValue({
      data: [],
    });
    useCreateHabitMutation.mockReturnValue({
      isPending: false,
      mutateAsync: mockMutateAsync,
    });
    mockInvalidateQueries.mockResolvedValue(undefined);
    mockFetchQuery.mockResolvedValue([
      {
        id: "habit-1",
      },
    ]);
    mockMutateAsync.mockResolvedValue({
      id: "habit-1",
    });
  });

  afterEach(() => {
    consoleErrorSpy.mockRestore();
    consoleWarnSpy.mockRestore();
  });

  it("submits the first habit, refetches eligible habits, and then routes to today", async () => {
    render(<CreateHabitScreen />);

    fireEvent.changeText(screen.getByPlaceholderText("Reading"), "Reading");
    fireEvent.changeText(
      screen.getByPlaceholderText("After I brush my teeth"),
      "I brush my teeth",
    );
    fireEvent.changeText(
      screen.getByPlaceholderText("Read 1 page"),
      "Read 1 page",
    );

    fireEvent.press(screen.getByText("Save Habit"));

    await waitFor(() => {
      expect(mockMutateAsync).toHaveBeenCalledWith({
        title: "Reading",
        identityPhrase: "",
        cue: "I brush my teeth",
        tinyAction: "Read 1 page",
        minimumViableAction: "",
        preferredTimeWindow: "",
        habitState: "focus",
      });
    });

    await waitFor(() => {
      expect(mockInvalidateQueries).toHaveBeenCalledWith({
        queryKey: ["habits", "eligible", "user-1", "2026-04-23"],
      });
      expect(mockFetchQuery).toHaveBeenCalledWith({
        queryFn: expect.any(Function),
        queryKey: ["habits", "eligible", "user-1", "2026-04-23"],
      });
      expect(mockReplace).toHaveBeenCalledWith("/(app)/(tabs)/today");
    });

    expect(getEligibleHabitsQueryKey).toHaveBeenCalledWith(
      "user-1",
      "2026-04-23",
    );
    expect(mockInvalidateQueries.mock.invocationCallOrder[0]).toBeLessThan(
      mockFetchQuery.mock.invocationCallOrder[0],
    );
    expect(mockFetchQuery.mock.invocationCallOrder[0]).toBeLessThan(
      mockReplace.mock.invocationCallOrder[0],
    );
  });

  it("routes to Today when the habit is saved but the eligible habits refetch fails", async () => {
    mockFetchQuery.mockRejectedValueOnce(new Error("Could not refresh habits."));

    render(<CreateHabitScreen />);

    fireEvent.changeText(screen.getByPlaceholderText("Reading"), "Reading");
    fireEvent.changeText(
      screen.getByPlaceholderText("After I brush my teeth"),
      "I brush my teeth",
    );
    fireEvent.changeText(
      screen.getByPlaceholderText("Read 1 page"),
      "Read 1 page",
    );

    fireEvent.press(screen.getByText("Save Habit"));

    await waitFor(() => {
      expect(mockReplace).toHaveBeenCalledWith("/(app)/(tabs)/today");
    });
    expect(consoleWarnSpy).toHaveBeenCalled();
    expect(consoleErrorSpy).not.toHaveBeenCalled();
  });

  it("prevents a second save while the first one is still in flight", async () => {
    let resolveSave: ((value: { id: string }) => void) | undefined;

    mockMutateAsync.mockReturnValue(
      new Promise<{ id: string }>((resolve) => {
        resolveSave = resolve;
      }),
    );

    render(<CreateHabitScreen />);

    fireEvent.changeText(screen.getByPlaceholderText("Reading"), "Reading");
    fireEvent.changeText(
      screen.getByPlaceholderText("After I brush my teeth"),
      "I brush my teeth",
    );
    fireEvent.changeText(
      screen.getByPlaceholderText("Read 1 page"),
      "Read 1 page",
    );

    fireEvent.press(screen.getByText("Save Habit"));
    fireEvent.press(screen.getByText("Save Habit"));

    expect(mockMutateAsync).toHaveBeenCalledTimes(1);

    if (resolveSave) {
      resolveSave({ id: "habit-1" });
    }

    await waitFor(() => {
      expect(mockReplace).toHaveBeenCalledWith("/(app)/(tabs)/today");
    });
  });

  it("preserves entered values when the create mutation fails", async () => {
    mockMutateAsync.mockRejectedValueOnce(new Error("create failed"));

    render(<CreateHabitScreen />);

    fireEvent.changeText(screen.getByPlaceholderText("Reading"), "Reading");
    fireEvent.changeText(
      screen.getByPlaceholderText("Become someone who reads daily"),
      "Become a reader",
    );
    fireEvent.changeText(
      screen.getByPlaceholderText("After I brush my teeth"),
      "After breakfast",
    );
    fireEvent.changeText(
      screen.getByPlaceholderText("Read 1 page"),
      "Read 1 page",
    );
    fireEvent.press(screen.getByLabelText("Evening preferred time window"));

    fireEvent.press(screen.getByText("Save Habit"));

    await waitFor(() => {
      expect(
        screen.getByText("We couldn't save your habit right now. Try again."),
      ).toBeTruthy();
    });

    expect(screen.getByDisplayValue("Reading")).toBeTruthy();
    expect(screen.getByDisplayValue("Become a reader")).toBeTruthy();
    expect(screen.getByDisplayValue("After breakfast")).toBeTruthy();
    expect(screen.getByDisplayValue("Read 1 page")).toBeTruthy();
    expect(
      screen.getByLabelText("Evening preferred time window selected"),
    ).toBeTruthy();
    expect(mockReplace).not.toHaveBeenCalled();
  });

  it("stores the selected preferred time window from the pill selector", async () => {
    render(<CreateHabitScreen />);

    fireEvent.changeText(screen.getByPlaceholderText("Reading"), "Reading");
    fireEvent.changeText(
      screen.getByPlaceholderText("After I brush my teeth"),
      "breakfast",
    );
    fireEvent.changeText(
      screen.getByPlaceholderText("Read 1 page"),
      "Read 1 page",
    );
    fireEvent.press(screen.getByLabelText("Morning preferred time window"));

    fireEvent.press(screen.getByText("Save Habit"));

    await waitFor(() => {
      expect(mockMutateAsync).toHaveBeenCalledWith(
        expect.objectContaining({
          preferredTimeWindow: "Morning",
        }),
      );
    });
  });

  it("does not duplicate After in the preview when the user types it", () => {
    render(<CreateHabitScreen />);

    fireEvent.changeText(
      screen.getByPlaceholderText("After I brush my teeth"),
      "After breakfast",
    );
    fireEvent.changeText(
      screen.getByPlaceholderText("Read 1 page"),
      "Read one page",
    );

    expect(
      screen.getByText("After breakfast, I will Read one page."),
    ).toBeTruthy();
    expect(
      screen.queryByText("After After breakfast, I will Read one page."),
    ).toBeNull();
  });

  it("shows the normal preview when the user types a plain trigger", () => {
    render(<CreateHabitScreen />);

    fireEvent.changeText(
      screen.getByPlaceholderText("After I brush my teeth"),
      "breakfast",
    );
    fireEvent.changeText(
      screen.getByPlaceholderText("Read 1 page"),
      "Read one page",
    );

    expect(
      screen.getByText("After breakfast, I will Read one page."),
    ).toBeTruthy();
  });

  it("shows the pending label while the create mutation is in flight", () => {
    useCreateHabitMutation.mockReturnValue({
      isPending: true,
      mutateAsync: mockMutateAsync,
    });

    render(<CreateHabitScreen />);

    expect(screen.getByText("Saving habit...")).toBeTruthy();
  });

  it("surfaces inactive habits when the user has no active habits left", () => {
    mockUseInactiveHabitsQuery.mockReturnValue({
      data: [
        {
          id: "habit-9",
          title: "Reading",
          cue: "After breakfast",
          tiny_action: "Read 1 page",
        },
      ],
    });

    render(<CreateHabitScreen />);

    expect(screen.getByText("You already have inactive habits")).toBeTruthy();
    expect(screen.getByText("After breakfast, I will Read 1 page.")).toBeTruthy();
    expect(screen.queryByText("After After breakfast, I will Read 1 page.")).toBeNull();
    expect(screen.getByText("Open Settings")).toBeTruthy();

    fireEvent.press(screen.getByLabelText("Reading details"));

    expect(mockPush).toHaveBeenCalledWith("/(app)/habits/habit-9");
  });
});
