import { supabase } from "@/lib/supabase/client";
import { logger } from "@/services/logger";
import { nowIso } from "@/utils/clock";

import type {
  CachedTrialEntitlement,
  TrialEntitlementStatus,
} from "@/features/trial/types";
import { TRIAL_ENTITLEMENT_STATUSES } from "@/features/trial/types";

type TrialEntitlementRow = {
  user_id: string;
  trial_started_at: string;
  trial_ends_at: string;
  entitlement_status: string;
  last_validated_at: string | null;
};

export class TrialEntitlementFetchError extends Error {
  constructor(
    message: string,
    public reason: "network" | "missing_row" | "invalid_status" | "unknown",
  ) {
    super(message);
    this.name = "TrialEntitlementFetchError";
  }
}

export async function fetchTrialEntitlement(
  userId: string,
): Promise<CachedTrialEntitlement> {
  const { data, error } = await supabase
    .from("trial_entitlements")
    .select(
      "user_id, trial_started_at, trial_ends_at, entitlement_status, last_validated_at",
    )
    .eq("user_id", userId)
    .maybeSingle<TrialEntitlementRow>();

  if (error) {
    logger.error("Trial entitlement fetch failed", { error, userId });
    throw new TrialEntitlementFetchError(
      "Could not reach the server to verify your account.",
      "network",
    );
  }

  if (!data) {
    logger.error("Trial entitlement row missing for user", { userId });
    throw new TrialEntitlementFetchError(
      "Account is missing trial entitlement record.",
      "missing_row",
    );
  }

  if (
    !TRIAL_ENTITLEMENT_STATUSES.includes(
      data.entitlement_status as TrialEntitlementStatus,
    )
  ) {
    logger.error("Trial entitlement returned invalid status", {
      status: data.entitlement_status,
      userId,
    });
    throw new TrialEntitlementFetchError(
      "Account returned unrecognized status.",
      "invalid_status",
    );
  }

  // server's last_validated_at is informational; device records its own timestamp
  return {
    user_id: data.user_id,
    trial_started_at: data.trial_started_at,
    trial_ends_at: data.trial_ends_at,
    entitlement_status: data.entitlement_status as TrialEntitlementStatus,
    last_validated_at: nowIso(),
  };
}
