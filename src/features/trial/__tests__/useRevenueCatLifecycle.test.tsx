import { renderHook } from "@testing-library/react-native";
import { useRevenueCatLifecycle } from "@/features/trial/useRevenueCatLifecycle";
import {
  logInRevenueCat,
  logOutRevenueCat,
  restorePurchases,
} from "@/services/revenuecat";

jest.mock("@/services/revenuecat", () => ({
  logInRevenueCat: jest.fn().mockResolvedValue(undefined),
  logOutRevenueCat: jest.fn().mockResolvedValue(undefined),
  restorePurchases: jest.fn().mockResolvedValue(undefined),
}));

const mockLogIn = logInRevenueCat as jest.Mock;
const mockLogOut = logOutRevenueCat as jest.Mock;
const mockRestore = restorePurchases as jest.Mock;
const mockRefresh = jest.fn().mockResolvedValue(undefined);

describe("useRevenueCatLifecycle", () => {
  beforeEach(() => {
    mockLogIn.mockReset().mockResolvedValue(undefined);
    mockLogOut.mockReset().mockResolvedValue(undefined);
    mockRestore.mockReset().mockResolvedValue(undefined);
    mockRefresh.mockReset().mockResolvedValue(undefined);
  });

  it("calls logIn + restorePurchases + refresh on mount when userId is present", async () => {
    jest.useFakeTimers();
    const { unmount } = renderHook(() =>
      useRevenueCatLifecycle("user-1", mockRefresh),
    );
    // Drain the awaited chain
    await Promise.resolve();
    await Promise.resolve();
    await Promise.resolve();
    expect(mockLogIn).toHaveBeenCalledWith("user-1");
    expect(mockRestore).toHaveBeenCalledTimes(1);
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
    expect(mockRestore).not.toHaveBeenCalled();
    expect(mockRefresh).not.toHaveBeenCalled();
  });

  it("calls logOut when userId transitions from a value to null", async () => {
    const { rerender } = renderHook<void, { userId: string | null }>(
      ({ userId }) => useRevenueCatLifecycle(userId, mockRefresh),
      { initialProps: { userId: "user-1" } },
    );
    await new Promise((r) => setTimeout(r, 0));
    mockLogIn.mockClear();
    mockRestore.mockClear();
    mockRefresh.mockClear();

    rerender({ userId: null });
    await new Promise((r) => setTimeout(r, 0));
    expect(mockLogOut).toHaveBeenCalledTimes(1);
    expect(mockLogIn).not.toHaveBeenCalled();
  });

  it("calls logIn + restore + refresh when userId switches users", async () => {
    const { rerender } = renderHook<void, { userId: string }>(
      ({ userId }) => useRevenueCatLifecycle(userId, mockRefresh),
      { initialProps: { userId: "user-1" } },
    );
    await new Promise((r) => setTimeout(r, 0));
    mockLogIn.mockClear();
    mockRestore.mockClear();
    mockRefresh.mockClear();

    rerender({ userId: "user-2" });
    await new Promise((r) => setTimeout(r, 0));
    expect(mockLogIn).toHaveBeenCalledWith("user-2");
    expect(mockRestore).toHaveBeenCalledTimes(1);
    expect(mockRefresh).toHaveBeenCalledTimes(1);
  });

  it("does not crash if restorePurchases rejects (best-effort)", async () => {
    mockRestore.mockRejectedValueOnce(new Error("network"));
    renderHook(() => useRevenueCatLifecycle("user-1", mockRefresh));
    await new Promise((r) => setTimeout(r, 0));
    expect(mockLogIn).toHaveBeenCalledWith("user-1");
    // refresh should still fire even after a failed restore — the webhook
    // may have updated the row from a separate purchase event.
    expect(mockRefresh).toHaveBeenCalledTimes(1);
  });
});
