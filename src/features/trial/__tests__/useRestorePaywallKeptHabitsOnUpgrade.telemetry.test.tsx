import React from "react";
import { renderHook, waitFor } from "@testing-library/react-native";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";

import { useRestorePaywallKeptHabitsOnUpgrade } from "@/features/trial/useRestorePaywallKeptHabitsOnUpgrade";
import { restorePaywallKeptHabits } from "@/features/habits/api";

const mockTrackEvent = jest.fn();
jest.mock("@/services/analytics", () => ({
  trackEvent: (...a: unknown[]) => mockTrackEvent(...a),
}));
jest.mock("@/features/habits/api", () => ({
  restorePaywallKeptHabits: jest.fn(),
}));
const mockRestore = restorePaywallKeptHabits as jest.Mock;

function renderOnUpgrade(status: "trial" | "paid") {
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  function wrapper({ children }: { children: React.ReactNode }) {
    return <QueryClientProvider client={qc}>{children}</QueryClientProvider>;
  }
  return renderHook(
    ({ s }: { s: "trial" | "paid" }) =>
      useRestorePaywallKeptHabitsOnUpgrade("user-1", s),
    { wrapper, initialProps: { s: status } },
  );
}

beforeEach(() => {
  mockTrackEvent.mockReset();
  mockRestore.mockReset();
});

it("fires archive_restored_on_upgrade with the restored_count when habits were restored", async () => {
  mockRestore.mockResolvedValue({ restoredCount: 3 });
  const { rerender } = renderOnUpgrade("trial");
  rerender({ s: "paid" });
  await waitFor(() =>
    expect(mockTrackEvent).toHaveBeenCalledWith("archive_restored_on_upgrade", {
      restored_count: 3,
    }),
  );
});

it("does NOT fire when nothing was restored (restoredCount 0)", async () => {
  mockRestore.mockResolvedValue({ restoredCount: 0 });
  const { rerender } = renderOnUpgrade("trial");
  rerender({ s: "paid" });
  await waitFor(() => expect(mockRestore).toHaveBeenCalled());
  expect(mockTrackEvent).not.toHaveBeenCalledWith(
    "archive_restored_on_upgrade",
    expect.anything(),
  );
});
