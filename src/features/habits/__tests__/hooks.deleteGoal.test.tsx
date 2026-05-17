import React from "react";
import { renderHook, waitFor } from "@testing-library/react-native";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";

import {
  getGoalHabitCountQueryKey,
  useDeleteGoalMutation,
} from "@/features/habits/hooks";
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

describe("useDeleteGoalMutation", () => {
  beforeEach(() => jest.clearAllMocks());

  it("calls api.deleteGoal with userId + identityPhrase", async () => {
    (api.deleteGoal as jest.Mock).mockResolvedValue({ deletedHabitCount: 2, deletedHabitIds: ["h1", "h2"] });
    const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } });
    const { result } = renderHook(() => useDeleteGoalMutation(), {
      wrapper: wrapWith(qc),
    });

    result.current.mutate({ identityPhrase: "a runner" });

    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(api.deleteGoal).toHaveBeenCalledWith("user-1", "a runner");
  });

  it("invalidates the goal-habit-count query for the deleted phrase on success", async () => {
    (api.deleteGoal as jest.Mock).mockResolvedValue({ deletedHabitCount: 1, deletedHabitIds: ["h1"] });
    const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } });
    const invalidateSpy = jest.spyOn(qc, "invalidateQueries");
    const { result } = renderHook(() => useDeleteGoalMutation(), {
      wrapper: wrapWith(qc),
    });

    result.current.mutate({ identityPhrase: "a runner" });

    await waitFor(() => expect(result.current.isSuccess).toBe(true));

    expect(invalidateSpy).toHaveBeenCalledWith({
      queryKey: getGoalHabitCountQueryKey("user-1", "a runner"),
    });
  });

  it("invalidates the broad habit surface queries on success", async () => {
    (api.deleteGoal as jest.Mock).mockResolvedValue({ deletedHabitCount: 1, deletedHabitIds: ["h1"] });
    const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } });
    const invalidateSpy = jest.spyOn(qc, "invalidateQueries");
    const { result } = renderHook(() => useDeleteGoalMutation(), {
      wrapper: wrapWith(qc),
    });

    result.current.mutate({ identityPhrase: "a runner" });

    await waitFor(() => expect(result.current.isSuccess).toBe(true));

    const calls = invalidateSpy.mock.calls.map((c) => c[0]?.queryKey);
    // Should invalidate the goal-related habit list surfaces — at minimum,
    // eligible + upcoming queries that feed useGoalDetail, plus the
    // goal-status review cache.
    const flat = calls.map((k) => JSON.stringify(k));
    expect(flat.some((s) => s.includes("eligible"))).toBe(true);
    expect(flat.some((s) => s.includes("upcoming"))).toBe(true);
    expect(flat.some((s) => s.includes("goal-status"))).toBe(true);
  });
});
