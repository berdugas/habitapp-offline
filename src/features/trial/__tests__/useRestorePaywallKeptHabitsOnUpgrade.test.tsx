import React from "react";
import { renderHook, act, waitFor } from "@testing-library/react-native";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";

import { useRestorePaywallKeptHabitsOnUpgrade } from "@/features/trial/useRestorePaywallKeptHabitsOnUpgrade";
import { restorePaywallKeptHabits } from "@/features/habits/api";
import { logger } from "@/services/logger";

import type { TrialEntitlementStatus } from "@/features/trial/types";

jest.mock("@/features/habits/api", () => ({
  restorePaywallKeptHabits: jest.fn(),
}));

const mockRestore = restorePaywallKeptHabits as jest.Mock;

type HookProps = {
  userId: string | null;
  status: TrialEntitlementStatus | null;
};

function renderReconcile(initialProps: HookProps) {
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  const invalidateSpy = jest.spyOn(qc, "invalidateQueries");
  function wrapper({ children }: { children: React.ReactNode }) {
    return <QueryClientProvider client={qc}>{children}</QueryClientProvider>;
  }
  const utils = renderHook<void, HookProps>(
    ({ userId, status }) => useRestorePaywallKeptHabitsOnUpgrade(userId, status),
    { wrapper, initialProps },
  );
  return { ...utils, invalidateSpy };
}

describe("useRestorePaywallKeptHabitsOnUpgrade", () => {
  beforeEach(() => {
    mockRestore.mockReset();
    mockRestore.mockResolvedValue({ restoredCount: 2 });
  });

  it("calls restore on the trial → paid transition", () => {
    const { rerender } = renderReconcile({ userId: "user-1", status: "trial" });
    expect(mockRestore).not.toHaveBeenCalled();

    rerender({ userId: "user-1", status: "paid" });
    expect(mockRestore).toHaveBeenCalledWith("user-1");
    expect(mockRestore).toHaveBeenCalledTimes(1);
  });

  it("calls restore on the expired → paid transition", () => {
    const { rerender } = renderReconcile({ userId: "user-1", status: "expired" });
    rerender({ userId: "user-1", status: "paid" });
    expect(mockRestore).toHaveBeenCalledWith("user-1");
  });

  it("reconciles once on a cold start that begins already paid (the fix), not again on re-render", () => {
    const { rerender } = renderReconcile({ userId: "user-1", status: "paid" });
    expect(mockRestore).toHaveBeenCalledTimes(1); // cold-start paid reconciles
    rerender({ userId: "user-1", status: "paid" });
    expect(mockRestore).toHaveBeenCalledTimes(1); // once per signed-in session
  });

  it("reconciles on null → paid (no prior non-paid observation required)", () => {
    const { rerender } = renderReconcile({ userId: "user-1", status: null });
    rerender({ userId: "user-1", status: "paid" });
    expect(mockRestore).toHaveBeenCalledWith("user-1");
    expect(mockRestore).toHaveBeenCalledTimes(1);
  });

  it("reconciles again for a different signed-in user even if both are paid", () => {
    const { rerender } = renderReconcile({ userId: "user-1", status: "paid" });
    expect(mockRestore).toHaveBeenCalledTimes(1);
    rerender({ userId: "user-2", status: "paid" });
    expect(mockRestore).toHaveBeenCalledWith("user-2");
    expect(mockRestore).toHaveBeenCalledTimes(2);
  });

  it("does NOT call restore when userId is null", () => {
    const { rerender } = renderReconcile({ userId: null, status: "trial" });
    rerender({ userId: null, status: "paid" });
    expect(mockRestore).not.toHaveBeenCalled();
  });

  it("treats 'active' the same as 'paid' (defensive — paid-like)", () => {
    const { rerender } = renderReconcile({ userId: "user-1", status: "trial" });
    rerender({ userId: "user-1", status: "active" });
    expect(mockRestore).toHaveBeenCalledTimes(1);
  });

  it("does NOT call restore on paid → active transition (both paid-like — already reconciled)", () => {
    const { rerender } = renderReconcile({ userId: "user-1", status: "trial" });
    rerender({ userId: "user-1", status: "paid" });
    expect(mockRestore).toHaveBeenCalledTimes(1);
    rerender({ userId: "user-1", status: "active" });
    expect(mockRestore).toHaveBeenCalledTimes(1);
  });

  it("invalidates the habits queries after a non-zero restore so mounted screens refresh", async () => {
    mockRestore.mockResolvedValue({ restoredCount: 2 });
    const { rerender, invalidateSpy } = renderReconcile({
      userId: "user-1",
      status: "trial",
    });
    rerender({ userId: "user-1", status: "paid" });
    await waitFor(() =>
      expect(invalidateSpy).toHaveBeenCalledWith({ queryKey: ["habits"] }),
    );
  });

  it("does NOT invalidate when nothing was restored (restoredCount 0)", async () => {
    mockRestore.mockResolvedValue({ restoredCount: 0 });
    const { rerender, invalidateSpy } = renderReconcile({
      userId: "user-1",
      status: "trial",
    });
    rerender({ userId: "user-1", status: "paid" });
    await waitFor(() => expect(mockRestore).toHaveBeenCalled());
    expect(invalidateSpy).not.toHaveBeenCalledWith({ queryKey: ["habits"] });
  });

  it("retries via a bounded timer after a transient failure (stable paid session)", async () => {
    jest.useFakeTimers();
    const loggerErrorSpy = jest.spyOn(logger, "error").mockImplementation(() => {});
    mockRestore.mockReset();
    mockRestore
      .mockRejectedValueOnce(new Error("transient"))
      .mockResolvedValue({ restoredCount: 0 });

    renderReconcile({ userId: "user-1", status: "paid" });

    // First attempt fails — flush its microtasks so the catch schedules a timer.
    await act(async () => {
      await Promise.resolve();
      await Promise.resolve();
    });
    expect(mockRestore).toHaveBeenCalledTimes(1);

    // Advancing the timer retries WITHOUT any dep change (the whole point).
    await act(async () => {
      await jest.advanceTimersByTimeAsync(3000);
    });
    expect(mockRestore).toHaveBeenCalledTimes(2);

    loggerErrorSpy.mockRestore();
    jest.useRealTimers();
  });

  it("logs an error when restorePaywallKeptHabits rejects", async () => {
    const loggerErrorSpy = jest.spyOn(logger, "error").mockImplementation(() => {});
    mockRestore.mockReset();
    mockRestore.mockRejectedValue(new Error("DB unavailable"));

    const { rerender } = renderReconcile({ userId: "user-1", status: "trial" });
    rerender({ userId: "user-1", status: "paid" });

    await Promise.resolve();
    await Promise.resolve();

    expect(loggerErrorSpy).toHaveBeenCalledWith(
      "Failed to restore paywall habits",
      expect.objectContaining({ userId: "user-1", error: expect.any(Error) }),
    );

    loggerErrorSpy.mockRestore();
  });
});
