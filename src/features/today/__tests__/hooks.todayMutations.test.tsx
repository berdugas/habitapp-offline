import React from "react";
import { renderHook, waitFor } from "@testing-library/react-native";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";

import {
  useDeleteTodayHabitLogMutation,
  useUpsertTodayHabitStatusMutation,
} from "@/features/today/hooks";
import { useUpsertHabitLogMutation } from "@/features/habits/hooks";
import * as api from "@/features/habits/api";

jest.mock("@/features/habits/api");
jest.mock("@/features/auth/hooks", () => ({
  useAuthSession: () => ({ user: { id: "user-1" } }),
}));

function wrapWith(qc: QueryClient) {
  return function Wrapper({ children }: { children: React.ReactNode }) {
    return <QueryClientProvider client={qc}>{children}</QueryClientProvider>;
  };
}

// Loosely-typed: invalidateQueries accepts variadic args across @tanstack/
// react-query versions, so the spy's variance trips strict TS. We only
// care about reading the first arg's queryKey here.
function bulkRangeInvalidated(spy: jest.SpyInstance): boolean {
  return spy.mock.calls.some((call) => {
    const filters = call[0] as { queryKey?: readonly unknown[] } | undefined;
    const key = filters?.queryKey;
    if (!Array.isArray(key)) return false;
    return key[0] === "habit-logs" && key[1] === "bulk-range";
  });
}

describe("Today log mutations — Goal Detail cache invalidation", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    // Both onSuccess paths await queryClient.fetchQuery({ queryFn: () =>
    // getHabitLogsInRange(...) }) before the new bulk-range invalidation runs.
    // Without this stub the auto-mock returns undefined, fetchQuery rejects,
    // and the awaited chain never reaches the assertion under test.
    (api.getHabitLogsInRange as jest.Mock).mockResolvedValue([]);
  });

  it("useUpsertTodayHabitStatusMutation invalidates the bulk-range key so Goal Detail refreshes", async () => {
    (api.upsertHabitLog as jest.Mock).mockResolvedValue({});
    const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } });
    const invalidateSpy = jest.spyOn(qc, "invalidateQueries");
    const { result } = renderHook(() => useUpsertTodayHabitStatusMutation(), {
      wrapper: wrapWith(qc),
    });

    result.current.mutate({ habitId: "h1", status: "done" });

    await waitFor(() => expect(bulkRangeInvalidated(invalidateSpy)).toBe(true));
  });

  it("useDeleteTodayHabitLogMutation invalidates the bulk-range key so Goal Detail refreshes", async () => {
    (api.deleteHabitLog as jest.Mock).mockResolvedValue(true);
    const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } });
    const invalidateSpy = jest.spyOn(qc, "invalidateQueries");
    const { result } = renderHook(() => useDeleteTodayHabitLogMutation(), {
      wrapper: wrapWith(qc),
    });

    result.current.mutate("h1");

    await waitFor(() => expect(bulkRangeInvalidated(invalidateSpy)).toBe(true));
  });

  // The retro-log path lives in features/habits/hooks and uses the same
  // ["habit-logs","bulk-range"] cache. Without this invalidation, retro-
  // logging from Habit Detail leaves Goal Detail's metrics stale for
  // staleTime (30s) — same root cause as the Today mutations above.
  it("useUpsertHabitLogMutation (retro log) invalidates the bulk-range key so Goal Detail refreshes", async () => {
    (api.upsertHabitLog as jest.Mock).mockResolvedValue({ id: "log-1" });
    const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } });
    const invalidateSpy = jest.spyOn(qc, "invalidateQueries");
    const { result } = renderHook(() => useUpsertHabitLogMutation(), {
      wrapper: wrapWith(qc),
    });

    result.current.mutate({ habitId: "h1", logDate: "2026-05-01", status: "done" });

    await waitFor(() => expect(bulkRangeInvalidated(invalidateSpy)).toBe(true));
  });
});
