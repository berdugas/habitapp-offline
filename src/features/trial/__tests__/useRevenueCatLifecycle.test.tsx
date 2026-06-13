import { renderHook } from "@testing-library/react-native";
import { useRevenueCatLifecycle } from "@/features/trial/useRevenueCatLifecycle";
import {
  logInRevenueCat,
  logOutRevenueCat,
  restorePurchases,
  syncPurchases,
} from "@/services/revenuecat";

jest.mock("@/services/revenuecat", () => ({
  // logInRevenueCat returns a boolean indicating whether identity was
  // successfully established. The hook's behaviour is the same on
  // success vs failure (refresh still runs); the boolean is just so
  // future Settings UI can show an inline warning.
  logInRevenueCat: jest.fn().mockResolvedValue(true),
  logOutRevenueCat: jest.fn().mockResolvedValue(undefined),
  // restorePurchases and syncPurchases are exported but the lifecycle
  // hook MUST NOT call them automatically. They're reserved for an
  // explicit user gesture (Settings → Restore Purchase, sub-plan #4)
  // and for future one-time migrations respectively. Per RC docs,
  // auto-syncing on every launch can cause unintended subscriber
  // aliasing or transfers.
  restorePurchases: jest.fn().mockResolvedValue(undefined),
  syncPurchases: jest.fn().mockResolvedValue(undefined),
}));

const mockLogIn = logInRevenueCat as jest.Mock;
const mockLogOut = logOutRevenueCat as jest.Mock;
const mockRestore = restorePurchases as jest.Mock;
const mockSync = syncPurchases as jest.Mock;
const mockRefresh = jest.fn().mockResolvedValue(undefined);

describe("useRevenueCatLifecycle", () => {
  beforeEach(() => {
    mockLogIn.mockReset().mockResolvedValue(true);
    mockLogOut.mockReset().mockResolvedValue(undefined);
    mockRestore.mockReset().mockResolvedValue(undefined);
    mockSync.mockReset().mockResolvedValue(undefined);
    mockRefresh.mockReset().mockResolvedValue(undefined);
  });

  it("calls logIn + refresh on mount when userId is present (NO automatic sync/restore)", async () => {
    jest.useFakeTimers();
    const { unmount } = renderHook(() =>
      useRevenueCatLifecycle("user-1", mockRefresh),
    );
    // Drain the awaited chain
    await Promise.resolve();
    await Promise.resolve();
    await Promise.resolve();
    expect(mockLogIn).toHaveBeenCalledWith("user-1");
    // CRITICAL: neither sync nor restore is called automatically.
    expect(mockSync).not.toHaveBeenCalled();
    expect(mockRestore).not.toHaveBeenCalled();
    expect(mockRefresh).toHaveBeenCalledTimes(1);

    // Follow-up refresh fires 3s later
    jest.advanceTimersByTime(3000);
    await Promise.resolve();
    expect(mockRefresh).toHaveBeenCalledTimes(2);

    unmount();
    jest.useRealTimers();
  });

  it("cancels the follow-up refresh when the hook unmounts before it fires", async () => {
    jest.useFakeTimers();
    const { unmount } = renderHook(() =>
      useRevenueCatLifecycle("user-1", mockRefresh),
    );
    await Promise.resolve();
    await Promise.resolve();
    await Promise.resolve();
    expect(mockRefresh).toHaveBeenCalledTimes(1);

    unmount();
    jest.advanceTimersByTime(3000);
    await Promise.resolve();
    // Still 1 — the follow-up timer was cancelled by the cleanup function.
    expect(mockRefresh).toHaveBeenCalledTimes(1);
    jest.useRealTimers();
  });

  it("does not call logIn when userId is null (signed out)", async () => {
    renderHook(() => useRevenueCatLifecycle(null, mockRefresh));
    await new Promise((r) => setTimeout(r, 0));
    expect(mockLogIn).not.toHaveBeenCalled();
    expect(mockRefresh).not.toHaveBeenCalled();
  });

  it("calls logOut when userId transitions from a value to null", async () => {
    const { rerender } = renderHook<void, { userId: string | null }>(
      ({ userId }) => useRevenueCatLifecycle(userId, mockRefresh),
      { initialProps: { userId: "user-1" } },
    );
    await new Promise((r) => setTimeout(r, 0));
    mockLogIn.mockClear();
    mockRefresh.mockClear();

    rerender({ userId: null });
    await new Promise((r) => setTimeout(r, 0));
    expect(mockLogOut).toHaveBeenCalledTimes(1);
    expect(mockLogIn).not.toHaveBeenCalled();
  });

  it("calls logIn + refresh when userId switches users", async () => {
    const { rerender } = renderHook<void, { userId: string }>(
      ({ userId }) => useRevenueCatLifecycle(userId, mockRefresh),
      { initialProps: { userId: "user-1" } },
    );
    await new Promise((r) => setTimeout(r, 0));
    mockLogIn.mockClear();
    mockRefresh.mockClear();

    rerender({ userId: "user-2" });
    await new Promise((r) => setTimeout(r, 0));
    expect(mockLogIn).toHaveBeenCalledWith("user-2");
    expect(mockSync).not.toHaveBeenCalled();
    expect(mockRestore).not.toHaveBeenCalled();
    expect(mockRefresh).toHaveBeenCalledTimes(1);
  });

  it("still calls refresh when logIn fails (the webhook may have applied state separately)", async () => {
    mockLogIn.mockResolvedValueOnce(false);
    renderHook(() => useRevenueCatLifecycle("user-1", mockRefresh));
    await new Promise((r) => setTimeout(r, 0));
    expect(mockLogIn).toHaveBeenCalledWith("user-1");
    // No client-side sync regardless of logIn outcome.
    expect(mockSync).not.toHaveBeenCalled();
    expect(mockRefresh).toHaveBeenCalledTimes(1);
  });

  it("does not crash if logIn rejects (best-effort) and still calls refresh", async () => {
    mockLogIn.mockRejectedValueOnce(new Error("network"));
    renderHook(() => useRevenueCatLifecycle("user-1", mockRefresh));
    await new Promise((r) => setTimeout(r, 0));
    expect(mockLogIn).toHaveBeenCalledWith("user-1");
    expect(mockRefresh).toHaveBeenCalledTimes(1);
  });

  it("skips refresh when userId switches before logIn resolves (in-flight identity superseded)", async () => {
    // Keep logIn pending for user-1, so the swap to user-2 races it.
    let resolveFirst: ((v: boolean) => void) | undefined;
    mockLogIn.mockReturnValueOnce(
      new Promise<boolean>((resolve) => {
        resolveFirst = resolve;
      }),
    );

    const { rerender } = renderHook<void, { userId: string }>(
      ({ userId }) => useRevenueCatLifecycle(userId, mockRefresh),
      { initialProps: { userId: "user-1" } },
    );

    // Swap to user-2 BEFORE the user-1 logIn resolves.
    rerender({ userId: "user-2" });
    await new Promise((r) => setTimeout(r, 0));

    // Now resolve the in-flight user-1 logIn. The hook MUST notice the
    // identity changed and NOT call refresh against user-1.
    expect(resolveFirst).toBeDefined();
    resolveFirst?.(true);
    await new Promise((r) => setTimeout(r, 0));
    await new Promise((r) => setTimeout(r, 0));

    // logIn was called for both users.
    expect(mockLogIn).toHaveBeenCalledWith("user-1");
    expect(mockLogIn).toHaveBeenCalledWith("user-2");
    // Exactly one refresh (for user-2). The stale user-1 chain abandoned.
    expect(mockRefresh).toHaveBeenCalledTimes(1);
  });
});
