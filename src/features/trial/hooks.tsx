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

export type TrialValidationContextValue = {
  isBootstrapping: boolean;
  isValidating: boolean;
  accessMode: AccessMode;
  entitlementStatus: TrialEntitlementStatus | null;
  trialStartedAt: string | null;
  trialEndsAt: string | null;
  lastValidatedAt: string | null;
  refresh: () => Promise<void>;
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
  refresh: () => Promise<void>;
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

  const fetchAndCache = useCallback(async (uid: string) => {
    setState((prev) => ({ ...prev, isValidating: true }));
    try {
      const entitlement = await fetchTrialEntitlement(uid);
      // Guard: user may have signed out while fetch was in flight.
      if (userIdRef.current !== uid) return;
      await writeCachedEntitlement(entitlement);
      setState({ cached: entitlement, isBootstrapping: false, isValidating: false });
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
      // Keep whatever cache we have; stop the spinner.
      setState((prev) => ({ ...prev, isBootstrapping: false, isValidating: false }));
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
        const stalenessMs = TRIAL_REVALIDATION_STALENESS_MINUTES * 60 * 1000;
        const ageMs =
          now().getTime() - new Date(cached.last_validated_at).getTime();
        if (!cancelled && ageMs > stalenessMs) {
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

  // Revalidate when the app returns to the foreground and cache is stale.
  useEffect(() => {
    const subscription = AppState.addEventListener(
      "change",
      (nextState: AppStateStatus) => {
        if (nextState !== "active") return;

        const uid = userIdRef.current;
        const cached = cachedRef.current;
        if (!uid || !cached) return;

        const stalenessMs = TRIAL_REVALIDATION_STALENESS_MINUTES * 60 * 1000;
        const ageMs =
          now().getTime() - new Date(cached.last_validated_at).getTime();
        if (ageMs > stalenessMs) {
          void fetchAndCache(uid);
        }
      },
    );

    return () => subscription.remove();
  }, [fetchAndCache]);

  const refresh = useCallback(async () => {
    const uid = userIdRef.current;
    if (!uid) return;
    await fetchAndCache(uid);
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
  refresh: () => Promise<void>,
): TrialValidationContextValue {
  const accessMode = computeAccessMode({
    lastValidatedAt: state.cached?.last_validated_at ?? null,
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
