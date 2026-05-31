import { cleanup } from "@testing-library/react-native";
import { act, fireEvent, render, screen, waitFor } from "@/tests/setup/render";
import React from "react";

const mockMutateAsync = jest.fn();
const mockUseCreateHabitMutation = jest.fn();
const mockAssertCanCreateActiveHabit = jest.fn();
const mockScheduleReminder = jest.fn();
const mockPersistReminderIntent = jest.fn();
const mockRouterReplace = jest.fn();
const mockListEligibleHabitsForToday = jest.fn();

jest.mock("expo-router", () => ({
  router: {
    replace: (...args: unknown[]) => mockRouterReplace(...args),
    back: jest.fn(),
  },
  useLocalSearchParams: () => ({ goalIdentityPhrase: "a runner" }),
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
  scheduleReminder: (...args: unknown[]) => mockScheduleReminder(...args),
  persistReminderIntent: (...args: unknown[]) =>
    mockPersistReminderIntent(...args),
}));

// Preserve the rest of the api module — the hooks module under test imports
// many other exports (listArchivedHabits, listBacklogHabits, archiveHabit, etc.)
// and replacing only listEligibleHabitsForToday would leave those undefined.
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


async function walkToWorstday(options: { withReminder?: boolean } = {}) {
  // Starts at "action" step because goalIdentityPhrase was injected.
  await act(async () => {
    fireEvent.changeText(screen.getByPlaceholderText(/Goes for a walk/), "Run");
  });
  await act(async () => {
    fireEvent.press(screen.getByText("Continue"));
  });

  // Build step: tinyAction + cue, optional reminder toggle.
  await screen.findByPlaceholderText(/Make it even smaller/);
  await act(async () => {
    fireEvent.changeText(
      screen.getByPlaceholderText(/Make it even smaller/),
      "run for 2 minutes",
    );
  });
  await act(async () => {
    fireEvent.changeText(
      screen.getByPlaceholderText(/brush my teeth/),
      "morning coffee",
    );
  });

  if (options.withReminder) {
    // Flip the ReminderPicker's Switch on. It accepts onValueChange with the
    // new boolean; turning it on sets draft.reminderTime to "07:00".
    await act(async () => {
      const sw = screen.UNSAFE_getByType(
        // eslint-disable-next-line @typescript-eslint/no-require-imports
        require("react-native").Switch,
      );
      fireEvent(sw, "valueChange", true);
    });
  }

  await act(async () => {
    fireEvent.press(screen.getByText("Continue"));
  });

  // Personalize phase: habit name → "Looks good".
  await screen.findByPlaceholderText("Tap to name");
  await act(async () => {
    fireEvent.changeText(
      screen.getByPlaceholderText("Tap to name"),
      "Morning run",
    );
  });
  await act(async () => {
    fireEvent.press(screen.getByText("Looks good"));
  });

  // Wait until the worstday phase content appears.
  await screen.findByText(/One last check/);
}

