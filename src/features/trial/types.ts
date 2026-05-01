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

export type AccessMode = "full" | "read_only";

export const TRIAL_GRACE_PERIOD_DAYS = 7;

export const TRIAL_REVALIDATION_STALENESS_MINUTES = 60;
