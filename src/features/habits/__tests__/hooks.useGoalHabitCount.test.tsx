import React from "react";
import { renderHook, waitFor } from "@testing-library/react-native";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";

import { useGoalHabitCountQuery } from "@/features/habits/hooks";
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

describe("useGoalHabitCountQuery", () => {
  beforeEach(() => jest.clearAllMocks());

  it("returns count of habits sharing the identity_phrase regardless of state/status", async () => {
    (api.listGoalHabits as jest.Mock).mockResolvedValue([
      { id: "h1", habit_state: "active", status: "active" },
      { id: "h2", habit_state: "active", status: "archived" },
      { id: "h3", habit_state: "automatic", status: "active" },
      { id: "h4", habit_state: "active", status: "backlog" },
    ]);
    const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } });
    const { result } = renderHook(() => useGoalHabitCountQuery("a runner"), {
      wrapper: wrapWith(qc),
    });

    await waitFor(() => expect(result.current.data).toBe(4));
    expect(api.listGoalHabits).toHaveBeenCalledWith("user-1", "a runner");
  });

  it("returns 0 when identityPhrase has no matches", async () => {
    (api.listGoalHabits as jest.Mock).mockResolvedValue([]);
    const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } });
    const { result } = renderHook(() => useGoalHabitCountQuery("nothing"), {
      wrapper: wrapWith(qc),
    });

    await waitFor(() => expect(result.current.data).toBe(0));
  });

  it("is disabled when identityPhrase is undefined", () => {
    const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } });
    const { result } = renderHook(() => useGoalHabitCountQuery(undefined), {
      wrapper: wrapWith(qc),
    });

    expect(result.current.fetchStatus).toBe("idle");
    expect(api.listGoalHabits).not.toHaveBeenCalled();
  });
});
