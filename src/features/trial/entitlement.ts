import type { TrialEntitlementStatus } from "@/features/trial/types";

/**
 * Single source of truth for "is this entitlement status one that means
 * the user is currently paying (or paid-equivalent)?"
 *
 * Today: `"paid"` (one-time lifetime) and `"active"` (defensive — dead
 * value today, but if subscriptions ever land an active subscriber should
 * not be capped). Future grandfathering or subscription tier work updates
 * this single helper instead of hunting for duplicated string comparisons.
 */
export function isPaidStatus(status: TrialEntitlementStatus | null): boolean {
  return status === "paid" || status === "active";
}
