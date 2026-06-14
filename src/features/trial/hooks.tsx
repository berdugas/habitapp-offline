import {
  createContext,
  type PropsWithChildren,
  useCallback,
  useContext,
  useEffect,
  useRef,
  useState,
} from "react";
import { AppState, type AppStateStatus } from "react-native";
import * as Network from "expo-network";

import {
  fetchTrialEntitlement,
  TrialEntitlementFetchError,
} from "@/features/trial/api";
import { computeAccessMode } from "@/features/trial/grace";
import {
  clearCachedEntitlement,
  readCachedEntitlement,
  writeCachedEntitlement,
} from "@/features/trial/storage";
import {
  TRIAL_REVALIDATION_STALENESS_MINUTES,
  type AccessMode,
  type CachedTrialEntitlement,
  type TrialEntitlementStatus,
} from "@/features/trial/types";
import { logger } from "@/services/logger";
import { now } from "@/utils/clock";

function shouldRevalidate(
  cached: CachedTrialEntitlement | null,
  currentTime: Date,
): boolean {
  if (!cached) return true;
  const stalenessMs = TRIAL_REVALIDATION_STALENESS_MINUTES * 60 * 1000;
  const ageMs =
    currentTime.getTime() - new Date(cached.last_validated_at).getTime();
  return ageMs > stalenessMs;
}

export type TrialValidationContextValue = {
  isBootstrapping: boolean;
  isValidating: boolean;
  accessMode: AccessMode;
  entitlementStatus: TrialEntitlementStatus | null;
  trialStartedAt: string | null;
  trialEndsAt: string | null;
  lastValidatedAt: string | null;
  // Resolves with the freshly-fetched entitlement (or null on no-session /
  // fetch failure). Callers that only want a side-effect can ignore it; the
  // paywall poll reads the returned value to avoid observing stale React state.
  refresh: () => Promise<CachedTrialEntitlement | null>;
};

const TrialValidationContext =
  createContext<TrialValidationContextValue | null>(null);

export function useTrialValidation(): TrialValidationContextValue {
  const value = useContext(TrialValidationContext);
  if (!value) {
    throw new Error(
      "useTrialValidation must be used within TrialValidationProvider",
    );
  }
  return value;
}

export type LifecycleState = {
  cached: CachedTrialEntitlement | null;
  isBootstrapping: boolean;
  isValidating: boolean;
};

