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

import { render, waitFor } from "@testing-library/react-native";
import React from "react";

import EditHabitScreen from "@/features/habits/screens/EditHabitScreen";

jest.mock("expo-router", () => ({
  router: { push: jest.fn(), replace: jest.fn() },
  useLocalSearchParams: jest.fn(),
}));

jest.mock("@/features/habits/hooks", () => ({
  useOwnedHabitQuery: jest.fn(),
  useUpdateHabitMutation: jest.fn(),
}));

jest.mock("@/features/recommendations/hooks", () => ({
  useGenerateHabitRewriteMutation: jest.fn(),
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
