// useTrialValidation must be mocked before imports
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

const mockShowCapBlock = jest.fn();
jest.mock("@/features/paywall/PaywallController", () => ({
  usePaywall: () => ({ showCapBlockPaywall: mockShowCapBlock }),
}));

import { fireEvent, render, screen } from "@/tests/setup/render";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import React from "react";

import EditHabitScreen from "@/features/habits/screens/EditHabitScreen";

jest.mock("expo-router", () => ({
  router: {
    push: jest.fn(),
    replace: jest.fn(),
    back: jest.fn(),
    canGoBack: jest.fn(() => true),
  },
  useLocalSearchParams: jest.fn(() => ({ habitId: "habit-1" })),
}));

jest.mock("@/features/reminders/notifications", () => ({
  scheduleReminder: jest.fn().mockResolvedValue(undefined),
  cancelReminder: jest.fn().mockResolvedValue(undefined),
}));

jest.mock("@/lib/db/repositories/reminders", () => ({
  getReminderByHabitId: jest.fn().mockRejectedValue(new Error("no reminder")),
}));

jest.mock("@/features/habits/hooks", () => ({
  useOwnedHabitQuery: jest.fn(),
  useUpdateHabitMutation: jest.fn(),
}));

jest.mock("@/features/auth/hooks", () => ({
  useAuthSession: jest.fn(() => ({ user: { id: "user-1" } })),
}));

const { useOwnedHabitQuery, useUpdateHabitMutation } = jest.requireMock(
  "@/features/habits/hooks",
) as {
  useOwnedHabitQuery: jest.Mock;
  useUpdateHabitMutation: jest.Mock;
};

const { useTrialValidation } = jest.requireMock(
  "@/features/trial/hooks",
) as { useTrialValidation: jest.Mock };

const baseHabit = {
  active_days: "[1,2,3,4,5,6,7]",
  id: "habit-1",
  title: "Run",
  identity_phrase: "a runner",
  cue: "morning coffee",
  tiny_action: "run for 2 minutes",
  minimum_viable_action: null,
  preferred_time_window: null,
  habit_state: "active",
  status: "active",
  start_date: "2026-04-01",
  created_at: "2026-04-01T00:00:00.000Z",
  updated_at: "2026-04-01T00:00:00.000Z",
  archived_at: null,
  automated_at: null,
  backlog_at: null,
  user_id: "user-1",
};

let mockUpdateMutate: jest.Mock;

function renderEdit() {
  const client = new QueryClient({
    defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
  });
  return render(
    <QueryClientProvider client={client}>
      <EditHabitScreen />
    </QueryClientProvider>,
  );
}

describe("EditHabitScreen — paywall affordances", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockUpdateMutate = jest.fn().mockResolvedValue(undefined);
    useUpdateHabitMutation.mockReturnValue({
      mutateAsync: mockUpdateMutate,
      isPending: false,
      error: null,
    });
    useOwnedHabitQuery.mockReturnValue({
      data: baseHabit,
      isLoading: false,
      error: null,
    });
    useTrialValidation.mockReturnValue({
      isBootstrapping: false,
      isValidating: false,
      accessMode: "full",
      entitlementStatus: "trial",
      trialStartedAt: null,
      trialEndsAt: null,
      lastValidatedAt: null,
      refresh: jest.fn().mockResolvedValue(undefined),
    });
  });

  it("free-tier save tap opens the cap-block paywall and does not mutate", () => {
    useTrialValidation.mockReturnValue({
      accessMode: "expired_no_purchase",
      isBootstrapping: false,
      isValidating: false,
      refresh: jest.fn().mockResolvedValue(undefined),
    });
    renderEdit();
    fireEvent.press(screen.getByText("Unlock to edit"));
    expect(mockShowCapBlock).toHaveBeenCalledWith("cap_edit");
    expect(mockUpdateMutate).not.toHaveBeenCalled();
  });

  it("read_only still shows the Reconnect helper, not the unlock CTA", () => {
    useTrialValidation.mockReturnValue({
      accessMode: "read_only",
      isBootstrapping: false,
      isValidating: false,
      refresh: jest.fn().mockResolvedValue(undefined),
    });
    renderEdit();
    expect(screen.getByText("Reconnect to edit habits.")).toBeTruthy();
    expect(screen.queryByText("Unlock to edit")).toBeNull();
  });
});
