import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { renderHook, waitFor } from "@testing-library/react-native";
import React from "react";

import { RetroLogError } from "@/features/habits/api";
import { useUpsertHabitLogMutation } from "@/features/habits/hooks";
import { closeDb, initDb } from "@/lib/db/client";
import { createHabit, listHabits } from "@/lib/db/repositories/habits";
import { listLogs } from "@/lib/db/repositories/habit_logs";
import { resetClockForTesting, setNowForTesting } from "@/utils/clock";

jest.mock("@/features/auth/hooks", () => ({
  useAuthSession: () => ({ user: { id: "user-1" } }),
}));

function wrapper({ children }: { children: React.ReactNode }) {
  const client = new QueryClient({
    defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
  });
  return React.createElement(QueryClientProvider, { client }, children);
}

async function seedActiveHabit(startDate: string) {
  return createHabit({
    user_id: "user-1",
    title: "Run",
    identity_phrase: "a runner",
    cue: "morning coffee",
    tiny_action: "run for 2 minutes",
    minimum_viable_action: null,
    preferred_time_window: null,
    start_date: startDate,
    habit_state: "focus",
    status: "active",
  });
}

describe("useUpsertHabitLogMutation — 48-hour retro window", () => {
  beforeEach(async () => {
    await initDb();
  });

  afterEach(async () => {
    await closeDb();
    resetClockForTesting();
  });

  it("succeeds for a 36-hour-old day (within window)", async () => {
    setNowForTesting(new Date("2026-04-30T22:00:00.000Z"));
    await seedActiveHabit("2026-04-01");
    const habits = await listHabits({ user_id: "user-1" });
    const habit = habits[0]!;

    const { result } = renderHook(() => useUpsertHabitLogMutation(), { wrapper });

    await result.current.mutateAsync({
      habitId: habit.id,
      logDate: "2026-04-29",
      status: "done",
    });

    const logs = await listLogs({ habit_id: habit.id });
    expect(logs).toHaveLength(1);
    expect(logs[0]!.status).toBe("done");
    expect(logs[0]!.log_date).toBe("2026-04-29");
  });

  it("rejects a 60-hour-old day with RetroLogError(outside_window)", async () => {
    setNowForTesting(new Date("2026-04-30T22:00:00.000Z"));
    await seedActiveHabit("2026-04-01");
    const habits = await listHabits({ user_id: "user-1" });
    const habit = habits[0]!;

    const { result } = renderHook(() => useUpsertHabitLogMutation(), { wrapper });

    await expect(
      result.current.mutateAsync({
        habitId: habit.id,
        logDate: "2026-04-27",
        status: "done",
      }),
    ).rejects.toBeInstanceOf(RetroLogError);

    const logs = await listLogs({ habit_id: habit.id });
    expect(logs).toHaveLength(0);
  });

  it("rejects a date before habit.start_date with RetroLogError(before_start_date)", async () => {
    setNowForTesting(new Date("2026-04-30T10:00:00.000Z"));
    await seedActiveHabit("2026-04-29");
    const habits = await listHabits({ user_id: "user-1" });
    const habit = habits[0]!;

    const { result } = renderHook(() => useUpsertHabitLogMutation(), { wrapper });

    await expect(
      result.current.mutateAsync({
        habitId: habit.id,
        logDate: "2026-04-28",
        status: "done",
      }),
    ).rejects.toMatchObject({ reason: "before_start_date" });
  });

  it("succeeds at the 48-hour boundary minus one second", async () => {
    // logDate = April 28, now = April 30 23:59:58 local.
    // endOfLogDay = April 28 23:59:59.999, +48h = April 30 23:59:59.999.
    // now is one second before that — should succeed.
    setNowForTesting(new Date("2026-04-30T23:59:58.000"));
    await seedActiveHabit("2026-04-01");
    const habits = await listHabits({ user_id: "user-1" });
    const habit = habits[0]!;

    const { result } = renderHook(() => useUpsertHabitLogMutation(), { wrapper });

    await result.current.mutateAsync({
      habitId: habit.id,
      logDate: "2026-04-28",
      status: "done",
    });

    const logs = await listLogs({ habit_id: habit.id });
    expect(logs).toHaveLength(1);
  });

  it("rejects at the 48-hour boundary plus one second", async () => {
    setNowForTesting(new Date("2026-05-01T00:00:01.000"));
    await seedActiveHabit("2026-04-01");
    const habits = await listHabits({ user_id: "user-1" });
    const habit = habits[0]!;

    const { result } = renderHook(() => useUpsertHabitLogMutation(), { wrapper });

    await expect(
      result.current.mutateAsync({
        habitId: habit.id,
        logDate: "2026-04-28",
        status: "done",
      }),
    ).rejects.toMatchObject({ reason: "outside_window" });
  });

  it("crosses midnight cleanly: 23:59 same day vs 00:01 next day", async () => {
    // logDate = April 28. endOfLogDay = April 28 23:59:59.999 LOCAL.
    // windowEnds = April 30 23:59:59.999 LOCAL (endOfLogDay + 48h).
    // First attempt at April 30 23:59:00 LOCAL — one minute before window closes.
    setNowForTesting(new Date(2026, 3, 30, 23, 59, 0)); // April 30 23:59:00 LOCAL
    await seedActiveHabit("2026-04-01");
    const habits = await listHabits({ user_id: "user-1" });
    const habit = habits[0]!;

    const { result, rerender } = renderHook(() => useUpsertHabitLogMutation(), {
      wrapper,
    });

    await result.current.mutateAsync({
      habitId: habit.id,
      logDate: "2026-04-28",
      status: "done",
    });

    // Advance to May 1 00:01:00 LOCAL — one minute past windowEnds.
    setNowForTesting(new Date(2026, 4, 1, 0, 1, 0)); // May 1 00:01:00 LOCAL
    rerender({});

    await expect(
      result.current.mutateAsync({
        habitId: habit.id,
        logDate: "2026-04-28",
        status: "skipped",
      }),
    ).rejects.toMatchObject({ reason: "outside_window" });

    // Verify the original done log is still in place.
    const logs = await listLogs({ habit_id: habit.id });
    expect(logs).toHaveLength(1);
    expect(logs[0]!.status).toBe("done");
  });
});
