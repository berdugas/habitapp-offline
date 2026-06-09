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
  // RPC is the single source of truth: it self-heals the row if missing
  // AND flips trial -> expired if trial_ends_at has passed. Server-side
  // gating on auth.uid() means the userId arg here is for logging only —
  // the RPC always operates on the authenticated user's row.
  const { data, error } = await supabase
    .rpc("ensure_trial_entitlement")
    .single<TrialEntitlementRow>();

  if (error) {
    logger.error("Trial entitlement RPC failed", { error, userId });
    throw new TrialEntitlementFetchError(
      "Could not reach the server to verify your account.",
      "network",
    );
  }

  if (!data) {
    logger.error("Trial entitlement RPC returned no row", { userId });
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
    logger.error("Trial entitlement returned unknown status", {
      status: data.entitlement_status,
      userId,
    });
    throw new TrialEntitlementFetchError(
      "Account is in an unexpected state.",
      "invalid_status",
    );
  }

  return {
    user_id: data.user_id,
    trial_started_at: data.trial_started_at,
    trial_ends_at: data.trial_ends_at,
    entitlement_status: data.entitlement_status as TrialEntitlementStatus,
    // The server's last_validated_at column is informational only
    // (see 0005_core_v1_local_first_pivot.sql:78-79); the client is
    // authoritative on its own grace-period bookkeeping. Always stamp
    // the device clock here, never the server's value.
    last_validated_at: nowIso(),
  };
}
