// Mock at the very top — same pattern as ArchivedGoalDetailScreen.test.tsx

const mockShowCapBlock = jest.fn();
jest.mock("@/features/paywall/PaywallController", () => ({
  usePaywall: () => ({ showCapBlockPaywall: mockShowCapBlock }),
}));

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

import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import React from "react";
import { fireEvent, render, screen } from "@/tests/setup/render";

import ArchivedHabitDetailScreen from "@/features/habits/screens/ArchivedHabitDetailScreen";

const mockReplace = jest.fn();
const mockDismissAll = jest.fn();
const mockCanDismiss = jest.fn(() => true);
jest.mock("expo-router", () => ({
  router: {
    back: jest.fn(),
    push: jest.fn(),
    replace: (...args: unknown[]) => mockReplace(...args),
    dismissAll: () => mockDismissAll(),
    canDismiss: () => mockCanDismiss(),
  },
  useLocalSearchParams: () => ({ habitId: "h1" }),
}));

jest.mock("@/features/habits/hooks", () => ({
  useOwnedHabitQuery: jest.fn(),
  useRestoreHabitMutation: jest.fn(),
  useDeleteHabitMutation: jest.fn(),
}));

jest.mock("@/components/LucideIconPicker", () => ({
  LucideIcon: () => null,
}));

const {
  useOwnedHabitQuery,
  useRestoreHabitMutation,
  useDeleteHabitMutation,
} = jest.requireMock("@/features/habits/hooks") as {
  useOwnedHabitQuery: jest.Mock;
  useRestoreHabitMutation: jest.Mock;
  useDeleteHabitMutation: jest.Mock;
};

function makeHabit(overrides: Partial<Record<string, unknown>> = {}) {
  return {
    id: "h1",
    user_id: "user-1",
    title: "Read daily",
    identity_phrase: "a reader",
    cue: "after coffee",
    tiny_action: "read 1 page",
    minimum_viable_action: null,
    preferred_time_window: null,
    icon: null,
    habit_state: "active",
    status: "archived",
    active_days: "[1,2,3,4,5,6,7]",
    start_date: "2026-04-01",
    created_at: "2026-04-01T12:00:00.000Z",
    updated_at: "2026-05-01T12:00:00.000Z",
    archived_at: "2026-05-01T12:00:00.000Z",
    automated_at: null,
    backlog_at: null,
    ...overrides,
  };
}

function renderWithClient(ui: React.ReactElement) {
  const client = new QueryClient({
    defaultOptions: { queries: { retry: false } },
  });
  return render(<QueryClientProvider client={client}>{ui}</QueryClientProvider>);
}

beforeEach(() => {
  jest.clearAllMocks();
  mockCanDismiss.mockReturnValue(true);
  const { useTrialValidation } = jest.requireMock(
    "@/features/trial/hooks",
  ) as { useTrialValidation: jest.Mock };
  useTrialValidation.mockReturnValue({
    accessMode: "full",
    entitlementStatus: "trial",
    isBootstrapping: false,
    isValidating: false,
    lastValidatedAt: null,
    refresh: jest.fn().mockResolvedValue(undefined),
    trialEndsAt: null,
    trialStartedAt: null,
  });
  useOwnedHabitQuery.mockReturnValue({
    data: makeHabit(),
    isLoading: false,
    isFetched: true,
    error: null,
  });
  useRestoreHabitMutation.mockReturnValue({
    mutate: jest.fn(),
    mutateAsync: jest.fn().mockResolvedValue({}),
    isPending: false,
    error: null,
  });
  useDeleteHabitMutation.mockReturnValue({
    mutate: jest.fn(),
    mutateAsync: jest.fn().mockResolvedValue({}),
    isPending: false,
    error: null,
  });
});

describe("ArchivedHabitDetailScreen — paywall affordances", () => {
  it("free-tier shows 'Unlock $1.99 to restore' and opens the paywall", () => {
    const { useTrialValidation } = jest.requireMock(
      "@/features/trial/hooks",
    ) as { useTrialValidation: jest.Mock };
    useTrialValidation.mockReturnValueOnce({
      accessMode: "expired_no_purchase",
      isValidating: false,
      refresh: jest.fn(),
    });
    renderWithClient(<ArchivedHabitDetailScreen />);
    expect(screen.getByText("Unlock $1.99 to restore")).toBeTruthy();
    fireEvent.press(screen.getByText("Unlock $1.99 to restore"));
    expect(mockShowCapBlock).toHaveBeenCalledWith("cap_restore");
  });

  it("full access still shows the normal Restore habit button", () => {
    // useTrialValidation already returns full from beforeEach
    renderWithClient(<ArchivedHabitDetailScreen />);
    expect(screen.getByText("Restore habit")).toBeTruthy();
    expect(screen.queryByText("Unlock $1.99 to restore")).toBeNull();
  });

  it("offline read_only hides the restore section entirely", () => {
    const { useTrialValidation } = jest.requireMock(
      "@/features/trial/hooks",
    ) as { useTrialValidation: jest.Mock };
    useTrialValidation.mockReturnValueOnce({
      accessMode: "read_only",
      isValidating: false,
      refresh: jest.fn(),
    });
    renderWithClient(<ArchivedHabitDetailScreen />);
    expect(screen.queryByText("Restore habit")).toBeNull();
    expect(screen.queryByText("Unlock $1.99 to restore")).toBeNull();
  });

  it("free-tier also hides the Delete permanently card", () => {
    const { useTrialValidation } = jest.requireMock(
      "@/features/trial/hooks",
    ) as { useTrialValidation: jest.Mock };
    useTrialValidation.mockReturnValueOnce({
      accessMode: "expired_no_purchase",
      isValidating: false,
      refresh: jest.fn(),
    });
    renderWithClient(<ArchivedHabitDetailScreen />);
    expect(screen.queryByText("DELETE PERMANENTLY")).toBeNull();
  });
});
