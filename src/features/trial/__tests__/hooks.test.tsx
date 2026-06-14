jest.mock(
  "@react-native-async-storage/async-storage",
  () => require("@react-native-async-storage/async-storage/jest/async-storage-mock"),
);

// TrialValidationBootstrap mounts useRestorePaywallKeptHabitsOnUpgrade, which
// calls restorePaywallKeptHabits on a paid status. Stub it so the lifecycle
// tests never touch real SQLite.
jest.mock("@/features/habits/api", () => ({
  restorePaywallKeptHabits: jest.fn().mockResolvedValue({ restoredCount: 0 }),
}));

jest.mock("@/features/trial/api", () => ({
  fetchTrialEntitlement: jest.fn(),
  TrialEntitlementFetchError: class TrialEntitlementFetchError extends Error {
    reason: string;
    constructor(message: string, reason: string) {
      super(message);
      this.name = "TrialEntitlementFetchError";
      this.reason = reason;
    }
  },
}));

jest.mock("@/features/trial/storage", () => ({
  readCachedEntitlement: jest.fn(),
  writeCachedEntitlement: jest.fn(),
  clearCachedEntitlement: jest.fn(),
}));

jest.mock("expo-network", () => ({
  addNetworkStateListener: jest.fn(),
}));

jest.mock("@/services/logger", () => ({
  logger: { error: jest.fn(), info: jest.fn(), warn: jest.fn() },
}));

jest.mock("@/features/trial/useRevenueCatLifecycle", () => ({
  useRevenueCatLifecycle: jest.fn(),
}));

import React from "react";
import { AppState, type AppStateStatus } from "react-native";
import * as Network from "expo-network";
import { act, renderHook, waitFor } from "@testing-library/react-native";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";

import { useAuthSession } from "@/features/auth/hooks";
import { AuthSessionProvider } from "@/features/auth/hooks";
import { fetchTrialEntitlement } from "@/features/trial/api";
import {
  clearCachedEntitlement,
  readCachedEntitlement,
  writeCachedEntitlement,
} from "@/features/trial/storage";
import {
  buildTrialContextValue,
  TrialValidationProvider,
  useTrialValidation,
  useTrialValidationLifecycle,
} from "@/features/trial/hooks";
import { TrialValidationBootstrap } from "@/providers/TrialValidationBootstrap";
import { resetClockForTesting, setNowForTesting } from "@/utils/clock";

import { TRIAL_GRACE_PERIOD_DAYS } from "@/features/trial/types";
import type { CachedTrialEntitlement } from "@/features/trial/types";

const mockFetchTrialEntitlement = fetchTrialEntitlement as jest.Mock;
const mockReadCachedEntitlement = readCachedEntitlement as jest.Mock;
const mockWriteCachedEntitlement = writeCachedEntitlement as jest.Mock;
const mockClearCachedEntitlement = clearCachedEntitlement as jest.Mock;

const mockAddNetworkStateListener = Network.addNetworkStateListener as jest.Mock;

let capturedAppStateListener:
  | ((nextState: AppStateStatus) => void)
  | null = null;
let capturedNetworkListener:
  | ((event: Network.NetworkStateEvent) => void)
  | null = null;

const NOW = new Date("2026-05-01T12:00:00.000Z");

function freshEntitlement(userId = "user-1"): CachedTrialEntitlement {
  return {
    user_id: userId,
    trial_started_at: "2026-04-25T00:00:00.000Z",   // 6 days before NOW
    trial_ends_at: "2026-05-09T00:00:00.000Z",       // 8 days after NOW (mid-trial)
    entitlement_status: "trial",
    last_validated_at: NOW.toISOString(),
  };
}

function staleEntitlement(userId = "user-1"): CachedTrialEntitlement {
  // last_validated_at 90 minutes ago — older than the 60-minute staleness threshold
  return {
    ...freshEntitlement(userId),
    last_validated_at: new Date(NOW.getTime() - 90 * 60 * 1000).toISOString(),
  };
}

