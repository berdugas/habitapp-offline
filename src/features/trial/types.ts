export type TrialEntitlementStatus =
  | "trial"
  | "active"
  | "expired"
  | "paid"
  | "cancelled";

export const TRIAL_ENTITLEMENT_STATUSES: TrialEntitlementStatus[] = [
  "trial",
  "active",
  "expired",
  "paid",
  "cancelled",
];

export type CachedTrialEntitlement = {
  user_id: string;
  trial_started_at: string;
  trial_ends_at: string;
  entitlement_status: TrialEntitlementStatus;
  last_validated_at: string;
};

export type AccessMode = "full" | "read_only" | "expired_no_purchase";

// Trial users get a 14-day offline staleness grace; paid users bypass
// staleness entirely (grace.ts Branch 1). Worst-case adversarial offline
// window is 14 trial + 14 grace = 28 days before fail-closed read_only.
export const TRIAL_GRACE_PERIOD_DAYS = 14;

export const TRIAL_REVALIDATION_STALENESS_MINUTES = 60;

// Inputs to computeAccessMode. Lives here rather than in grace.ts so the
// trial context provider can build it without importing the function.
//
// entitlementStatus + trialEndsAt are optional so that the pre-existing
// buildTrialContextValue caller (and any future test fixture) continues
// to typecheck during the intermediate commits before Task 6 wires them
// up. When undefined, computeAccessMode behaves identically to its old
// staleness-only logic.
export type ComputeAccessModeInput = {
  lastValidatedAt: string | null;
  entitlementStatus?: TrialEntitlementStatus | null;
  trialEndsAt?: string | null;
  now: Date;
};
