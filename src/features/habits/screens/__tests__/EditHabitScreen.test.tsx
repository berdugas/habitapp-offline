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

import { fireEvent, render, screen, waitFor } from "@testing-library/react-native";
import React from "react";

import EditHabitScreen from "@/features/habits/screens/EditHabitScreen";

jest.mock("expo-router", () => ({
  router: {
    push: jest.fn(),
    replace: jest.fn(),
    back: jest.fn(),
    canGoBack: jest.fn(() => true),
  },
  useLocalSearchParams: jest.fn(),
}));

jest.mock("@/features/reminders/notifications", () => ({
  scheduleReminder: jest.fn().mockResolvedValue(undefined),
  cancelReminder: jest.fn().mockResolvedValue(undefined),
  rescheduleAll: jest.fn().mockResolvedValue(undefined),
}));

jest.mock("@/lib/db/repositories/reminders", () => ({
  getReminderByHabitId: jest.fn().mockRejectedValue(new Error("no reminder")),
}));

jest.mock("@/features/habits/hooks", () => ({
  useOwnedHabitQuery: jest.fn(),
  useUpdateHabitMutation: jest.fn(),
}));

jest.mock("@/features/recommendations/hooks", () => ({
  useGenerateHabitRewriteMutation: jest.fn(),
}));

jest.mock("@/features/auth/hooks", () => ({
  useAuthSession: jest.fn(() => ({ user: { id: "user-1" } })),
}));

const { useLocalSearchParams } = jest.requireMock("expo-router") as {
  useLocalSearchParams: jest.Mock;
};

const { useOwnedHabitQuery, useUpdateHabitMutation } = jest.requireMock(
  "@/features/habits/hooks",
) as {
  useOwnedHabitQuery: jest.Mock;
  useUpdateHabitMutation: jest.Mock;
};

const { useGenerateHabitRewriteMutation } = jest.requireMock(
  "@/features/recommendations/hooks",
) as {
  useGenerateHabitRewriteMutation: jest.Mock;
};

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

describe("EditHabitScreen — recovery focus path", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    jest.useFakeTimers();
    useUpdateHabitMutation.mockReturnValue({
      mutateAsync: jest.fn().mockResolvedValue(undefined),
      isPending: false,
      error: null,
    });
    useGenerateHabitRewriteMutation.mockReturnValue({
      mutateAsync: jest.fn().mockResolvedValue(undefined),
      isPending: false,
      error: null,
    });
    useOwnedHabitQuery.mockReturnValue({
      data: baseHabit,
      isLoading: false,
      error: null,
    });
  });

  afterEach(() => {
    jest.useRealTimers();
  });

  it("focuses the tiny_action TextInput when navigated with from=recovery", async () => {
    useLocalSearchParams.mockReturnValue({
      habitId: "habit-1",
      from: "recovery",
    });

    const focusSpy = jest.spyOn(
      // eslint-disable-next-line @typescript-eslint/no-var-requires
      require("react-native").TextInput.prototype,
      "focus",
    );

    render(<EditHabitScreen />);

    // The screen schedules focus via setTimeout(0) after hydrating the form.
    jest.runAllTimers();

    await waitFor(() => {
      expect(focusSpy).toHaveBeenCalled();
    });

    focusSpy.mockRestore();
  });

  it("does not focus the tiny_action TextInput when navigated without from=recovery", async () => {
    useLocalSearchParams.mockReturnValue({ habitId: "habit-1" });

    const focusSpy = jest.spyOn(
      // eslint-disable-next-line @typescript-eslint/no-var-requires
      require("react-native").TextInput.prototype,
      "focus",
    );

    render(<EditHabitScreen />);
    jest.runAllTimers();

    // No focus call expected — the recovery guard is the gate.
    expect(focusSpy).not.toHaveBeenCalled();

    focusSpy.mockRestore();
  });
});

// Regression: previously handleSave called router.replace(`/(app)/habits/${id}`)
// unconditionally. When the user reached Edit via HabitDetail → push Edit,
// that replace swapped the EditHabit entry with another HabitDetail entry,
// leaving two adjacent identical HabitDetail entries in the stack. The user
// had to tap the back chevron twice to leave Habit Detail because the first
// tap popped to the duplicate (visually-identical) entry. The fix is to
// prefer router.back() to pop the EditHabit entry, falling back to replace
// only when canGoBack() is false (deep-link entry).
describe("EditHabitScreen — post-save navigation (back-stack hygiene)", () => {
  const { router } = jest.requireMock("expo-router") as {
    router: {
      push: jest.Mock;
      replace: jest.Mock;
      back: jest.Mock;
      canGoBack: jest.Mock;
    };
  };
  let updateMutateAsync: jest.Mock;

  beforeEach(() => {
    jest.clearAllMocks();
    jest.useRealTimers();
    router.canGoBack.mockReturnValue(true);
    updateMutateAsync = jest.fn().mockResolvedValue(undefined);
    useUpdateHabitMutation.mockReturnValue({
      mutateAsync: updateMutateAsync,
      isPending: false,
      error: null,
    });
    useGenerateHabitRewriteMutation.mockReturnValue({
      mutateAsync: jest.fn().mockResolvedValue(undefined),
      isPending: false,
      error: null,
    });
    useOwnedHabitQuery.mockReturnValue({
      data: baseHabit,
      isLoading: false,
      error: null,
    });
    useLocalSearchParams.mockReturnValue({ habitId: "habit-1" });
  });

  it("calls router.back() on successful save when the stack has a previous entry (no duplicate stack push)", async () => {
    render(<EditHabitScreen />);
    fireEvent.press(screen.getByText("Save changes"));

    await waitFor(() => {
      expect(updateMutateAsync).toHaveBeenCalled();
    });
    await waitFor(() => {
      expect(router.back).toHaveBeenCalledTimes(1);
    });
    // Critical: replace must NOT fire in the canGoBack=true path — that's
    // what caused the duplicate-adjacent-stack-entry bug.
    expect(router.replace).not.toHaveBeenCalled();
  });

  it("falls back to router.replace(habit detail) when canGoBack is false (deep-link entry)", async () => {
    router.canGoBack.mockReturnValue(false);
    render(<EditHabitScreen />);
    fireEvent.press(screen.getByText("Save changes"));

    await waitFor(() => {
      expect(updateMutateAsync).toHaveBeenCalled();
    });
    await waitFor(() => {
      expect(router.replace).toHaveBeenCalledWith("/(app)/habits/habit-1");
    });
    expect(router.back).not.toHaveBeenCalled();
  });
});