function graceExhaustedEntitlement(userId = "user-1"): CachedTrialEntitlement {
  // last_validated_at past the grace boundary (drives Case 8's "fetch
  // fails + beyond grace → read_only" assertion regardless of the
  // constant's value).
  const beyondGraceMs = (TRIAL_GRACE_PERIOD_DAYS + 1) * 24 * 60 * 60 * 1000;
  return {
    ...freshEntitlement(userId),
    last_validated_at: new Date(NOW.getTime() - beyondGraceMs).toISOString(),
  };
}

function makeAuthWrapper(authState: {
  isBootstrapping: boolean;
  userId: string | null;
}) {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false } },
  });
  return function Wrapper({ children }: { children: React.ReactNode }) {
    return (
      <QueryClientProvider client={queryClient}>
        <AuthSessionProvider
          value={{
            isBootstrapping: authState.isBootstrapping,
            session: authState.userId ? ({ user: { id: authState.userId } } as never) : null,
            user: authState.userId ? ({ id: authState.userId } as never) : null,
          }}
        >
          <TrialValidationBootstrap>{children}</TrialValidationBootstrap>
        </AuthSessionProvider>
      </QueryClientProvider>
    );
  };
}

describe("useTrialValidation", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    setNowForTesting(NOW);
    mockWriteCachedEntitlement.mockResolvedValue(undefined);
    mockClearCachedEntitlement.mockResolvedValue(undefined);

    capturedAppStateListener = null;
    capturedNetworkListener = null;

    jest
      .spyOn(AppState, "addEventListener")
      .mockImplementation((event, listener) => {
        if (event === "change") {
          capturedAppStateListener = listener as (
            nextState: AppStateStatus,
          ) => void;
        }
        return { remove: jest.fn() } as never;
      });

    mockAddNetworkStateListener.mockImplementation((listener) => {
      capturedNetworkListener = listener;
      return { remove: jest.fn() };
    });
  });

  afterEach(() => {
    resetClockForTesting();
  });

  // ─── Case 1: throws outside provider ─────────────────────────────────────

  it("throws when used outside TrialValidationProvider", () => {
    expect(() => renderHook(() => useTrialValidation())).toThrow(
      "useTrialValidation must be used within TrialValidationProvider",
    );
  });

  // ─── Case 2: auth-bootstrapping short-circuit ─────────────────────────────

  it("does not fetch and stays in bootstrapping state while auth is bootstrapping", async () => {
    mockReadCachedEntitlement.mockResolvedValue(null);

    const wrapper = makeAuthWrapper({ isBootstrapping: true, userId: "user-1" });
    const { result } = renderHook(() => useTrialValidation(), { wrapper });

    // Give it a tick to settle — the effect should short-circuit immediately.
    await waitFor(() => {
      expect(result.current.isBootstrapping).toBe(true);
    });

    expect(mockFetchTrialEntitlement).not.toHaveBeenCalled();
  });

  // ─── Case 3: signed-out user ──────────────────────────────────────────────

  it("clears cache and resolves to read_only when user is signed out", async () => {
    mockReadCachedEntitlement.mockResolvedValue(freshEntitlement());

    const wrapper = makeAuthWrapper({ isBootstrapping: false, userId: null });
    const { result } = renderHook(() => useTrialValidation(), { wrapper });

    await waitFor(() => {
      expect(result.current.isBootstrapping).toBe(false);
    });

    expect(mockClearCachedEntitlement).toHaveBeenCalled();
    expect(mockFetchTrialEntitlement).not.toHaveBeenCalled();
    expect(result.current.accessMode).toBe("read_only");
    expect(result.current.entitlementStatus).toBeNull();
  });

  // ─── Case 4: signed-in, no cache ──────────────────────────────────────────

  it("fetches entitlement and surfaces full access when signed in with no cache", async () => {
    mockReadCachedEntitlement.mockResolvedValue(null);
    mockFetchTrialEntitlement.mockResolvedValue(freshEntitlement());

    const wrapper = makeAuthWrapper({ isBootstrapping: false, userId: "user-1" });
    const { result } = renderHook(() => useTrialValidation(), { wrapper });

    await waitFor(() => {
      expect(result.current.isBootstrapping).toBe(false);
      expect(result.current.isValidating).toBe(false);
    });

    expect(mockFetchTrialEntitlement).toHaveBeenCalledWith("user-1");
    expect(result.current.accessMode).toBe("full");
    expect(result.current.entitlementStatus).toBe("trial");
  });

  // ─── Case 5: signed-in, fresh cache ──────────────────────────────────────

  it("surfaces cached entitlement without re-fetching when cache is fresh", async () => {
    mockReadCachedEntitlement.mockResolvedValue(freshEntitlement());

    const wrapper = makeAuthWrapper({ isBootstrapping: false, userId: "user-1" });
    const { result } = renderHook(() => useTrialValidation(), { wrapper });

    await waitFor(() => {
      expect(result.current.isBootstrapping).toBe(false);
    });

    expect(mockFetchTrialEntitlement).not.toHaveBeenCalled();
    expect(result.current.accessMode).toBe("full");
  });

  // ─── Case 6: signed-in, stale cache ──────────────────────────────────────

  it("surfaces stale cache immediately then re-fetches in background", async () => {
    mockReadCachedEntitlement.mockResolvedValue(staleEntitlement());
    mockFetchTrialEntitlement.mockResolvedValue(freshEntitlement());

    const wrapper = makeAuthWrapper({ isBootstrapping: false, userId: "user-1" });
    const { result } = renderHook(() => useTrialValidation(), { wrapper });

    await waitFor(() => {
      expect(result.current.isBootstrapping).toBe(false);
      expect(result.current.isValidating).toBe(false);
    });

    expect(mockFetchTrialEntitlement).toHaveBeenCalledWith("user-1");
    expect(result.current.accessMode).toBe("full");
  });

  // ─── Case 7: different user_id in cache ───────────────────────────────────

  it("clears cache and re-fetches when cached user_id differs from current user", async () => {
    mockReadCachedEntitlement.mockResolvedValue(freshEntitlement("other-user"));
    mockFetchTrialEntitlement.mockResolvedValue(freshEntitlement("user-1"));

    const wrapper = makeAuthWrapper({ isBootstrapping: false, userId: "user-1" });
    const { result } = renderHook(() => useTrialValidation(), { wrapper });

    await waitFor(() => {
      expect(result.current.isBootstrapping).toBe(false);
      expect(result.current.isValidating).toBe(false);
    });

    expect(mockClearCachedEntitlement).toHaveBeenCalled();
    expect(mockFetchTrialEntitlement).toHaveBeenCalledWith("user-1");
    expect(result.current.entitlementStatus).toBe("trial");
  });

  // ─── Case 8: network error + grace-exhausted cache ────────────────────────

  it("flips to read_only when fetch fails and cached last_validated_at is beyond grace", async () => {
    mockReadCachedEntitlement.mockResolvedValue(graceExhaustedEntitlement());
    const { TrialEntitlementFetchError } = jest.requireMock("@/features/trial/api") as {
      TrialEntitlementFetchError: new (msg: string, reason: string) => Error & { reason: string };
    };
    mockFetchTrialEntitlement.mockRejectedValue(
      new TrialEntitlementFetchError("network error", "network"),
    );

    const wrapper = makeAuthWrapper({ isBootstrapping: false, userId: "user-1" });
    const { result } = renderHook(() => useTrialValidation(), { wrapper });

    await waitFor(() => {
      expect(result.current.isBootstrapping).toBe(false);
      expect(result.current.isValidating).toBe(false);
    });

    // (D1)/(D4) invariant: grace exhausted + fetch failed → read_only
    expect(result.current.accessMode).toBe("read_only");
  });

  // ─── Case 9: manual refresh ───────────────────────────────────────────────

  it("calls fetchTrialEntitlement immediately when refresh() is invoked", async () => {
    mockReadCachedEntitlement.mockResolvedValue(freshEntitlement());
    mockFetchTrialEntitlement.mockResolvedValue(freshEntitlement());

    const wrapper = makeAuthWrapper({ isBootstrapping: false, userId: "user-1" });
    const { result } = renderHook(() => useTrialValidation(), { wrapper });

    await waitFor(() => expect(result.current.isBootstrapping).toBe(false));
    mockFetchTrialEntitlement.mockClear();

    await result.current.refresh();

    expect(mockFetchTrialEntitlement).toHaveBeenCalledWith("user-1");
  });

  it("discards an OLDER refresh response so it can't overwrite a newer paid one", async () => {
    mockReadCachedEntitlement.mockResolvedValue(freshEntitlement()); // fresh → no bootstrap fetch
    const wrapper = makeAuthWrapper({ isBootstrapping: false, userId: "user-1" });

    // Two overlapping fetches: the FIRST (older) will resolve to expired, the
    // SECOND (newer) to paid. The newer lands first, the older second.
    let resolveOlder!: (v: CachedTrialEntitlement) => void;
    let resolveNewer!: (v: CachedTrialEntitlement) => void;
    mockFetchTrialEntitlement
      .mockImplementationOnce(() => new Promise((r) => (resolveOlder = r)))
      .mockImplementationOnce(() => new Promise((r) => (resolveNewer = r)));

    const { result } = renderHook(() => useTrialValidation(), { wrapper });
    await waitFor(() => expect(result.current.isBootstrapping).toBe(false));

    let older!: Promise<unknown>;
    let newer!: Promise<unknown>;
    act(() => {
      older = result.current.refresh(); // seq 1
      newer = result.current.refresh(); // seq 2
    });

    const paid = { ...freshEntitlement(), entitlement_status: "paid" as const };
    const expired = { ...freshEntitlement(), entitlement_status: "expired" as const };

    // Newer (paid) completes first → commits.
    await act(async () => {
      resolveNewer(paid);
      await newer;
    });
    expect(result.current.entitlementStatus).toBe("paid");

    // Older (expired) completes second → must be DISCARDED, paid stands.
    await act(async () => {
      resolveOlder(expired);
      await older;
    });
    expect(result.current.entitlementStatus).toBe("paid");
    expect(result.current.accessMode).toBe("full");
  });

  // ─── Case 10: AppState foreground with no cache (offline cold-start recovery) ──

  it("fetches when app becomes active and there is no cached entitlement", async () => {
    mockReadCachedEntitlement.mockResolvedValue(null);
    const { TrialEntitlementFetchError } = jest.requireMock(
      "@/features/trial/api",
    ) as {
      TrialEntitlementFetchError: new (
        msg: string,
        reason: string,
      ) => Error & { reason: string };
    };
    // Initial bootstrap fetch fails (offline cold start).
    mockFetchTrialEntitlement.mockRejectedValueOnce(
      new TrialEntitlementFetchError("network error", "network"),
    );

    const wrapper = makeAuthWrapper({
      isBootstrapping: false,
      userId: "user-1",
    });
    const { result } = renderHook(() => useTrialValidation(), { wrapper });

    await waitFor(() => expect(result.current.isBootstrapping).toBe(false));
    expect(result.current.accessMode).toBe("read_only");
    mockFetchTrialEntitlement.mockClear();

    // Network comes back; the next fetch succeeds.
    mockFetchTrialEntitlement.mockResolvedValueOnce(freshEntitlement());

    expect(capturedAppStateListener).not.toBeNull();
    await act(async () => {
      capturedAppStateListener!("active");
    });

    await waitFor(() => {
      expect(mockFetchTrialEntitlement).toHaveBeenCalledWith("user-1");
    });
    await waitFor(() => expect(result.current.accessMode).toBe("full"));
  });

  // ─── Case 11: AppState foreground with stale cache (existing behavior, regression guard) ──

  it("fetches when app becomes active and the cached entitlement is stale", async () => {
    mockReadCachedEntitlement.mockResolvedValue(staleEntitlement());
    const { TrialEntitlementFetchError } = jest.requireMock(
      "@/features/trial/api",
    ) as {
      TrialEntitlementFetchError: new (
        msg: string,
        reason: string,
      ) => Error & { reason: string };
    };
    // Bootstrap revalidation fails → cache stays stale.
    mockFetchTrialEntitlement.mockRejectedValueOnce(
      new TrialEntitlementFetchError("network error", "network"),
    );

    const wrapper = makeAuthWrapper({
      isBootstrapping: false,
      userId: "user-1",
    });
    const { result } = renderHook(() => useTrialValidation(), { wrapper });

    await waitFor(() => {
      expect(result.current.isBootstrapping).toBe(false);
      expect(result.current.isValidating).toBe(false);
    });
    // Cache is still stale because the bootstrap fetch rejected.
    expect(result.current.lastValidatedAt).toBe(
      staleEntitlement().last_validated_at,
    );
    mockFetchTrialEntitlement.mockClear();

    // Network recovers; the AppState-triggered fetch succeeds.
    mockFetchTrialEntitlement.mockResolvedValueOnce(freshEntitlement());

    await act(async () => {
      capturedAppStateListener!("active");
    });

    await waitFor(() => {
      expect(mockFetchTrialEntitlement).toHaveBeenCalledWith("user-1");
    });
    await waitFor(() =>
      expect(result.current.lastValidatedAt).toBe(
        freshEntitlement().last_validated_at,
      ),
    );
  });

  // ─── Case 12: AppState foreground with fresh cache should not fetch ──────────

  it("does not fetch when app becomes active and the cached entitlement is fresh", async () => {
    mockReadCachedEntitlement.mockResolvedValue(freshEntitlement());

    const wrapper = makeAuthWrapper({
      isBootstrapping: false,
      userId: "user-1",
    });
    const { result } = renderHook(() => useTrialValidation(), { wrapper });

    // Settle on the hook's bootstrap completion so cachedRef is populated.
    await waitFor(() => expect(result.current.isBootstrapping).toBe(false));
    expect(mockFetchTrialEntitlement).not.toHaveBeenCalled();

    await act(async () => {
      capturedAppStateListener!("active");
    });

    // Give microtasks a chance to flush.
    await new Promise((resolve) => setImmediate(resolve));
    expect(mockFetchTrialEntitlement).not.toHaveBeenCalled();
  });

  // ─── Case 13: AppState foreground while signed out should not fetch ─────────

  it("does not fetch when app becomes active and the user is signed out", async () => {
    mockReadCachedEntitlement.mockResolvedValue(null);

    const wrapper = makeAuthWrapper({ isBootstrapping: false, userId: null });
    const { result } = renderHook(() => useTrialValidation(), { wrapper });

    await waitFor(() => expect(result.current.isBootstrapping).toBe(false));
    expect(mockFetchTrialEntitlement).not.toHaveBeenCalled();

    await act(async () => {
      capturedAppStateListener!("active");
    });

    await new Promise((resolve) => setImmediate(resolve));
    expect(mockFetchTrialEntitlement).not.toHaveBeenCalled();
  });

  // ─── Case 14: Network offline→online with no cache (the second half of the trap) ──

  it("fetches when connectivity transitions offline→online and there is no cached entitlement", async () => {
    mockReadCachedEntitlement.mockResolvedValue(null);
    const { TrialEntitlementFetchError } = jest.requireMock(
      "@/features/trial/api",
    ) as {
      TrialEntitlementFetchError: new (
        msg: string,
        reason: string,
      ) => Error & { reason: string };
    };
    mockFetchTrialEntitlement.mockRejectedValueOnce(
      new TrialEntitlementFetchError("network error", "network"),
    );

    const wrapper = makeAuthWrapper({
      isBootstrapping: false,
      userId: "user-1",
    });
    const { result } = renderHook(() => useTrialValidation(), { wrapper });

    await waitFor(() => expect(result.current.isBootstrapping).toBe(false));
    expect(result.current.accessMode).toBe("read_only");
    mockFetchTrialEntitlement.mockClear();

    mockFetchTrialEntitlement.mockResolvedValueOnce(freshEntitlement());

    expect(capturedNetworkListener).not.toBeNull();
    // Simulate the OS reporting offline first, then online.
    await act(async () => {
      capturedNetworkListener!({ isConnected: false });
    });
    await act(async () => {
      capturedNetworkListener!({ isConnected: true });
    });

    await waitFor(() => {
      expect(mockFetchTrialEntitlement).toHaveBeenCalledWith("user-1");
    });
    await waitFor(() => expect(result.current.accessMode).toBe("full"));
  });

  // ─── Case 15: Network offline→online with stale cache ────────────────────────

  it("fetches when connectivity transitions offline→online and the cached entitlement is stale", async () => {
    mockReadCachedEntitlement.mockResolvedValue(staleEntitlement());
    const { TrialEntitlementFetchError } = jest.requireMock(
      "@/features/trial/api",
    ) as {
      TrialEntitlementFetchError: new (
        msg: string,
        reason: string,
      ) => Error & { reason: string };
    };
    // Bootstrap revalidation fails → cache stays stale.
    mockFetchTrialEntitlement.mockRejectedValueOnce(
      new TrialEntitlementFetchError("network error", "network"),
    );

    const wrapper = makeAuthWrapper({
      isBootstrapping: false,
      userId: "user-1",
    });
    const { result } = renderHook(() => useTrialValidation(), { wrapper });

    await waitFor(() => {
      expect(result.current.isBootstrapping).toBe(false);
      expect(result.current.isValidating).toBe(false);
    });
    expect(result.current.lastValidatedAt).toBe(
      staleEntitlement().last_validated_at,
    );
    mockFetchTrialEntitlement.mockClear();

    // Network recovers; the connectivity-triggered fetch succeeds.
    mockFetchTrialEntitlement.mockResolvedValueOnce(freshEntitlement());

    await act(async () => {
      capturedNetworkListener!({ isConnected: false });
    });
    await act(async () => {
      capturedNetworkListener!({ isConnected: true });
    });

    await waitFor(() => {
      expect(mockFetchTrialEntitlement).toHaveBeenCalledWith("user-1");
    });
    await waitFor(() =>
      expect(result.current.lastValidatedAt).toBe(
        freshEntitlement().last_validated_at,
      ),
    );
  });

  // ─── Case 16: Network offline→online with fresh cache should not fetch ──────

  it("does not fetch when connectivity transitions offline→online and the cached entitlement is fresh", async () => {
    mockReadCachedEntitlement.mockResolvedValue(freshEntitlement());

    const wrapper = makeAuthWrapper({
      isBootstrapping: false,
      userId: "user-1",
    });
    const { result } = renderHook(() => useTrialValidation(), { wrapper });

    await waitFor(() => expect(result.current.isBootstrapping).toBe(false));
    expect(mockFetchTrialEntitlement).not.toHaveBeenCalled();

    await act(async () => {
      capturedNetworkListener!({ isConnected: false });
    });
    await act(async () => {
      capturedNetworkListener!({ isConnected: true });
    });

    await new Promise((resolve) => setImmediate(resolve));
    expect(mockFetchTrialEntitlement).not.toHaveBeenCalled();
  });

  // ─── Case 17: Network online→online (no transition) should not fetch ────────

  it("does not fetch when connectivity reports online without an offline→online transition", async () => {
    mockReadCachedEntitlement.mockResolvedValue(freshEntitlement());

    const wrapper = makeAuthWrapper({
      isBootstrapping: false,
      userId: "user-1",
    });
    const { result } = renderHook(() => useTrialValidation(), { wrapper });

    await waitFor(() => expect(result.current.isBootstrapping).toBe(false));
    expect(mockFetchTrialEntitlement).not.toHaveBeenCalled();

    // Two "online" events back-to-back — no transition.
    await act(async () => {
      capturedNetworkListener!({ isConnected: true });
    });
    await act(async () => {
      capturedNetworkListener!({ isConnected: true });
    });

    await new Promise((resolve) => setImmediate(resolve));
    expect(mockFetchTrialEntitlement).not.toHaveBeenCalled();
  });

  // ─── Case 18: Network offline→online while signed out should not fetch ──────

  it("does not fetch when connectivity transitions offline→online and the user is signed out", async () => {
    mockReadCachedEntitlement.mockResolvedValue(null);

    const wrapper = makeAuthWrapper({ isBootstrapping: false, userId: null });
    const { result } = renderHook(() => useTrialValidation(), { wrapper });

    await waitFor(() => expect(result.current.isBootstrapping).toBe(false));
    expect(mockFetchTrialEntitlement).not.toHaveBeenCalled();

    await act(async () => {
      capturedNetworkListener!({ isConnected: false });
    });
    await act(async () => {
      capturedNetworkListener!({ isConnected: true });
    });

    await new Promise((resolve) => setImmediate(resolve));
    expect(mockFetchTrialEntitlement).not.toHaveBeenCalled();
  });

  // ─── Case 19: Network listener subscription is removed on unmount ──────────

  it("removes the network listener subscription when the hook unmounts", async () => {
    mockReadCachedEntitlement.mockResolvedValue(freshEntitlement());
    const remove = jest.fn();
    mockAddNetworkStateListener.mockImplementation((listener) => {
      capturedNetworkListener = listener;
      return { remove };
    });

    const wrapper = makeAuthWrapper({
      isBootstrapping: false,
      userId: "user-1",
    });
    const { unmount } = renderHook(() => useTrialValidation(), { wrapper });

    await waitFor(() => expect(mockAddNetworkStateListener).toHaveBeenCalled());

    unmount();
    expect(remove).toHaveBeenCalled();
  });

  describe("buildTrialContextValue — entitlement-aware accessMode", () => {
    beforeEach(() => {
      setNowForTesting(NOW);
    });

    afterEach(() => {
      resetClockForTesting();
    });

    const noop = async () => null;

    function makeState(overrides: Partial<CachedTrialEntitlement>) {
      return {
        cached: { ...freshEntitlement(), ...overrides },
        isBootstrapping: false,
        isValidating: false,
      };
    }

    it("returns 'full' for paid users even with an ancient cache", () => {
      const state = makeState({
        entitlement_status: "paid",
        last_validated_at: "2024-01-01T00:00:00.000Z", // ancient
      });
      const value = buildTrialContextValue(state, noop);
      expect(value.accessMode).toBe("full");
    });

    it("returns 'expired_no_purchase' when server-marked expired", () => {
      const state = makeState({ entitlement_status: "expired" });
      const value = buildTrialContextValue(state, noop);
      expect(value.accessMode).toBe("expired_no_purchase");
    });

    it("returns 'expired_no_purchase' when client-side guard fires (trial_ends_at past, status still 'trial')", () => {
      const state = makeState({
        entitlement_status: "trial",
        trial_ends_at: "2026-04-29T00:00:00.000Z", // before NOW
      });
      const value = buildTrialContextValue(state, noop);
      expect(value.accessMode).toBe("expired_no_purchase");
    });
  });
});