describe("CreateHabitFlow — save-for-later path", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    queryClient = new QueryClient({
      defaultOptions: {
        queries: { retry: false, gcTime: 0 },
        mutations: { retry: false },
      },
    });
    mockMutateAsync.mockResolvedValue({ id: "new-habit-id" });
    mockUseCreateHabitMutation.mockReturnValue({
      mutateAsync: mockMutateAsync,
      isPending: false,
    });
    mockListEligibleHabitsForToday.mockResolvedValue([]);
    mockScheduleReminder.mockResolvedValue(undefined);
    mockPersistReminderIntent.mockResolvedValue(undefined);
  });

  afterEach(() => {
    cleanup();
    queryClient.clear();
  });

  it("shows the three-action footer when soft cap is active", async () => {
    mockAssertCanCreateActiveHabit.mockResolvedValue({
      ok: false,
      reason: "soft_cap_warning",
      count: 3,
    });

    render(<QueryClientProvider client={queryClient}><CreateHabitFlow /></QueryClientProvider>);
    await walkToWorstday();

    expect(await screen.findByText("Add to Today")).toBeTruthy();
    expect(screen.getByText("Save for later")).toBeTruthy();
    expect(screen.getByText("Let me make it smaller")).toBeTruthy();
    expect(screen.queryByText("Yes, I could")).toBeNull();
  });

  it("shows the original two-action footer when cap is clear (regression guard)", async () => {
    mockAssertCanCreateActiveHabit.mockResolvedValue({ ok: true });

    render(<QueryClientProvider client={queryClient}><CreateHabitFlow /></QueryClientProvider>);
    await walkToWorstday();

    expect(await screen.findByText("Yes, I could")).toBeTruthy();
    expect(screen.getByText("Let me make it smaller")).toBeTruthy();
    expect(screen.queryByText("Save for later")).toBeNull();
    expect(screen.queryByText("Add to Today")).toBeNull();
  });

  it("Save for later calls the mutation with status='backlog' and routes to backlog", async () => {
    mockAssertCanCreateActiveHabit.mockResolvedValue({
      ok: false,
      reason: "soft_cap_warning",
      count: 3,
    });

    render(<QueryClientProvider client={queryClient}><CreateHabitFlow /></QueryClientProvider>);
    await walkToWorstday();
    await screen.findByText("Save for later");

    await act(async () => {
      fireEvent.press(screen.getByText("Save for later"));
    });

    await waitFor(() => {
      expect(mockMutateAsync).toHaveBeenCalledTimes(1);
    });
    expect(mockMutateAsync).toHaveBeenCalledWith(
      expect.objectContaining({ status: "backlog" }),
    );

    await waitFor(() => {
      expect(mockRouterReplace).toHaveBeenCalledWith("/(app)/habits/backlog");
    });
  });

  it("Add to Today calls the mutation with status='active' and routes to today", async () => {
    mockAssertCanCreateActiveHabit.mockResolvedValue({
      ok: false,
      reason: "soft_cap_warning",
      count: 3,
    });

    render(<QueryClientProvider client={queryClient}><CreateHabitFlow /></QueryClientProvider>);
    await walkToWorstday();
    await screen.findByText("Add to Today");

    await act(async () => {
      fireEvent.press(screen.getByText("Add to Today"));
    });

    await waitFor(() => {
      expect(mockMutateAsync).toHaveBeenCalledTimes(1);
    });
    expect(mockMutateAsync).toHaveBeenCalledWith(
      expect.objectContaining({ status: "active" }),
    );

    await waitFor(() => {
      expect(mockRouterReplace).toHaveBeenCalledWith("/(app)/(tabs)/today");
    });
  });

  it("auto-fills the tiny-action field with the daily action on arrival at BuildStep", async () => {
    mockAssertCanCreateActiveHabit.mockResolvedValue({ ok: true });

    render(<QueryClientProvider client={queryClient}><CreateHabitFlow /></QueryClientProvider>);

    // ActionStep
    await act(async () => {
      fireEvent.changeText(
        screen.getByPlaceholderText(/Goes for a walk/),
        "Walk to the mailbox",
      );
    });
    await act(async () => {
      fireEvent.press(screen.getByText("Continue"));
    });

    // BuildStep: the tiny input should already hold the daily action.
    const tinyInput = await screen.findByPlaceholderText(/Make it even smaller/);
    expect(tinyInput.props.value).toBe("Walk to the mailbox");
  });

  it("does not clobber a typed tiny version when the user goes back and edits the daily action", async () => {
    mockAssertCanCreateActiveHabit.mockResolvedValue({ ok: true });

    render(<QueryClientProvider client={queryClient}><CreateHabitFlow /></QueryClientProvider>);

    // ActionStep — type the daily action.
    await act(async () => {
      fireEvent.changeText(
        screen.getByPlaceholderText(/Goes for a walk/),
        "Walk to the mailbox",
      );
    });
    await act(async () => {
      fireEvent.press(screen.getByText("Continue"));
    });

    // BuildStep — user shrinks the tiny version themselves.
    await act(async () => {
      fireEvent.changeText(
        await screen.findByPlaceholderText(/Make it even smaller/),
        "Stand at the door",
      );
    });

    // Press back (BackRow has accessibilityLabel="Go back") → ActionStep.
    await act(async () => {
      fireEvent.press(screen.getByLabelText("Go back"));
    });

    // Edit the daily action.
    await act(async () => {
      fireEvent.changeText(
        await screen.findByPlaceholderText(/Goes for a walk/),
        "Run a mile",
      );
    });

    // Advance back to BuildStep.
    await act(async () => {
      fireEvent.press(screen.getByText("Continue"));
    });

    // Tiny field must still hold the user-typed value — the mirror should have
    // been disabled by the earlier tinyAction edit.
    const tinyInputAgain = await screen.findByPlaceholderText(
      /Make it even smaller/,
    );
    expect(tinyInputAgain.props.value).toBe("Stand at the door");
  });

  describe("reminder branching at save time", () => {
    it("active save WITH reminderTime calls scheduleReminder (not persistReminderIntent)", async () => {
      mockAssertCanCreateActiveHabit.mockResolvedValue({ ok: true });

      render(<QueryClientProvider client={queryClient}><CreateHabitFlow /></QueryClientProvider>);
      await walkToWorstday({ withReminder: true });

      await act(async () => {
        fireEvent.press(screen.getByText("Yes, I could"));
      });

      await waitFor(() => {
        expect(mockScheduleReminder).toHaveBeenCalledTimes(1);
      });
      expect(mockScheduleReminder).toHaveBeenCalledWith(
        "new-habit-id",
        "user-1",
        "daily",
        "07:00",
        expect.any(Array),
      );
      expect(mockPersistReminderIntent).not.toHaveBeenCalled();
    });

    it("backlog save WITH reminderTime calls persistReminderIntent (not scheduleReminder)", async () => {
      mockAssertCanCreateActiveHabit.mockResolvedValue({
        ok: false,
        reason: "soft_cap_warning",
        count: 3,
      });

      render(<QueryClientProvider client={queryClient}><CreateHabitFlow /></QueryClientProvider>);
      await walkToWorstday({ withReminder: true });

      await act(async () => {
        fireEvent.press(screen.getByText("Save for later"));
      });

      await waitFor(() => {
        expect(mockPersistReminderIntent).toHaveBeenCalledTimes(1);
      });
      expect(mockPersistReminderIntent).toHaveBeenCalledWith("new-habit-id", "07:00");
      expect(mockScheduleReminder).not.toHaveBeenCalled();
    });

    it("active save WITHOUT reminderTime invokes neither helper (regression guard)", async () => {
      mockAssertCanCreateActiveHabit.mockResolvedValue({ ok: true });

      render(<QueryClientProvider client={queryClient}><CreateHabitFlow /></QueryClientProvider>);
      await walkToWorstday();

      await act(async () => {
        fireEvent.press(screen.getByText("Yes, I could"));
      });

      await waitFor(() => {
        expect(mockMutateAsync).toHaveBeenCalled();
      });
      expect(mockPersistReminderIntent).not.toHaveBeenCalled();
      expect(mockScheduleReminder).not.toHaveBeenCalled();
    });

    it("backlog save WITHOUT reminderTime invokes neither helper (regression guard)", async () => {
      mockAssertCanCreateActiveHabit.mockResolvedValue({
        ok: false,
        reason: "soft_cap_warning",
        count: 3,
      });

      render(<QueryClientProvider client={queryClient}><CreateHabitFlow /></QueryClientProvider>);
      await walkToWorstday();

      await act(async () => {
        fireEvent.press(screen.getByText("Save for later"));
      });

      await waitFor(() => {
        expect(mockMutateAsync).toHaveBeenCalled();
      });
      expect(mockScheduleReminder).not.toHaveBeenCalled();
      expect(mockPersistReminderIntent).not.toHaveBeenCalled();
    });
  });
});