export function useTrialValidationLifecycle(
  userId: string | null,
  isAuthBootstrapping: boolean,
): {
  state: LifecycleState;
  refresh: () => Promise<CachedTrialEntitlement | null>;
} {
  const [state, setState] = useState<LifecycleState>({
    cached: null,
    isBootstrapping: true,
    isValidating: false,
  });

  const userIdRef = useRef<string | null>(userId);
  useEffect(() => {
    userIdRef.current = userId;
  }, [userId]);

  const cachedRef = useRef<CachedTrialEntitlement | null>(null);
  useEffect(() => {
    cachedRef.current = state.cached;
  }, [state.cached]);

  // Monotonic counter so overlapping fetches commit in start-order, not
  // completion-order. AppState/network/refresh/purchase-poll can all call
  // fetchAndCache concurrently; without this an OLDER (e.g. pre-webhook
  // "expired") response completing after a NEWER "paid" one would overwrite a
  // confirmed purchaser back to unpaid. Only the latest-started fetch commits.
  const fetchSeqRef = useRef(0);

  const fetchAndCache = useCallback(
    async (uid: string): Promise<CachedTrialEntitlement | null> => {
    const seq = (fetchSeqRef.current += 1);
    setState((prev) => ({ ...prev, isValidating: true }));
    try {
      const entitlement = await fetchTrialEntitlement(uid);
      // Discard if a newer fetch superseded this one, or the user changed.
      if (fetchSeqRef.current !== seq || userIdRef.current !== uid) return null;
      await writeCachedEntitlement(entitlement);
      if (fetchSeqRef.current !== seq) return null; // re-check after the write
      setState({ cached: entitlement, isBootstrapping: false, isValidating: false });
      return entitlement;
    } catch (error) {
      if (error instanceof TrialEntitlementFetchError) {
        logger.error("Trial validation failed", {
          reason: error.reason,
          userId: uid,
        });
      } else {
        logger.error("Trial validation failed (unknown error)", {
          error,
          userId: uid,
        });
      }
      // Keep whatever cache we have; stop the spinner — but only if a newer
      // fetch hasn't superseded this one (else we'd clear ITS validating flag).
      if (fetchSeqRef.current === seq) {
        setState((prev) => ({ ...prev, isBootstrapping: false, isValidating: false }));
      }
      return null;
    }
  }, []);

  useEffect(() => {
    // Wait for auth to settle before reacting. Otherwise the initial render
    // with userId=null would wipe a valid cache and force offline users into
    // read-only mode on every cold start.
    if (isAuthBootstrapping) return;

    let cancelled = false;

    async function bootstrap() {
      const cached = await readCachedEntitlement();
      if (cancelled) return;

      if (!userId) {
        // Signed out — clear cache, settle into a clean state.
        if (cached) await clearCachedEntitlement();
        if (cancelled) return;
        setState({ cached: null, isBootstrapping: false, isValidating: false });
        return;
      }

      if (cached && cached.user_id !== userId) {
        // Different user — clear stale cache and fetch fresh.
        await clearCachedEntitlement();
        if (cancelled) return;
        setState({ cached: null, isBootstrapping: true, isValidating: false });
        await fetchAndCache(userId);
        return;
      }

      if (cached) {
        // Surface cache immediately, then decide whether to re-fetch.
        setState({ cached, isBootstrapping: false, isValidating: false });
        if (!cancelled && shouldRevalidate(cached, now())) {
          await fetchAndCache(userId);
        }
        return;
      }

      // No cache, user present — fetch immediately.
      if (!cancelled) {
        await fetchAndCache(userId);
      }
    }

    void bootstrap();

    return () => {
      cancelled = true;
    };
  }, [userId, isAuthBootstrapping, fetchAndCache]);

  // Revalidate when the app returns to the foreground and cache is missing or stale.
  useEffect(() => {
    const subscription = AppState.addEventListener(
      "change",
      (nextState: AppStateStatus) => {
        if (nextState !== "active") return;

        const uid = userIdRef.current;
        if (!uid) return;

        if (shouldRevalidate(cachedRef.current, now())) {
          void fetchAndCache(uid);
        }
      },
    );

    return () => subscription.remove();
  }, [fetchAndCache]);

  // Revalidate when connectivity transitions offline→online.
  // Mirrors the AppState handler so users who keep the app foregrounded
  // through a network drop recover without tapping Reconnect.
  useEffect(() => {
    // Assume online at subscribe time so that a "true" replay (if the platform
    // sends one) does not look like a transition. Only false→true triggers.
    let prevConnected = true;

    const subscription = Network.addNetworkStateListener((event) => {
      const isConnected = event.isConnected === true;
      const wasOffline = prevConnected === false;
      prevConnected = isConnected;

      if (!wasOffline || !isConnected) return;

      const uid = userIdRef.current;
      if (!uid) return;

      if (shouldRevalidate(cachedRef.current, now())) {
        void fetchAndCache(uid);
      }
    });

    return () => subscription.remove();
  }, [fetchAndCache]);

  const refresh = useCallback(async (): Promise<CachedTrialEntitlement | null> => {
    const uid = userIdRef.current;
    if (!uid) return null;
    return fetchAndCache(uid);
  }, [fetchAndCache]);

  return { state, refresh };
}

export function TrialValidationProvider({
  children,
  value,
}: PropsWithChildren<{ value: TrialValidationContextValue }>) {
  return (
    <TrialValidationContext.Provider value={value}>
      {children}
    </TrialValidationContext.Provider>
  );
}

export function buildTrialContextValue(
  state: LifecycleState,
  refresh: () => Promise<CachedTrialEntitlement | null>,
): TrialValidationContextValue {
  const accessMode = computeAccessMode({
    lastValidatedAt: state.cached?.last_validated_at ?? null,
    entitlementStatus: state.cached?.entitlement_status ?? null,
    trialEndsAt: state.cached?.trial_ends_at ?? null,
    now: now(),
  });

  return {
    isBootstrapping: state.isBootstrapping,
    isValidating: state.isValidating,
    accessMode,
    entitlementStatus: state.cached?.entitlement_status ?? null,
    trialStartedAt: state.cached?.trial_started_at ?? null,
    trialEndsAt: state.cached?.trial_ends_at ?? null,
    lastValidatedAt: state.cached?.last_validated_at ?? null,
    refresh,
  };
}
