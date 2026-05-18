import React from "react";
import { renderHook, waitFor } from "@testing-library/react-native";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";

import {
  useDeleteTodayHabitLogMutation,
  useUpsertTodayHabitStatusMutation,
} from "@/features/today/hooks";
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

function bulkRangeInvalidated(
  spy: jest.SpyInstance<unknown, [filters?: { queryKey?: readonly unknown[] } | undefined]>,
): boolean {
  return spy.mock.calls.some((call) => {
    const key = call[0]?.queryKey;
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
});
