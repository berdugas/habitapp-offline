import { fireEvent, render, screen, waitFor } from "@testing-library/react-native";
import React from "react";

import BacklogScreen from "@/features/habits/screens/BacklogScreen";

const mockUseBacklogHabitsQuery = jest.fn();
const mockUseInactiveHabitsQuery = jest.fn();
const mockActivateMutate = jest.fn();
const mockDeleteMutate = jest.fn();
const mockAssertCanCreateActiveHabit = jest.fn();
const mockUseAuthSession = jest.fn();
const mockUseQuery = jest.fn();

const mockActivateState = { isPending: false, isError: false };
const mockDeleteState = { isPending: false, isError: false };

jest.mock("@/features/habits/hooks", () => ({
  useBacklogHabitsQuery: () => mockUseBacklogHabitsQuery(),
  useInactiveHabitsQuery: () => mockUseInactiveHabitsQuery(),
  useActivateBacklogHabitMutation: () => ({
    mutate: (vars: unknown) => mockActivateMutate(vars),
    isPending: mockActivateState.isPending,
    isError: mockActivateState.isError,
  }),
  useDeleteHabitMutation: () => ({
    mutate: (vars: unknown) => mockDeleteMutate(vars),
    isPending: mockDeleteState.isPending,
    isError: mockDeleteState.isError,
  }),
}));

jest.mock("@/features/habits/validators", () => ({
  assertCanCreateActiveHabit: (...args: unknown[]) =>
    mockAssertCanCreateActiveHabit(...args),
}));

jest.mock("@/features/auth/hooks", () => ({
  useAuthSession: () => mockUseAuthSession(),
}));

jest.mock("@tanstack/react-query", () => {
  const actual = jest.requireActual("@tanstack/react-query");
  return {
    ...actual,
    useQuery: (opts: unknown) => mockUseQuery(opts),
  };
});

jest.mock("expo-router", () => ({
  router: { back: jest.fn(), push: jest.fn() },
}));

jest.mock("@/components/LucideIconPicker", () => ({
  LucideIcon: () => null,
  LucideIconPicker: () => null,
}));

function makeBacklogHabit(overrides: Partial<{
  id: string;
  title: string;
  identity_phrase: string | null;
}> = {}) {
  return {
    id: overrides.id ?? "habit-1",
    user_id: "user-1",
    title: overrides.title ?? "Read at night",
    identity_phrase: "identity_phrase" in overrides ? overrides.identity_phrase! : "a reader",
    cue: "after dinner",
    tiny_action: "read 1 page",
    minimum_viable_action: null,
    preferred_time_window: null,
    icon: null,
    habit_state: "active",
    status: "backlog",
    active_days: "[1,2,3,4,5,6,7]",
    start_date: "2026-05-10",
    created_at: "2026-05-10T12:00:00.000Z",
    updated_at: "2026-05-10T12:00:00.000Z",
    archived_at: null,
    automated_at: null,
    backlog_at: "2026-05-10T12:00:00.000Z",
  };
}

function makeArchivedHabit(overrides: Partial<{ id: string; title: string }> = {}) {
  return {
    ...makeBacklogHabit(overrides),
    id: overrides.id ?? "arch-1",
    title: overrides.title ?? "Old habit",
    status: "archived",
    archived_at: "2026-03-01T12:00:00.000Z",
    backlog_at: null,
  };
}

