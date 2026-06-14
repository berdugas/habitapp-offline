// Mock hoisting: vars referenced inside jest.mock factories must start with
// `mock` so Babel's hoist transform includes them. Using `var` (not `const`)
// ensures the binding is initialised before the factory executes.
// eslint-disable-next-line no-var
var mockShowCapBlock = jest.fn();

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

jest.mock("expo-router", () => ({
  router: { push: jest.fn(), replace: jest.fn() },
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

jest.mock("@/features/paywall/PaywallController", () => ({
  usePaywall: () => ({ showCapBlockPaywall: mockShowCapBlock }),
}));

import React from "react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { fireEvent, render, screen } from "@/tests/setup/render";

import TodayScreen from "@/features/today/screens/TodayScreen";
import { groupAndSortForToday } from "@/features/today/ordering";

import type { TodayHabitCardData } from "@/features/today/types";

const {
  useTodayHabits,
  useUpsertTodayHabitStatusMutation,
} = jest.requireMock("@/features/today/hooks") as {
  useTodayHabits: jest.Mock;
  useUpsertTodayHabitStatusMutation: jest.Mock;
};

const { useArchiveHabitMutation } = jest.requireMock(
  "@/features/habits/hooks",
) as { useArchiveHabitMutation: jest.Mock };

const { useRecoveryCheck, useSingleMissBanner } = jest.requireMock(
  "@/features/recovery/hooks",
) as { useRecoveryCheck: jest.Mock; useSingleMissBanner: jest.Mock };

const { useTrialValidation } = jest.requireMock(
  "@/features/trial/hooks",
) as { useTrialValidation: jest.Mock };

const { router } = jest.requireMock("expo-router") as {
  router: { push: jest.Mock };
};

function makeTrialState(accessMode: string) {
  return {
    isBootstrapping: false,
    isValidating: false,
    accessMode,
    entitlementStatus: "trial",
    trialStartedAt: null,
    trialEndsAt: null,
    lastValidatedAt: null,
    refresh: jest.fn().mockResolvedValue(undefined),
  };
}

function renderWithClient(ui: React.ReactElement) {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return render(<QueryClientProvider client={client}>{ui}</QueryClientProvider>);
}

function makeHabit(overrides: Record<string, unknown> = {}) {
  return {
    activeDays: [1, 2, 3, 4, 5, 6, 7],
    consistencyDenominator: 10,
    consistencyRate: 0.9,
    createdAt: "2025-01-01T00:00:00.000Z",
    cue: "morning coffee",
    formula: "After morning coffee, run for 2 minutes",
    habitState: "active",
    icon: null,
    id: "habit-1",
    identityPhrase: "a runner",
    name: "Run",
    offDay: false,
    reminderTime: null,
    reminderType: "none",
    skipCount: 0,
    startDate: "2026-04-01",
    streak: 12,
    tinyAction: "run for 2 minutes",
    todayStatus: null,
    ...overrides,
  };
}

function mockTodayHabits(value: Record<string, unknown>) {
  const habits = (value.habits as TodayHabitCardData[] | undefined) ?? [];
  const groups = value.groups ?? groupAndSortForToday(habits);
  (useTodayHabits as jest.Mock).mockReturnValue({ groups, ...value });
}

describe("TodayScreen — paywall routing", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    // mockShowCapBlock is a module-level var; clearAllMocks resets it.
    // router.push is also reset by clearAllMocks.

    useTrialValidation.mockReturnValue(makeTrialState("full"));

    useUpsertTodayHabitStatusMutation.mockReturnValue({
      error: null,
      isPending: false,
      mutateAsync: jest.fn().mockResolvedValue(undefined),
    });
    useArchiveHabitMutation.mockReturnValue({
      error: null,
      isPending: false,
      mutateAsync: jest.fn().mockResolvedValue(undefined),
    });
    useRecoveryCheck.mockReturnValue({
      shouldShowModal: false,
      triggeringHabit: null,
      breakRunStartDate: null,
      logs: [],
    });
    useSingleMissBanner.mockReturnValue({
      showBanner: false,
      missDate: null,
      missingHabitId: null,
    });
  });

  it("free-tier 'Start a new goal' opens the cap-block paywall, not the create screen", () => {
    useTrialValidation.mockReturnValue(makeTrialState("expired_no_purchase"));
    mockTodayHabits({
      error: null,
      habits: [makeHabit()],
      isLoading: false,
      upcomingHabits: [],
      goalStreaks: { "a runner": 12 },
    });

    renderWithClient(<TodayScreen />);

    fireEvent.press(screen.getByText("Start a new goal"));

    expect(mockShowCapBlock).toHaveBeenCalledWith("cap_create");
    expect(router.push).not.toHaveBeenCalledWith("/(app)/habits/create");
  });

  it("read_only keeps the new-goal row hidden", () => {
    useTrialValidation.mockReturnValue(makeTrialState("read_only"));
    mockTodayHabits({
      error: null,
      habits: [makeHabit()],
      isLoading: false,
      upcomingHabits: [],
      goalStreaks: { "a runner": 12 },
    });

    renderWithClient(<TodayScreen />);

    expect(screen.queryByText("Start a new goal")).toBeNull();
  });

  it("full access pushes the create screen as before", () => {
    useTrialValidation.mockReturnValue(makeTrialState("full"));
    mockTodayHabits({
      error: null,
      habits: [makeHabit()],
      isLoading: false,
      upcomingHabits: [],
      goalStreaks: { "a runner": 12 },
    });

    renderWithClient(<TodayScreen />);

    fireEvent.press(screen.getByText("Start a new goal"));

    expect(router.push).toHaveBeenCalledWith("/(app)/habits/create");
    expect(mockShowCapBlock).not.toHaveBeenCalled();
  });

  it("free-tier: HabitRow is NOT disabled (logging is allowed)", () => {
    useTrialValidation.mockReturnValue(makeTrialState("expired_no_purchase"));
    const mutateAsync = jest.fn().mockResolvedValue(undefined);
    useUpsertTodayHabitStatusMutation.mockReturnValue({
      error: null,
      isPending: false,
      mutateAsync,
    });
    mockTodayHabits({
      error: null,
      habits: [makeHabit()],
      isLoading: false,
      upcomingHabits: [],
      goalStreaks: { "a runner": 12 },
    });

    renderWithClient(<TodayScreen />);

    fireEvent.press(screen.getByLabelText("Log Run"));

    expect(mutateAsync).toHaveBeenCalledWith({ habitId: "habit-1", status: "done" });
  });

  it("read_only: HabitRow is disabled (logging is blocked)", () => {
    useTrialValidation.mockReturnValue(makeTrialState("read_only"));
    const mutateAsync = jest.fn().mockResolvedValue(undefined);
    useUpsertTodayHabitStatusMutation.mockReturnValue({
      error: null,
      isPending: false,
      mutateAsync,
    });
    mockTodayHabits({
      error: null,
      habits: [makeHabit()],
      isLoading: false,
      upcomingHabits: [],
      goalStreaks: { "a runner": 12 },
    });

    renderWithClient(<TodayScreen />);

    fireEvent.press(screen.getByLabelText("Log Run"));

    // disabled prop on HabitRow prevents the press from registering
    expect(mutateAsync).not.toHaveBeenCalled();
  });
});
