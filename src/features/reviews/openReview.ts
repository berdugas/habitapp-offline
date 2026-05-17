import { router } from "expo-router";

import { isWeeklyReviewIntroSeen } from "@/features/reviews/onboardingStorage";
import {
  goalReviewRoute,
  weeklyReviewIntroRoute,
  type ReturnTo,
} from "@/features/reviews/reviewRoutes";
import { logger } from "@/services/logger";

let isOpening = false;

export async function openGoalWeeklyReview(opts: {
  identityPhrase: string;
  returnTo: ReturnTo;
}): Promise<void> {
  if (isOpening) return;
  isOpening = true;
  try {
    let introSeen: boolean;
    try {
      introSeen = await isWeeklyReviewIntroSeen();
    } catch (err) {
      logger.warn(
        "openGoalWeeklyReview: intro-seen read failed; falling back to review",
        { err },
      );
      introSeen = true;
    }
    router.push(
      introSeen
        ? goalReviewRoute(opts.identityPhrase, opts.returnTo)
        : weeklyReviewIntroRoute(opts.identityPhrase, opts.returnTo),
    );
  } finally {
    queueMicrotask(() => {
      isOpening = false;
    });
  }
}
