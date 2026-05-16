import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { fireEvent, render, screen, waitFor } from "@testing-library/react-native";
import React from "react";

import LibraryScreen from "@/features/library/screens/LibraryScreen";

const mockUseLibraryHabits = jest.fn();
const mockReactivateMutate = jest.fn();
const mockReactivateState = {
  isPending: false,
  isError: false,
};
const mockPush = jest.fn();

jest.mock("@/features/library/hooks", () => ({
  useLibraryHabits: () => mockUseLibraryHabits(),
  useReactivateHabitMutation: () => ({
    mutate: (vars: unknown, opts?: { onSuccess?: () => void }) => {
      mockReactivateMutate(vars);
      opts?.onSuccess?.();
    },
    isPending: mockReactivateState.isPending,
    isError: mockReactivateState.isError,
  }),
}));

jest.mock("expo-router", () => ({
  router: { push: (...args: unknown[]) => mockPush(...args) },
}));

jest.mock("@/components/LucideIconPicker", () => ({
  LucideIcon: () => null,
  LucideIconPicker: () => null,
}));

function wrapper({ children }: { children: React.ReactNode }) {
  const client = new QueryClient({
    defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
  });
  return React.createElement(QueryClientProvider, { client }, children);
}

function makeLibraryHabit(overrides: Partial<{
  id: string;
  title: string;
  identityPhrase: string | null;
  graduationDate: string;
  lifetimeDays: number;
  preGraduationConsistency: number;
  latestAvg: number | null;
}> = {}) {
  return {
    id: overrides.id ?? "habit-1",
    title: overrides.title ?? "Daily run",
    icon: null,
    identityPhrase: overrides.identityPhrase ?? "a runner",
    graduationDate: overrides.graduationDate ?? "2026-05-10T12:00:00.000Z",
    lifetimeDays: overrides.lifetimeDays ?? 87,
    preGraduationConsistency: overrides.preGraduationConsistency ?? 0.87,
    latestSRHI:
      overrides.latestAvg === undefined
        ? {
            id: "srhi-1",
            habit_id: overrides.id ?? "habit-1",
            user_id: "user-1",
            q1_score: 5,
            q2_score: 4,
            q3_score: 5,
            average_score: 4.67,
            graduated: true,
            created_at: "2026-05-10T12:00:00.000Z",
          }
        : overrides.latestAvg === null
        ? null
        : {
            id: "srhi-1",
            habit_id: overrides.id ?? "habit-1",
            user_id: "user-1",
            q1_score: 4,
            q2_score: 4,
            q3_score: 4,
            average_score: overrides.latestAvg,
            graduated: true,
            created_at: "2026-05-10T12:00:00.000Z",
          },
  };
}

describe("LibraryScreen", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockReactivateState.isPending = false;
    mockReactivateState.isError = false;
  });

  it("renders the empty state when no graduated habits exist", () => {
    mockUseLibraryHabits.mockReturnValue({
      data: [],
      isLoading: false,
      error: null,
    });
    render(<LibraryScreen />, { wrapper });
    expect(
      screen.getByText(/Your library will grow as habits become part of who you are/),
    ).toBeTruthy();
  });

  it("renders graduated habits grouped by identity phrase", () => {
    mockUseLibraryHabits.mockReturnValue({
      data: [
        {
          identityPhrase: "a runner",
          habits: [makeLibraryHabit({ title: "Daily run", id: "h-1" })],
          goalGraduated: true,
        },
        {
          identityPhrase: "a reader",
          habits: [
            makeLibraryHabit({
              title: "Read at night",
              id: "h-2",
              identityPhrase: "a reader",
            }),
          ],
          goalGraduated: false,
        },
      ],
      isLoading: false,
      error: null,
    });
    render(<LibraryScreen />, { wrapper });

    expect(screen.getByText("Become a runner")).toBeTruthy();
    expect(screen.getByText("Become a reader")).toBeTruthy();
    expect(screen.getByText("Daily run")).toBeTruthy();
    expect(screen.getByText("Read at night")).toBeTruthy();
  });

  it("shows '(All graduated)' badge only when group.goalGraduated is true", () => {
    mockUseLibraryHabits.mockReturnValue({
      data: [
        {
          identityPhrase: "a runner",
          habits: [makeLibraryHabit({ id: "h-1" })],
          goalGraduated: true,
        },
        {
          identityPhrase: "a reader",
          habits: [makeLibraryHabit({ id: "h-2", identityPhrase: "a reader" })],
          goalGraduated: false,
        },
      ],
      isLoading: false,
      error: null,
    });
    render(<LibraryScreen />, { wrapper });

    expect(screen.getAllByText("(All graduated)")).toHaveLength(1);
  });

  it("renders the 'Other' header when identityPhrase is null", () => {
    mockUseLibraryHabits.mockReturnValue({
      data: [
        {
          identityPhrase: null,
          habits: [makeLibraryHabit({ id: "h-1", identityPhrase: null })],
          goalGraduated: false,
        },
      ],
      isLoading: false,
      error: null,
    });
    render(<LibraryScreen />, { wrapper });
    expect(screen.getByText("Other")).toBeTruthy();
  });

  it("renders lifetime days and consistency on each card", () => {
    mockUseLibraryHabits.mockReturnValue({
      data: [
        {
          identityPhrase: "a runner",
          habits: [
            makeLibraryHabit({
              id: "h-1",
              lifetimeDays: 90,
              preGraduationConsistency: 0.83,
            }),
          ],
          goalGraduated: false,
        },
      ],
      isLoading: false,
      error: null,
    });
    render(<LibraryScreen />, { wrapper });

    expect(screen.getByText("90 days to form")).toBeTruthy();
    expect(screen.getByText("83% consistency")).toBeTruthy();
  });

  it("'Bring back to Today' shows the inline confirmation; 'Reactivate' fires the mutation", async () => {
    mockUseLibraryHabits.mockReturnValue({
      data: [
        {
          identityPhrase: "a runner",
          habits: [makeLibraryHabit({ id: "h-1" })],
          goalGraduated: false,
        },
      ],
      isLoading: false,
      error: null,
    });
    render(<LibraryScreen />, { wrapper });

    fireEvent.press(screen.getByText("Bring back to Today"));

    expect(
      screen.getByText("This will add the habit back to your daily tracking."),
    ).toBeTruthy();
    expect(screen.getByText("Cancel")).toBeTruthy();

    fireEvent.press(screen.getByText("Reactivate"));

    await waitFor(() => {
      expect(mockReactivateMutate).toHaveBeenCalledWith({ habitId: "h-1" });
    });
  });

  it("'Cancel' hides the confirmation without calling reactivate", () => {
    mockUseLibraryHabits.mockReturnValue({
      data: [
        {
          identityPhrase: "a runner",
          habits: [makeLibraryHabit({ id: "h-1" })],
          goalGraduated: false,
        },
      ],
      isLoading: false,
      error: null,
    });
    render(<LibraryScreen />, { wrapper });

    fireEvent.press(screen.getByText("Bring back to Today"));
    fireEvent.press(screen.getByText("Cancel"));

    expect(mockReactivateMutate).not.toHaveBeenCalled();
    expect(screen.getByText("Bring back to Today")).toBeTruthy();
  });
});
