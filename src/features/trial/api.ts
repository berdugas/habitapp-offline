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

  // Self-heal: if the handle_new_user trigger from migration 0005 didn't
  // produce a row for this user (silent failure observed in one iOS beta
  // tester), call the ensure_trial_entitlement RPC to lazily create one
  // and retry. The RPC is idempotent (ON CONFLICT DO NOTHING) and gated
  // on auth.uid(), so clients can't impersonate other users.
  let row = data;
  if (!row) {
    logger.warn(
      "Trial entitlement row missing — calling ensure_trial_entitlement",
      { userId },
    );
    const { data: healed, error: healError } = await supabase
      .rpc("ensure_trial_entitlement")
      .single<TrialEntitlementRow>();

    if (healError) {
      logger.error("Trial entitlement self-heal RPC failed", {
        healError,
        userId,
      });
      // Reused "network" reason because the existing taxonomy lacks an
      // "rpc_failure" slot and hooks.tsx doesn't branch on reason.
      throw new TrialEntitlementFetchError(
        "Could not provision your account. Please try again.",
        "network",
      );
    }
    if (!healed) {
      logger.error("Trial entitlement self-heal returned no row", { userId });
      throw new TrialEntitlementFetchError(
        "Account is missing trial entitlement record.",
        "missing_row",
      );
    }
    row = healed;
  }

  if (
    !TRIAL_ENTITLEMENT_STATUSES.includes(
      row.entitlement_status as TrialEntitlementStatus,
    )
  ) {
    logger.error("Trial entitlement returned invalid status", {
      status: row.entitlement_status,
      userId,
    });
    throw new TrialEntitlementFetchError(
      "Account returned unrecognized status.",
      "invalid_status",
    );
  }

  // server's last_validated_at is informational; device records its own timestamp
  return {
    user_id: row.user_id,
    trial_started_at: row.trial_started_at,
    trial_ends_at: row.trial_ends_at,
    entitlement_status: row.entitlement_status as TrialEntitlementStatus,
    last_validated_at: nowIso(),
  };
}
