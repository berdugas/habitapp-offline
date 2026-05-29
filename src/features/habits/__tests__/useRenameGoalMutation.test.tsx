import { renderHook, waitFor } from "@testing-library/react-native";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import React from "react";

import { useRenameGoalMutation } from "@/features/habits/hooks";
import { __resetForTests, goalIdFor } from "@/services/goalIdRegistry";

const mockRenameGoal = jest.fn();
const mockGetHabitById = jest.fn();
jest.mock("@/features/habits/api", () => ({
  renameGoal: (...args: unknown[]) => mockRenameGoal(...args),
  getHabitById: (...args: unknown[]) => mockGetHabitById(...args),
}));

const mockTrackEvent = jest.fn();
jest.mock("@/services/analytics", () => ({
  trackEvent: (...args: unknown[]) => mockTrackEvent(...args),
}));

jest.mock("@/features/auth/hooks", () => ({
  useAuthSession: () => ({ user: { id: "user-1" } }),
}));

function wrapWith(client: QueryClient) {
  return function Wrapper({ children }: { children: React.ReactNode }) {
    return <QueryClientProvider client={client}>{children}</QueryClientProvider>;
  };
}

beforeEach(() => {
  jest.clearAllMocks();
  __resetForTests();
  mockRenameGoal.mockResolvedValue({ renamedHabitIds: ["h1"] });
  mockGetHabitById.mockResolvedValue({ id: "h1", user_id: "user-1", identity_phrase: "healthy" });
});

describe("useRenameGoalMutation", () => {
  it("renames, carries the analytics id to the new phrase, and emits goal_renamed", async () => {
    const oldId = goalIdFor("a healthy");

    const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
    const { result } = renderHook(() => useRenameGoalMutation(), { wrapper: wrapWith(client) });
    await result.current.mutateAsync({ oldPhrase: "a healthy", newPhrase: "healthy" });

    await waitFor(() => {
      expect(mockRenameGoal).toHaveBeenCalledWith("user-1", "a healthy", "healthy");
    });
    // Alias carried the source id onto the new phrase.
    expect(goalIdFor("healthy")).toBe(oldId);
    // Event fired with the continuous id.
    expect(mockTrackEvent).toHaveBeenCalledWith("goal_renamed", { goal_id: oldId });
    // The invalidation loop ran over result.renamedHabitIds — the surface helper
    // fetches each renamed habit, so getHabitById is called with the looped id.
    expect(mockGetHabitById).toHaveBeenCalledWith("user-1", "h1");
  });

  it("on a merge, keeps the existing target id and reports it (alias no-ops)", async () => {
    const targetId = goalIdFor("runner");
    goalIdFor("a healthy");

    const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
    const { result } = renderHook(() => useRenameGoalMutation(), { wrapper: wrapWith(client) });
    await result.current.mutateAsync({ oldPhrase: "a healthy", newPhrase: "runner" });

    await waitFor(() => {
      expect(mockRenameGoal).toHaveBeenCalledWith("user-1", "a healthy", "runner");
    });
    // Target already had an id — it wins; the alias must not overwrite it.
    expect(goalIdFor("runner")).toBe(targetId);
    expect(mockTrackEvent).toHaveBeenCalledWith("goal_renamed", { goal_id: targetId });
  });
});
