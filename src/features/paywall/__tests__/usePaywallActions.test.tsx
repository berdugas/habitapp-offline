import { renderHook, act } from "@testing-library/react-native";

import {
  usePaywallActions,
  __resetStoreOpLockForTests,
} from "@/features/paywall/PaywallController";
import { paywallCopy } from "@/features/paywall/copy";

const mockPurchase = jest.fn();
const mockRestore = jest.fn();
const mockRefresh = jest.fn();
let mockEntitlementStatus: string | null = null;

jest.mock("@/services/revenuecat", () => ({
  purchaseLifetimeUnlock: (...a: unknown[]) => mockPurchase(...a),
  restorePurchases: (...a: unknown[]) => mockRestore(...a),
}));
jest.mock("@/features/trial/hooks", () => ({
  useTrialValidation: () => ({
    refresh: mockRefresh,
    entitlementStatus: mockEntitlementStatus,
  }),
}));
jest.mock("@/services/logger", () => ({
  logger: { error: jest.fn(), warn: jest.fn(), info: jest.fn() },
}));

// Inject a no-op sleep so the poll never waits on real timers.
const fastPoll = { pollAttempts: 3, pollIntervalMs: 0, sleep: () => Promise.resolve() };

function ent(status: string) {
  return { entitlement_status: status };
}

beforeEach(() => {
  mockPurchase.mockReset();
  mockRestore.mockReset();
  mockRefresh.mockReset();
  mockEntitlementStatus = null;
  __resetStoreOpLockForTests(); // module-level lock — reset between tests
});

describe("onUnlock", () => {
  it("resolves and goes idle when the server confirms paid", async () => {
    mockPurchase.mockResolvedValue({ cancelled: false });
    mockRefresh.mockResolvedValue(ent("paid"));
    const onResolved = jest.fn();
    const { result } = renderHook(() => usePaywallActions(onResolved, fastPoll));
    await act(async () => {
      await result.current.onUnlock();
    });
    expect(onResolved).toHaveBeenCalledTimes(1);
    expect(result.current.status).toEqual({ kind: "idle" });
  });

  it("shows processing (no resolve) when the server never reports paid in time", async () => {
    mockPurchase.mockResolvedValue({ cancelled: false });
    mockRefresh.mockResolvedValue(ent("expired"));
    const onResolved = jest.fn();
    const { result } = renderHook(() => usePaywallActions(onResolved, fastPoll));
    await act(async () => {
      await result.current.onUnlock();
    });
    expect(onResolved).not.toHaveBeenCalled();
    expect(result.current.status).toEqual({ kind: "processing" });
  });

  it("does NOT treat an in-trial 'trial' status as paid (would falsely unlock a trialer)", async () => {
    mockPurchase.mockResolvedValue({ cancelled: false });
    mockRefresh.mockResolvedValue(ent("trial"));
    const onResolved = jest.fn();
    const { result } = renderHook(() => usePaywallActions(onResolved, fastPoll));
    await act(async () => {
      await result.current.onUnlock();
    });
    expect(onResolved).not.toHaveBeenCalled();
    expect(result.current.status).toEqual({ kind: "processing" });
  });

  it("a cancelled purchase neither polls nor resolves and stays idle", async () => {
    mockPurchase.mockResolvedValue({ cancelled: true });
    const onResolved = jest.fn();
    const { result } = renderHook(() => usePaywallActions(onResolved, fastPoll));
    await act(async () => {
      await result.current.onUnlock();
    });
    expect(onResolved).not.toHaveBeenCalled();
    expect(mockRefresh).not.toHaveBeenCalled();
    expect(result.current.status).toEqual({ kind: "idle" });
  });

  it("surfaces purchaseFailed when the purchase throws", async () => {
    mockPurchase.mockRejectedValue(new Error("boom"));
    const { result } = renderHook(() => usePaywallActions(jest.fn(), fastPoll));
    await act(async () => {
      await result.current.onUnlock();
    });
    expect(result.current.status).toEqual({
      kind: "error",
      message: paywallCopy.purchaseFailed,
    });
  });
});