describe("BacklogScreen", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockActivateState.isPending = false;
    mockActivateState.isError = false;
    mockDeleteState.isPending = false;
    mockDeleteState.isError = false;
    mockUseAuthSession.mockReturnValue({ user: { id: "user-1" } });
    mockUseQuery.mockReturnValue({ data: [], isSuccess: true });
  });

  it("renders the empty state when both lists are empty", () => {
    mockUseBacklogHabitsQuery.mockReturnValue({ data: [], isLoading: false, error: null });
    mockUseInactiveHabitsQuery.mockReturnValue({ data: [], isLoading: false, error: null });
    render(<BacklogScreen />);

    expect(screen.getByText("No habit ideas yet")).toBeTruthy();
  });

  it("renders backlog habits with title, identity phrase, formula, saved date", () => {
    mockUseBacklogHabitsQuery.mockReturnValue({
      data: [makeBacklogHabit()],
      isLoading: false,
      error: null,
    });
    mockUseInactiveHabitsQuery.mockReturnValue({ data: [], isLoading: false, error: null });
    render(<BacklogScreen />);

    expect(screen.getByText("Read at night")).toBeTruthy();
    expect(screen.getByText("For: Become a reader")).toBeTruthy();
    expect(screen.getByText(/after dinner.*read 1 page/i)).toBeTruthy();
    expect(screen.getByText(/Saved/)).toBeTruthy();
  });

  it("tapping Activate (cap-clear) fires the mutation and habit disappears", async () => {
    mockAssertCanCreateActiveHabit.mockResolvedValue({ ok: true });
    mockUseBacklogHabitsQuery.mockReturnValue({
      data: [makeBacklogHabit()],
      isLoading: false,
      error: null,
    });
    mockUseInactiveHabitsQuery.mockReturnValue({ data: [], isLoading: false, error: null });
    render(<BacklogScreen />);

    fireEvent.press(screen.getByText("Activate"));

    await waitFor(() => {
      expect(mockActivateMutate).toHaveBeenCalledWith({ habitId: "habit-1" });
    });
  });

  it("tapping Activate when at the soft cap shows the warning and does not yet activate", async () => {
    mockAssertCanCreateActiveHabit.mockResolvedValue({
      ok: false,
      reason: "soft_cap_warning",
      count: 3,
    });
    mockUseBacklogHabitsQuery.mockReturnValue({
      data: [makeBacklogHabit()],
      isLoading: false,
      error: null,
    });
    mockUseInactiveHabitsQuery.mockReturnValue({ data: [], isLoading: false, error: null });
    render(<BacklogScreen />);

    fireEvent.press(screen.getByText("Activate"));

    await waitFor(() => {
      expect(screen.getByText(/You have 3 active habits for this goal/)).toBeTruthy();
    });
    expect(mockActivateMutate).not.toHaveBeenCalled();

    // Second tap (already warned) proceeds.
    fireEvent.press(screen.getByText("Activate anyway"));
    await waitFor(() => {
      expect(mockActivateMutate).toHaveBeenCalledWith({ habitId: "habit-1" });
    });
  });

  it("goalless backlog habit (identity_phrase=null) activates without invoking the cap helper", async () => {
    mockUseBacklogHabitsQuery.mockReturnValue({
      data: [makeBacklogHabit({ identity_phrase: null })],
      isLoading: false,
      error: null,
    });
    mockUseInactiveHabitsQuery.mockReturnValue({ data: [], isLoading: false, error: null });
    render(<BacklogScreen />);

    fireEvent.press(screen.getByText("Activate"));

    await waitFor(() => {
      expect(mockActivateMutate).toHaveBeenCalledWith({ habitId: "habit-1" });
    });
    expect(mockAssertCanCreateActiveHabit).not.toHaveBeenCalled();
  });

  it("Delete shows inline confirmation; Cancel dismisses; Delete fires mutation", async () => {
    mockUseBacklogHabitsQuery.mockReturnValue({
      data: [makeBacklogHabit()],
      isLoading: false,
      error: null,
    });
    mockUseInactiveHabitsQuery.mockReturnValue({ data: [], isLoading: false, error: null });
    render(<BacklogScreen />);

    fireEvent.press(screen.getByText("Delete"));

    expect(
      screen.getByText("This will permanently remove this habit idea. This can't be undone."),
    ).toBeTruthy();

    // Cancel returns to the action row.
    fireEvent.press(screen.getByText("Cancel"));
    expect(mockDeleteMutate).not.toHaveBeenCalled();

    // Open again and confirm.
    fireEvent.press(screen.getByText("Delete"));
    // After confirmation, there are now two "Delete" texts: one in confirmRow.
    // Use getAllByText and press the last (confirmation button).
    const deleteButtons = screen.getAllByText("Delete");
    fireEvent.press(deleteButtons[deleteButtons.length - 1]!);

    await waitFor(() => {
      expect(mockDeleteMutate).toHaveBeenCalledWith({ habitId: "habit-1" });
    });
  });

  it("renders an Archived section below the backlog section when archived habits exist", () => {
    mockUseBacklogHabitsQuery.mockReturnValue({
      data: [makeBacklogHabit()],
      isLoading: false,
      error: null,
    });
    mockUseInactiveHabitsQuery.mockReturnValue({
      data: [makeArchivedHabit()],
      isLoading: false,
      error: null,
    });
    render(<BacklogScreen />);

    expect(screen.getByText("ARCHIVED")).toBeTruthy();
    expect(screen.getByText("Old habit")).toBeTruthy();
  });

  it("does not render the Archived section when no archived habits exist", () => {
    mockUseBacklogHabitsQuery.mockReturnValue({
      data: [makeBacklogHabit()],
      isLoading: false,
      error: null,
    });
    mockUseInactiveHabitsQuery.mockReturnValue({ data: [], isLoading: false, error: null });
    render(<BacklogScreen />);
    expect(screen.queryByText("ARCHIVED")).toBeNull();
  });

  it("renders archived cards WITHOUT the ARCHIVED eyebrow when there are no backlog habits above", () => {
    // Per S18-04 spec: the eyebrow is a divider between sections. If there's
    // nothing above it, the eyebrow is meaningless and must be omitted.
    mockUseBacklogHabitsQuery.mockReturnValue({ data: [], isLoading: false, error: null });
    mockUseInactiveHabitsQuery.mockReturnValue({
      data: [makeArchivedHabit()],
      isLoading: false,
      error: null,
    });
    render(<BacklogScreen />);

    expect(screen.queryByText("ARCHIVED")).toBeNull();
    expect(screen.getByText("Old habit")).toBeTruthy();
    // Empty state must NOT also render — archived habits count as content.
    expect(screen.queryByText("No habit ideas yet")).toBeNull();
  });
});
