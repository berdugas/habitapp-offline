import { renderHook } from "@testing-library/react-native";
import { useRevenueCatLifecycle } from "@/features/trial/useRevenueCatLifecycle";
import {
  logInRevenueCat,
  logOutRevenueCat,
  syncPurchases,
} from "@/services/revenuecat";

jest.mock("@/services/revenuecat", () => ({
  // logInRevenueCat returns a boolean indicating whether identity was
  // successfully established. The hook MUST check this before calling
  // syncPurchases — syncing against a stale identity would associate
  // purchases with the wrong user.
  logInRevenueCat: jest.fn().mockResolvedValue(true),
  logOutRevenueCat: jest.fn().mockResolvedValue(undefined),
  syncPurchases: jest.fn().mockResolvedValue(undefined),
}));

const mockLogIn = logInRevenueCat as jest.Mock;
const mockLogOut = logOutRevenueCat as jest.Mock;
const mockSync = syncPurchases as jest.Mock;
const mockRefresh = jest.fn().mockResolvedValue(undefined);

describe("useRevenueCatLifecycle", () => {
  beforeEach(() => {
    mockLogIn.mockReset().mockResolvedValue(true);
    mockLogOut.mockReset().mockResolvedValue(undefined);
    mockSync.mockReset().mockResolvedValue(undefined);
    mockRefresh.mockReset().mockResolvedValue(undefined);
  });

  it("calls logIn + syncPurchases + refresh on mount when userId is present", async () => {
    jest.useFakeTimers();
    const { unmount } = renderHook(() =>
      useRevenueCatLifecycle("user-1", mockRefresh),
    );
    // Drain the awaited chain
    await Promise.resolve();
    await Promise.resolve();
    await Promise.resolve();
    expect(mockLogIn).toHaveBeenCalledWith("user-1");
    expect(mockSync).toHaveBeenCalledTimes(1);
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
    expect(mockSync).not.toHaveBeenCalled();
    expect(mockRefresh).not.toHaveBeenCalled();
  });

  it("calls logOut when userId transitions from a value to null", async () => {
    const { rerender } = renderHook<void, { userId: string | null }>(
      ({ userId }) => useRevenueCatLifecycle(userId, mockRefresh),
      { initialProps: { userId: "user-1" } },
    );
    await new Promise((r) => setTimeout(r, 0));
    mockLogIn.mockClear();
    mockSync.mockClear();
    mockRefresh.mockClear();

    rerender({ userId: null });
    await new Promise((r) => setTimeout(r, 0));
    expect(mockLogOut).toHaveBeenCalledTimes(1);
    expect(mockLogIn).not.toHaveBeenCalled();
  });

  it("calls logIn + sync + refresh when userId switches users", async () => {
    const { rerender } = renderHook<void, { userId: string }>(
      ({ userId }) => useRevenueCatLifecycle(userId, mockRefresh),
      { initialProps: { userId: "user-1" } },
    );
    await new Promise((r) => setTimeout(r, 0));
    mockLogIn.mockClear();
    mockSync.mockClear();
    mockRefresh.mockClear();

    rerender({ userId: "user-2" });
    await new Promise((r) => setTimeout(r, 0));
    expect(mockLogIn).toHaveBeenCalledWith("user-2");
    expect(mockSync).toHaveBeenCalledTimes(1);
    expect(mockRefresh).toHaveBeenCalledTimes(1);
  });

  it("does not crash if syncPurchases rejects (best-effort)", async () => {
    mockSync.mockRejectedValueOnce(new Error("network"));
    renderHook(() => useRevenueCatLifecycle("user-1", mockRefresh));
    await new Promise((r) => setTimeout(r, 0));
    expect(mockLogIn).toHaveBeenCalledWith("user-1");
    // refresh should still fire even after a failed sync — the webhook
    // may have updated the row from a separate purchase event.
    expect(mockRefresh).toHaveBeenCalledTimes(1);
  });

  it("skips syncPurchases when logIn fails — syncing against a stale identity would attribute purchases to the wrong user", async () => {
    mockLogIn.mockResolvedValueOnce(false);
    renderHook(() => useRevenueCatLifecycle("user-1", mockRefresh));
    await new Promise((r) => setTimeout(r, 0));
    expect(mockLogIn).toHaveBeenCalledWith("user-1");
    expect(mockSync).not.toHaveBeenCalled();
    // refresh still fires — the webhook may have updated state from a
    // separate event, so re-fetching is harmless and informative.
    expect(mockRefresh).toHaveBeenCalledTimes(1);
  });

  it("skips syncPurchases and refresh when userId switches before logIn resolves (in-flight identity superseded)", async () => {
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
    // identity changed and NOT call sync against user-1.
    expect(resolveFirst).toBeDefined();
    resolveFirst?.(true);
    await new Promise((r) => setTimeout(r, 0));
    await new Promise((r) => setTimeout(r, 0));

    // logIn was called for both users, but sync only ran for user-2.
    expect(mockLogIn).toHaveBeenCalledWith("user-1");
    expect(mockLogIn).toHaveBeenCalledWith("user-2");
    // Exactly one sync (for user-2). The stale user-1 chain abandoned.
    expect(mockSync).toHaveBeenCalledTimes(1);
    // Exactly one refresh (for user-2). The stale user-1 chain also
    // skipped refresh, since lastUserIdRef.current !== intendedUserId.
    expect(mockRefresh).toHaveBeenCalledTimes(1);
  });
});