describe("onRestore — three outcomes", () => {
  it("RC failed/unconfigured → restoreFailed (does not poll)", async () => {
    mockRestore.mockResolvedValue({ status: "failed" });
    const { result } = renderHook(() => usePaywallActions(jest.fn(), fastPoll));
    await act(async () => {
      await result.current.onRestore();
    });
    expect(result.current.status).toEqual({
      kind: "error",
      message: paywallCopy.restoreFailed,
    });
    expect(mockRefresh).not.toHaveBeenCalled();
  });

  it("RC ok but no lifetime entitlement → restoreNoneFound (does not poll)", async () => {
    mockRestore.mockResolvedValue({ status: "ok", hasLifetimeEntitlement: false });
    const { result } = renderHook(() => usePaywallActions(jest.fn(), fastPoll));
    await act(async () => {
      await result.current.onRestore();
    });
    expect(result.current.status).toEqual({
      kind: "error",
      message: paywallCopy.restoreNoneFound,
    });
    expect(mockRefresh).not.toHaveBeenCalled();
  });

  it("RC has entitlement + server paid → resolves", async () => {
    mockRestore.mockResolvedValue({ status: "ok", hasLifetimeEntitlement: true });
    mockRefresh.mockResolvedValue(ent("paid"));
    const onResolved = jest.fn();
    const { result } = renderHook(() => usePaywallActions(onResolved, fastPoll));
    await act(async () => {
      await result.current.onRestore();
    });
    expect(onResolved).toHaveBeenCalledTimes(1);
  });

  it("RC has entitlement but server lags → processing (no false dismiss)", async () => {
    mockRestore.mockResolvedValue({ status: "ok", hasLifetimeEntitlement: true });
    mockRefresh.mockResolvedValue(ent("expired"));
    const onResolved = jest.fn();
    const { result } = renderHook(() => usePaywallActions(onResolved, fastPoll));
    await act(async () => {
      await result.current.onRestore();
    });
    expect(onResolved).not.toHaveBeenCalled();
    expect(result.current.status).toEqual({ kind: "processing" });
  });
});

describe("externally-observed paid", () => {
  it("resolves the processing state when entitlement turns paid via another path", async () => {
    // Drive into processing (purchase ok, poll times out), then a background
    // lifecycle refresh flips entitlementStatus to paid.
    mockPurchase.mockResolvedValue({ cancelled: false });
    mockRefresh.mockResolvedValue(ent("expired"));
    const onResolved = jest.fn();
    const { result, rerender } = renderHook(() =>
      usePaywallActions(onResolved, fastPoll),
    );
    await act(async () => {
      await result.current.onUnlock();
    });
    expect(result.current.status).toEqual({ kind: "processing" });

    onResolved.mockClear();
    mockEntitlementStatus = "paid"; // observed elsewhere
    rerender(undefined);

    expect(onResolved).toHaveBeenCalledTimes(1);
    expect(result.current.status).toEqual({ kind: "idle" });
  });
});

describe("concurrency mutex", () => {
  it("the store-op lock is SHARED across instances (Settings restore blocks a modal purchase)", async () => {
    mockRestore.mockReturnValue(new Promise(() => {})); // restore stays in flight
    const settings = renderHook(() => usePaywallActions(jest.fn(), fastPoll));
    const modal = renderHook(() => usePaywallActions(jest.fn(), fastPoll));

    await act(async () => {
      settings.result.current.onRestore(); // locks the shared module lock
    });
    await act(async () => {
      modal.result.current.onUnlock(); // different instance — must be blocked
    });

    expect(mockRestore).toHaveBeenCalledTimes(1);
    expect(mockPurchase).not.toHaveBeenCalled();
  });

  it("a synchronous double-press starts only ONE purchase", async () => {
    // Never-resolving purchase keeps the first op in flight; the second press
    // (same event tick, before any re-render) must be a no-op.
    mockPurchase.mockReturnValue(new Promise(() => {}));
    const { result } = renderHook(() => usePaywallActions(jest.fn(), fastPoll));
    await act(async () => {
      result.current.onUnlock();
      result.current.onUnlock();
    });
    expect(mockPurchase).toHaveBeenCalledTimes(1);
  });

  it("a synchronous double-press starts only ONE restore", async () => {
    mockRestore.mockReturnValue(new Promise(() => {}));
    const { result } = renderHook(() => usePaywallActions(jest.fn(), fastPoll));
    await act(async () => {
      result.current.onRestore();
      result.current.onRestore();
    });
    expect(mockRestore).toHaveBeenCalledTimes(1);
  });
});

describe("onRecheck", () => {
  it("re-polls and resolves once paid/active is observed", async () => {
    mockRefresh.mockResolvedValue(ent("active"));
    const onResolved = jest.fn();
    const { result } = renderHook(() => usePaywallActions(onResolved, fastPoll));
    await act(async () => {
      await result.current.onRecheck();
    });
    expect(onResolved).toHaveBeenCalledTimes(1);
  });
});
