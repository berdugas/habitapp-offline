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
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import React from "react";

import TodayScreen from "@/features/today/screens/TodayScreen";
import { resetClockForTesting, setNowForTesting } from "@/utils/clock";

const mockPush = jest.fn();

jest.mock("expo-router", () => ({
  router: {
    push: (...args: unknown[]) => mockPush(...args),
  },
}));

jest.mock("@/features/today/hooks", () => ({
  useHabitLogsForRange: jest.fn(),
  useTodayHabits: jest.fn(),
  useUpsertTodayHabitStatusMutation: jest.fn(),
  useDeleteTodayHabitLogMutation: jest.fn(() => ({
    mutateAsync: jest.fn().mockResolvedValue(undefined),
    isPending: false,
    error: null,
  })),
}));

jest.mock("@/features/habits/hooks", () => ({
  useArchiveHabitMutation: jest.fn(),
}));

jest.mock("@/features/recovery/hooks", () => ({
  useRecoveryCheck: jest.fn(),
  useSingleMissBanner: jest.fn(),
}));

jest.mock("@/lib/db/repositories/preferences", () => ({
  setPreference: jest.fn().mockResolvedValue(undefined),
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

const { useArchiveHabitMutation } = jest.requireMock(
  "@/features/habits/hooks",
) as { useArchiveHabitMutation: jest.Mock };

const { useRecoveryCheck, useSingleMissBanner } = jest.requireMock(
  "@/features/recovery/hooks",
) as { useRecoveryCheck: jest.Mock; useSingleMissBanner: jest.Mock };

function buildFocusHabit(overrides = {}) {
  return {
    activeDays: [1, 2, 3, 4, 5, 6, 7],
    consistencyRate: 0,
    cue: "I wake up",
    formula: "After I wake up, I will Read 1 page.",
    icon: null,
    id: "habit-1",
    identityPhrase: "a reader",
    name: "Reading",
    offDay: false,
    skipCount: 0,
    startDate: "2026-04-01",
    streak: 0,
    tinyAction: "Read 1 page",
    todayStatus: null,
    ...overrides,
  };
}

function renderWithClient(ui: React.ReactElement) {
  const client = new QueryClient({
    defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
  });
  return render(<QueryClientProvider client={client}>{ui}</QueryClientProvider>);
}

describe("TodayScreen", () => {
  const mockMutateAsync = jest.fn();

  beforeEach(() => {
    jest.clearAllMocks();
    setNowForTesting(new Date("2026-04-30T10:00:00.000Z"));
    useUpsertTodayHabitStatusMutation.mockReturnValue({
      error: null,
      isPending: false,
      mutateAsync: mockMutateAsync,
    });
    useHabitLogsForRange.mockReturnValue({ data: [] });
    mockMutateAsync.mockResolvedValue(undefined);
    useArchiveHabitMutation.mockReturnValue({
      error: null,
      isPending: false,
      mutateAsync: jest.fn().mockResolvedValue(undefined),
    });
    useRecoveryCheck.mockReturnValue({
      shouldShowModal: false,
      breakRunStartDate: null,
      logs: [],
    });
    useSingleMissBanner.mockReturnValue({ showBanner: false, missDate: null });
  });

  afterEach(() => {
    resetClockForTesting();
  });

  it("shows a loading state while today data is still resolving", () => {
    useTodayHabits.mockReturnValue({
      error: null,
      habits: [],
      isLoading: true,
      upcomingHabits: [],
      goalStreaks: {},
    });

    renderWithClient(<TodayScreen />);

    expect(screen.getByText("Loading your Today view...")).toBeTruthy();
    expect(screen.queryByText("No active habits yet")).toBeNull();
  });

  it("shows a friendly load error instead of an empty state when today data fails", () => {
    useTodayHabits.mockReturnValue({
      error: new Error("query failed"),
      habits: [],
      isLoading: false,
      upcomingHabits: [],
      goalStreaks: {},
    });

    renderWithClient(<TodayScreen />);

    expect(
      screen.getByText("We couldn't load your habits right now. Try again."),
    ).toBeTruthy();
    expect(screen.queryByText("No active habits yet")).toBeNull();
  });

  it("shows the empty state when no habits exist", () => {
    useTodayHabits.mockReturnValue({
      error: null,
      habits: [],
      isLoading: false,
      upcomingHabits: [],
      goalStreaks: {},
    });

    renderWithClient(<TodayScreen />);

    expect(screen.getByText("No active habits yet")).toBeTruthy();
    expect(
      screen.getByText(
        "Start with one small habit — sized to your worst day.",
      ),
    ).toBeTruthy();
    expect(screen.getByText("Create your first habit")).toBeTruthy();
  });

  it("routes to Create Habit from the empty state CTA", () => {
    useTodayHabits.mockReturnValue({
      error: null,
      habits: [],
      isLoading: false,
      upcomingHabits: [],
      goalStreaks: {},
    });

    renderWithClient(<TodayScreen />);

    fireEvent.press(screen.getByText("Create your first habit"));

    expect(mockPush).toHaveBeenCalledWith("/(app)/habits/create");
  });

  it("prevents a second status write while the first one is still in flight", async () => {
    let resolveMutation: (() => void) | undefined;

    mockMutateAsync.mockReturnValue(
      new Promise<void>((resolve) => {
        resolveMutation = resolve;
      }),
    );
    useTodayHabits.mockReturnValue({
      error: null,
      habits: [buildFocusHabit()],
      isLoading: false,
      upcomingHabits: [],
      goalStreaks: {},
    });

    renderWithClient(<TodayScreen />);

    fireEvent.press(screen.getByLabelText("Log Reading"));
    fireEvent.press(screen.getByLabelText("Log Reading"));

    expect(mockMutateAsync).toHaveBeenCalledTimes(1);

    if (resolveMutation) {
      resolveMutation();
    }
  });
});
