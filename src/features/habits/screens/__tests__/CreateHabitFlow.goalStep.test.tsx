import { act, cleanup, fireEvent, render, screen } from "@testing-library/react-native";
import React from "react";

const mockMutateAsync = jest.fn();
const mockUseCreateHabitMutation = jest.fn();
const mockAssertCanCreateActiveHabit = jest.fn();
const mockRouterReplace = jest.fn();
const mockListEligibleHabitsForToday = jest.fn();

jest.mock("expo-router", () => ({
  router: {
    replace: (...args: unknown[]) => mockRouterReplace(...args),
    back: jest.fn(),
  },
  useLocalSearchParams: () => ({}),
}));

jest.mock("@/features/auth/hooks", () => ({
  useAuthSession: () => ({ user: { id: "user-1" } }),
}));

jest.mock("@/features/habits/hooks", () => {
  const actual = jest.requireActual("@/features/habits/hooks");
  return {
    ...actual,
    useCreateHabitMutation: () => mockUseCreateHabitMutation(),
  };
});

jest.mock("@/features/habits/validators", () => ({
  assertCanCreateActiveHabit: (...args: unknown[]) =>
    mockAssertCanCreateActiveHabit(...args),
}));

jest.mock("@/features/reminders/notifications", () => ({
  scheduleReminder: jest.fn(),
  persistReminderIntent: jest.fn(),
}));

jest.mock("@/features/habits/api", () => {
  const actual = jest.requireActual("@/features/habits/api");
  return {
    ...actual,
    listEligibleHabitsForToday: (...args: unknown[]) =>
      mockListEligibleHabitsForToday(...args),
  };
});

jest.mock("@/components/LucideIconPicker", () => ({
  LucideIcon: () => null,
  LucideIconPicker: () => null,
}));

import CreateHabitFlow from "@/features/habits/screens/CreateHabitFlow";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";

let queryClient: QueryClient;

function wrapper({ children }: { children: React.ReactNode }) {
  return React.createElement(QueryClientProvider, { client: queryClient }, children);
}

describe("CreateHabitFlow — goal step gating", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    queryClient = new QueryClient({
      defaultOptions: {
        queries: { retry: false, gcTime: 0 },
        mutations: { retry: false },
      },
    });
    mockAssertCanCreateActiveHabit.mockResolvedValue({ ok: true });
    mockUseCreateHabitMutation.mockReturnValue({
      mutateAsync: mockMutateAsync,
      isPending: false,
    });
    mockListEligibleHabitsForToday.mockResolvedValue([]);
  });

  afterEach(() => {
    cleanup();
    queryClient.clear();
  });

  it("stays on the goal step when the phrase cleans to fewer than 2 chars", async () => {
    render(<CreateHabitFlow />, { wrapper });

    expect(
      screen.getByText("What kind of person do you want to become?"),
    ).toBeTruthy();

    await act(async () => {
      fireEvent.changeText(
        screen.getByPlaceholderText(/a calmer person/),
        "become a",
      );
    });
    await act(async () => {
      fireEvent.press(screen.getByText("Continue"));
    });

    // Gate blocks: still on the goal step, action step not reached.
    expect(
      screen.getByText("What kind of person do you want to become?"),
    ).toBeTruthy();
    expect(screen.queryByPlaceholderText(/Goes for a walk/)).toBeNull();
  });

  it("advances to the action step when the phrase is valid", async () => {
    render(<CreateHabitFlow />, { wrapper });

    await act(async () => {
      fireEvent.changeText(
        screen.getByPlaceholderText(/a calmer person/),
        "healthy",
      );
    });
    await act(async () => {
      fireEvent.press(screen.getByText("Continue"));
    });

    expect(await screen.findByPlaceholderText(/Goes for a walk/)).toBeTruthy();
  });
});
