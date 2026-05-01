jest.mock(
  "@react-native-async-storage/async-storage",
  () => require("@react-native-async-storage/async-storage/jest/async-storage-mock"),
);

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

jest.mock("@/services/logger", () => ({
  logger: { error: jest.fn(), info: jest.fn(), warn: jest.fn() },
}));

import React from "react";
import { AppState } from "react-native";
import { renderHook, waitFor } from "@testing-library/react-native";

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

import type { CachedTrialEntitlement } from "@/features/trial/types";

const mockFetchTrialEntitlement = fetchTrialEntitlement as jest.Mock;
const mockReadCachedEntitlement = readCachedEntitlement as jest.Mock;
const mockWriteCachedEntitlement = writeCachedEntitlement as jest.Mock;
const mockClearCachedEntitlement = clearCachedEntitlement as jest.Mock;

const NOW = new Date("2026-05-01T12:00:00.000Z");

function freshEntitlement(userId = "user-1"): CachedTrialEntitlement {
  return {
    user_id: userId,
    trial_started_at: "2026-04-15T00:00:00.000Z",
    trial_ends_at: "2026-04-29T00:00:00.000Z",
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
  // last_validated_at 8 days ago — beyond the 7-day grace period
  return {
    ...freshEntitlement(userId),
    last_validated_at: new Date(NOW.getTime() - 8 * 24 * 60 * 60 * 1000).toISOString(),
  };
}

function makeAuthWrapper(authState: {
  isBootstrapping: boolean;
  userId: string | null;
}) {
  return function Wrapper({ children }: { children: React.ReactNode }) {
    return (
      <AuthSessionProvider
        value={{
          isBootstrapping: authState.isBootstrapping,
          session: authState.userId ? ({ user: { id: authState.userId } } as never) : null,
          user: authState.userId ? ({ id: authState.userId } as never) : null,
        }}
      >
        <TrialValidationBootstrap>{children}</TrialValidationBootstrap>
      </AuthSessionProvider>
    );
  };
}

describe("useTrialValidation", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    setNowForTesting(NOW);
    mockWriteCachedEntitlement.mockResolvedValue(undefined);
    mockClearCachedEntitlement.mockResolvedValue(undefined);
    // Prevent real AppState subscriptions from firing in tests.
    jest.spyOn(AppState, "addEventListener").mockReturnValue({ remove: jest.fn() } as never);
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
});
