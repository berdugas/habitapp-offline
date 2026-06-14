import React from "react";
import { renderHook, waitFor } from "@testing-library/react-native";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";

import { useCreateHabitMutation } from "@/features/habits/hooks";
import * as api from "@/features/habits/api";

jest.mock("@/features/habits/api");
jest.mock("@/features/auth/hooks", () => ({
  useAuthSession: () => ({ user: { id: "user-1" } }),
}));
jest.mock("@/features/trial/hooks", () => ({
  useTrialValidation: () => ({ accessMode: "full" }),
}));

function wrapWith(qc: QueryClient) {
  return function Wrapper({ children }: { children: React.ReactNode }) {
    return <QueryClientProvider client={qc}>{children}</QueryClientProvider>;
  };
}

describe("useCreateHabitMutation", () => {
  beforeEach(() => jest.clearAllMocks());

  it("invalidates the paywall active-count query on success", async () => {
    // Regression: create previously only fired analytics in onSuccess and never
    // invalidated active-count. Since PaywallHardBlock is always mounted, its
    // count query stayed stale after creates, so a same-session trial→expiry
    // could misclassify the user as free-tier instead of hard-blocking.
    (api.createHabit as jest.Mock).mockResolvedValue({ id: "h-new" });
    const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } });
    const invalidateSpy = jest.spyOn(qc, "invalidateQueries");
    const { result } = renderHook(() => useCreateHabitMutation(), {
      wrapper: wrapWith(qc),
    });

    result.current.mutate({} as never);

    await waitFor(() => expect(result.current.isSuccess).toBe(true));

    const keys = invalidateSpy.mock.calls.map((c) =>
      JSON.stringify(c[0]?.queryKey),
    );
    expect(keys.some((k) => k.includes("active-count"))).toBe(true);
  });
});
