import { useCallback, useEffect, useRef, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { router } from "expo-router";

import { useAuthSession } from "@/features/auth/hooks";
import {
  getEligibleHabitsQueryKey,
  getUpcomingActiveHabitsQueryKey,
} from "@/features/habits/hooks";
import { logger } from "@/services/logger";
import { toDeviceDateString } from "@/utils/dates";

import { finalizeOnboarding } from "./completion";
import {
  isOnboardingCompleted,
  loadOnboardingDraft,
  saveOnboardingDraft,
} from "./storage";
import { EMPTY_DRAFT, type OnboardingDraft } from "./types";

export function useOnboardingDraft(): {
  draft: OnboardingDraft;
  hydrated: boolean;
  update: (patch: Partial<OnboardingDraft>) => void;
} {
  const [draft, setDraft] = useState<OnboardingDraft>(EMPTY_DRAFT);
  const [hydrated, setHydrated] = useState(false);

  // draftRef mirrors state so update() always has the latest value without
  // needing to put side effects inside a setDraft updater function.
  const draftRef = useRef<OnboardingDraft>(EMPTY_DRAFT);
  const pendingTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    let cancelled = false;
    loadOnboardingDraft()
      .then((loaded) => {
        if (!cancelled) {
          draftRef.current = loaded;
          setDraft(loaded);
          setHydrated(true);
        }
      })
      .catch((error: unknown) => {
        logger.warn("Failed to load onboarding draft", { error });
        if (!cancelled) setHydrated(true);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  // Flush any pending write on unmount so navigation doesn't lose the last keystroke.
  useEffect(() => {
    return () => {
      if (pendingTimer.current !== null) {
        clearTimeout(pendingTimer.current);
        pendingTimer.current = null;
        void saveOnboardingDraft(draftRef.current);
      }
    };
  }, []);

  const update = useCallback((patch: Partial<OnboardingDraft>) => {
    const next = { ...draftRef.current, ...patch };
    draftRef.current = next;
    setDraft(next);

    if (pendingTimer.current !== null) {
      clearTimeout(pendingTimer.current);
    }
    pendingTimer.current = setTimeout(() => {
      void saveOnboardingDraft(draftRef.current);
      pendingTimer.current = null;
    }, 200);
  }, []);

  return { draft, hydrated, update };
}

export function getIsOnboardingCompletedQueryKey(userId: string | undefined) {
  return ["onboarding", "completed", userId ?? "guest"];
}

export function useIsOnboardingCompletedQuery() {
  const { user } = useAuthSession();
  return useQuery({
    queryKey: getIsOnboardingCompletedQueryKey(user?.id),
    queryFn: isOnboardingCompleted,
    enabled: Boolean(user?.id),
    staleTime: Infinity,
  });
}

export function useFinalizeOnboardingMutation(draft: OnboardingDraft) {
  const { user } = useAuthSession();
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async () => {
      if (!user?.id) {
        throw new Error("No user session");
      }
      return finalizeOnboarding(user.id, draft);
    },
    onSuccess: async () => {
      if (!user?.id) {
        return;
      }
      const todayDate = toDeviceDateString();
      await Promise.all([
        queryClient.invalidateQueries({
          queryKey: getIsOnboardingCompletedQueryKey(user.id),
        }),
        queryClient.invalidateQueries({
          queryKey: getEligibleHabitsQueryKey(user.id, todayDate),
        }),
        queryClient.invalidateQueries({
          queryKey: getUpcomingActiveHabitsQueryKey(user.id, todayDate),
        }),
      ]);
      // Navigate directly to Today — we know the habit exists and onboarding is
      // complete, so bypassing RootEntryScreen avoids a stale-cache race where
      // "/" redirects back to onboarding before the invalidated queries refetch.
      router.replace("/(app)/(tabs)/today");
    },
  });
}
