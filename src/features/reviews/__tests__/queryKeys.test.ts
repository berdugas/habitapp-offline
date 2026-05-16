import { getGoalReviewStatusQueryKey } from "@/features/reviews/queryKeys";
import { getGoalWeekSummaryQueryKey } from "@/features/reviews/useGoalWeekSummary";

describe("review query keys include todayDate", () => {
  it("getGoalReviewStatusQueryKey produces different keys for different todayDate values", () => {
    const a = getGoalReviewStatusQueryKey(
      "u1",
      "stoic",
      "2026-04-27",
      "2026-04-30",
    );
    const b = getGoalReviewStatusQueryKey(
      "u1",
      "stoic",
      "2026-04-27",
      "2026-05-01",
    );
    // If todayDate weren't in the key, these would be deep-equal and React
    // Query would serve a stale cached value across the day boundary.
    expect(a).not.toEqual(b);
  });

  it("getGoalWeekSummaryQueryKey produces different keys for different todayDate values", () => {
    const a = getGoalWeekSummaryQueryKey(
      "u1",
      "stoic",
      "2026-04-27",
      "2026-04-30",
    );
    const b = getGoalWeekSummaryQueryKey(
      "u1",
      "stoic",
      "2026-04-27",
      "2026-05-01",
    );
    expect(a).not.toEqual(b);
  });

  it("save-flow invalidation prefix ['reviews', 'goal-status'] still matches the longer key", () => {
    // Sanity: the screen invalidates by prefix. Adding todayDate must not
    // break that match.
    const key = getGoalReviewStatusQueryKey(
      "u1",
      "stoic",
      "2026-04-27",
      "2026-04-30",
    );
    expect(key.slice(0, 2)).toEqual(["reviews", "goal-status"]);
  });
});
