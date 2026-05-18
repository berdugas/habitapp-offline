// Regression: Goal Detail metrics (chart, streak, consistency donut) read
// from a "bulk-range" logs query keyed on habitIds + dateRange. Before this
// guard was added, none of the three log-write mutations invalidated that
// key, so Goal Detail served stale metrics for up to staleTime (30s) after
// any log on Today or any retro log on Habit Detail.

import React from "react";
import { renderHook, waitFor } from "@testing-library/react-native";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";

import {
  useDeleteTodayHabitLogMutation,
  useUpsertTodayHabitStatusMutation,
} from "@/features/today/hooks";
import { useUpsertHabitLogMutation } from "@/features/habits/hooks";
import * as habitsApi from "@/features/habits/api";

jest.mock("@/features/habits/api");
jest.mock("@/features/auth/hooks", () => ({
  useAuthSession: () => ({ user: { id: "user-1" } }),
}));

function wrapWith(qc: QueryClient) {
  return function Wrapper({ children }: { children: React.ReactNode }) {
    return <QueryClientProvider client={qc}>{children}</QueryClientProvider>;
  };
}

function bulkRangeInvalidated(spy: jest.SpyInstance) {
  return spy.mock.calls.some((args) => {
    const key = args[0]?.queryKey;
    return (
      Array.isArray(key) &&
      key[0] === "habit-logs" &&
      key[1] === "bulk-range" &&
      key.length === 2
    );
  });
}

describe("log mutations invalidate the goal-detail bulk-range cache", () => {
  beforeEach(() => jest.clearAllMocks());

  it("useUpsertTodayHabitStatusMutation invalidates [habit-logs, bulk-range] prefix on success", async () => {
    (habitsApi.upsertHabitLog as jest.Mock).mockResolvedValue({
      id: "log-1",
    });
    (habitsApi.getHabitLogsInRange as jest.Mock).mockResolvedValue([]);
    const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } });
    const spy = jest.spyOn(qc, "invalidateQueries");

    const { result } = renderHook(() => useUpsertTodayHabitStatusMutation(), {
      wrapper: wrapWith(qc),
    });
    result.current.mutate({ habitId: "h1", status: "done" });

    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(bulkRangeInvalidated(spy)).toBe(true);
  });

  it("useDeleteTodayHabitLogMutation invalidates [habit-logs, bulk-range] prefix on success", async () => {
    (habitsApi.deleteHabitLog as jest.Mock).mockResolvedValue(undefined);
    (habitsApi.getHabitLogsInRange as jest.Mock).mockResolvedValue([]);
    const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } });
    const spy = jest.spyOn(qc, "invalidateQueries");

    const { result } = renderHook(() => useDeleteTodayHabitLogMutation(), {
      wrapper: wrapWith(qc),
    });
    result.current.mutate("h1");

    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(bulkRangeInvalidated(spy)).toBe(true);
  });

  it("useUpsertHabitLogMutation (retro log) invalidates [habit-logs, bulk-range] prefix on success", async () => {
    (habitsApi.upsertHabitLog as jest.Mock).mockResolvedValue({ id: "log-2" });
    const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } });
    const spy = jest.spyOn(qc, "invalidateQueries");

    const { result } = renderHook(() => useUpsertHabitLogMutation(), {
      wrapper: wrapWith(qc),
    });
    result.current.mutate({
      habitId: "h1",
      logDate: "2026-05-01",
      status: "done",
    });

    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(bulkRangeInvalidated(spy)).toBe(true);
  });
});
