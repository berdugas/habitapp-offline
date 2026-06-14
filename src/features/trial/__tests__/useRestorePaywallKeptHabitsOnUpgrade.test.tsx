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

  it("reconciles once on a cold start that begins already paid (the fix), not again on re-render", () => {
    // The old version skipped this case, which stranded paywall-archived habits
    // when the upgrade transition was missed (app closed before it was seen).
    const { rerender } = renderHook<void, HookProps>(
      ({ userId, status }) => useRestorePaywallKeptHabitsOnUpgrade(userId, status),
      { initialProps: { userId: "user-1", status: "paid" } },
    );
    expect(mockRestore).toHaveBeenCalledTimes(1); // cold-start paid reconciles
    rerender({ userId: "user-1", status: "paid" });
    expect(mockRestore).toHaveBeenCalledTimes(1); // once per signed-in session
  });

  it("reconciles on null → paid (no prior non-paid observation required)", () => {
    // null = cache not loaded yet; the next launch of an already-upgraded user
    // begins null → paid. restorePaywallKeptHabits is idempotent, so reconciling
    // here is safe and closes the missed-upgrade gap.
    const { rerender } = renderHook<void, HookProps>(
      ({ userId, status }) => useRestorePaywallKeptHabitsOnUpgrade(userId, status),
      { initialProps: { userId: "user-1", status: null } },
    );
    rerender({ userId: "user-1", status: "paid" });
    expect(mockRestore).toHaveBeenCalledWith("user-1");
    expect(mockRestore).toHaveBeenCalledTimes(1);
  });

  it("reconciles again for a different signed-in user even if both are paid", () => {
    const { rerender } = renderHook<void, HookProps>(
      ({ userId, status }) => useRestorePaywallKeptHabitsOnUpgrade(userId, status),
      { initialProps: { userId: "user-1", status: "paid" } },
    );
    expect(mockRestore).toHaveBeenCalledTimes(1);
    rerender({ userId: "user-2", status: "paid" });
    expect(mockRestore).toHaveBeenCalledWith("user-2");
    expect(mockRestore).toHaveBeenCalledTimes(2);
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

  it("does NOT call restore on paid → active transition (both paid-like — already reconciled)", () => {
    // trial → paid reconciles once; the later paid → active flip is still the
    // same signed-in paid session, so the once-per-session latch skips it.
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
      "Failed to restore paywall habits",
      expect.objectContaining({ userId: "user-1", error: expect.any(Error) }),
    );

    loggerErrorSpy.mockRestore();
  });
});
