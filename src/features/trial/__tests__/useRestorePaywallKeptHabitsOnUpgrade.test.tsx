import { renderHook } from "@testing-library/react-native";
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

describe("useRestorePaywallKeptHabitsOnUpgrade", () => {
  beforeEach(() => {
    mockRestore.mockReset();
    mockRestore.mockResolvedValue({ restoredCount: 2 });
  });

  it("calls restore on the trial → paid transition", () => {
    const { rerender } = renderHook<void, HookProps>(
      ({ userId, status }) => useRestorePaywallKeptHabitsOnUpgrade(userId, status),
      { initialProps: { userId: "user-1", status: "trial" } },
    );
    expect(mockRestore).not.toHaveBeenCalled();

    rerender({ userId: "user-1", status: "paid" });
    expect(mockRestore).toHaveBeenCalledWith("user-1");
    expect(mockRestore).toHaveBeenCalledTimes(1);
  });

  it("calls restore on the expired → paid transition", () => {
    const { rerender } = renderHook<void, HookProps>(
      ({ userId, status }) => useRestorePaywallKeptHabitsOnUpgrade(userId, status),
      { initialProps: { userId: "user-1", status: "expired" } },
    );
    rerender({ userId: "user-1", status: "paid" });
    expect(mockRestore).toHaveBeenCalledWith("user-1");
  });

  it("does NOT call restore on a paid → paid 're-render' (no transition)", () => {
    const { rerender } = renderHook<void, HookProps>(
      ({ userId, status }) => useRestorePaywallKeptHabitsOnUpgrade(userId, status),
      { initialProps: { userId: "user-1", status: "paid" } },
    );
    expect(mockRestore).toHaveBeenCalledTimes(0); // initial paid does NOT fire
    rerender({ userId: "user-1", status: "paid" });
    expect(mockRestore).toHaveBeenCalledTimes(0);
  });

  it("does NOT call restore on null → paid until a non-null non-paid is seen first", () => {
    // null status = no cache loaded yet. Without a prior non-paid observation,
    // we can't tell if this is a true upgrade or a cold-start of a paid user.
    // Conservative: skip the restore until we see a non-paid status first.
    const { rerender } = renderHook<void, HookProps>(
      ({ userId, status }) => useRestorePaywallKeptHabitsOnUpgrade(userId, status),
      { initialProps: { userId: "user-1", status: null } },
    );
    rerender({ userId: "user-1", status: "paid" });
    expect(mockRestore).not.toHaveBeenCalled();
  });

  it("does NOT call restore when userId is null", () => {
    const { rerender } = renderHook<void, HookProps>(
      ({ userId, status }) => useRestorePaywallKeptHabitsOnUpgrade(userId, status),
      { initialProps: { userId: null, status: "trial" } },
    );
    rerender({ userId: null, status: "paid" });
    expect(mockRestore).not.toHaveBeenCalled();
  });

  it("treats 'active' the same as 'paid' (defensive — paid-like)", () => {
    const { rerender } = renderHook<void, HookProps>(
      ({ userId, status }) => useRestorePaywallKeptHabitsOnUpgrade(userId, status),
      { initialProps: { userId: "user-1", status: "trial" } },
    );
    rerender({ userId: "user-1", status: "active" });
    expect(mockRestore).toHaveBeenCalledTimes(1);
  });

  it("does NOT call restore on paid → active transition (both paid-like — no upgrade)", () => {
    // First seed a non-paid status so hasSeenNonPaidRef.current = true
    const { rerender } = renderHook<void, HookProps>(
      ({ userId, status }) => useRestorePaywallKeptHabitsOnUpgrade(userId, status),
      { initialProps: { userId: "user-1", status: "trial" } },
    );
    rerender({ userId: "user-1", status: "paid" });
    expect(mockRestore).toHaveBeenCalledTimes(1); // first transition

    // Now the paid → active flip; both are paid-like, should NOT fire again.
    rerender({ userId: "user-1", status: "active" });
    expect(mockRestore).toHaveBeenCalledTimes(1); // still 1
  });

  it("logs an error when restorePaywallKeptHabits rejects", async () => {
    const loggerErrorSpy = jest.spyOn(logger, "error").mockImplementation(() => {});
    mockRestore.mockReset();
    mockRestore.mockRejectedValueOnce(new Error("DB unavailable"));

    const { rerender } = renderHook<void, HookProps>(
      ({ userId, status }) => useRestorePaywallKeptHabitsOnUpgrade(userId, status),
      { initialProps: { userId: "user-1", status: "trial" } },
    );
    rerender({ userId: "user-1", status: "paid" });

    // Drain microtasks so the async IIFE's catch block runs
    await Promise.resolve();
    await Promise.resolve();

    expect(loggerErrorSpy).toHaveBeenCalledWith(
      "Failed to restore paywall habits on upgrade",
      expect.objectContaining({ userId: "user-1", error: expect.any(Error) }),
    );

    loggerErrorSpy.mockRestore();
  });
});
