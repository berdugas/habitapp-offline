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

// 90 days is a beta safety net. Once we ship entitlement-aware access
// (status-based gating for paid vs trial vs expired), revisit this value
// — it should likely drop back toward 7-14 days for trial users while
// paid users stop being gated on staleness at all.
export const TRIAL_GRACE_PERIOD_DAYS = 90;

export const TRIAL_REVALIDATION_STALENESS_MINUTES = 60;
