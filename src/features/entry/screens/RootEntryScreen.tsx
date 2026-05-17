import { useEffect } from "react";
import { Redirect } from "expo-router";
import { useQueryClient } from "@tanstack/react-query";

import { ErrorState } from "@/components/feedback/ErrorState";
import { LoadingState } from "@/components/feedback/LoadingState";
import { useAuthSession } from "@/features/auth/hooks";
import {
  useEligibleHabitsQuery,
  useUpcomingActiveHabitsQuery,
} from "@/features/habits/hooks";
import {
  getIsOnboardingCompletedQueryKey,
  useIsOnboardingCompletedQuery,
} from "@/features/onboarding/hooks";
import { markOnboardingCompleted } from "@/features/onboarding/storage";
import { logger } from "@/services/logger";
import { getLoadHabitsErrorMessage } from "@/utils/userFacingErrors";
import WelcomeScreen from "@/features/entry/screens/WelcomeScreen";

export default function RootEntryScreen() {
  const { isBootstrapping, session, user } = useAuthSession();
  const eligibleHabitsQuery = useEligibleHabitsQuery();
  const upcomingHabitsQuery = useUpcomingActiveHabitsQuery();
  const onboardingCompletedQuery = useIsOnboardingCompletedQuery();
  const queryClient = useQueryClient();

  // One-time backfill: existing accounts that have habits but no completion mark.
  useEffect(() => {
    const hasHabits =
      (eligibleHabitsQuery.data ?? []).length > 0 ||
      (upcomingHabitsQuery.data ?? []).length > 0;
    const completed = onboardingCompletedQuery.data;

    if (
      user?.id &&
      eligibleHabitsQuery.isSuccess &&
      upcomingHabitsQuery.isSuccess &&
      onboardingCompletedQuery.isSuccess &&
      hasHabits &&
      completed === false
    ) {
      markOnboardingCompleted(user.id)
        .then(() => {
          logger.info("Backfilled onboarding completion for existing account");
          void queryClient.invalidateQueries({
            queryKey: getIsOnboardingCompletedQueryKey(user.id),
          });
        })
        .catch((error: unknown) => {
          logger.warn("Failed to backfill onboarding completion", { error });
        });
    }
  }, [
    user?.id,
    eligibleHabitsQuery.isSuccess,
    eligibleHabitsQuery.data,
    upcomingHabitsQuery.isSuccess,
    upcomingHabitsQuery.data,
    onboardingCompletedQuery.isSuccess,
    onboardingCompletedQuery.data,
    queryClient,
  ]);

  if (isBootstrapping) {
    return <LoadingState message="Checking your session..." />;
  }

  if (!session) {
    return <WelcomeScreen />;
  }

  if (
    eligibleHabitsQuery.isLoading ||
    upcomingHabitsQuery.isLoading ||
    onboardingCompletedQuery.isLoading
  ) {
    return <LoadingState message="Loading your habits..." />;
  }

  if (
    eligibleHabitsQuery.error ||
    upcomingHabitsQuery.error ||
    onboardingCompletedQuery.error
  ) {
    return <ErrorState message={getLoadHabitsErrorMessage()} />;
  }

  const hasHabits =
    (eligibleHabitsQuery.data ?? []).length > 0 ||
    (upcomingHabitsQuery.data ?? []).length > 0;

  if (hasHabits) {
    return <Redirect href="/(app)/(tabs)/today" />;
  }

  if (onboardingCompletedQuery.data === true) {
    return <Redirect href="/(app)/habits/create" />;
  }

  return <Redirect href="/(onboarding)" />;
}
