import { TRIAL_GRACE_PERIOD_DAYS } from "@/features/trial/types";
import type { AccessMode, ComputeAccessModeInput } from "@/features/trial/types";

export function computeAccessMode({
  lastValidatedAt,
  entitlementStatus,
  trialEndsAt,
  now,
}: ComputeAccessModeInput): AccessMode {
  // Branch 1: paid / active users get full offline access, no gating on
  // staleness. `active` is a dead-in-current-code enum value (no row has it),
  // but if subscriptions are ever added, an `active` subscriber should not
  // be staleness-gated. Treating it like `paid` here is defensive.
  // TODO(paywall sub-plan): consider splitting `active` from `paid` if
  // subscription semantics ever matter (RevenueCat-style "currently in a
  // paying period that will renew" vs lifetime/one-time).
  if (entitlementStatus === "paid" || entitlementStatus === "active") {
    return "full";
  }

  // Branch 2: server explicitly marked the row expired or cancelled.
  // `cancelled` is also dead in current code; defensive treatment as
  // "no longer paying" matches the natural read.
  if (entitlementStatus === "expired" || entitlementStatus === "cancelled") {
    return "expired_no_purchase";
  }

  // Branch 3: client-side guard. Even if the cached status still says
  // "trial", trust the device clock once trial_ends_at is in the past.
  // Catches the case where the server hasn't been re-fetched recently.
  if (entitlementStatus === "trial" && trialEndsAt) {
    const trialEnd = new Date(trialEndsAt);
    if (!Number.isNaN(trialEnd.getTime()) && now.getTime() > trialEnd.getTime()) {
      return "expired_no_purchase";
    }
  }

  // Branch 4: existing staleness logic. (D4) invariant: no cache → read_only.
  // Reached when entitlementStatus is undefined (caller hasn't been updated
  // yet — pre-Task-6 state) OR is `trial` with future trial_ends_at OR null.
  if (lastValidatedAt === null) {
    return "read_only";
  }

  const lastValidated = new Date(lastValidatedAt);

  // Defensive: malformed ISO string parses to Invalid Date.
  if (Number.isNaN(lastValidated.getTime())) {
    return "read_only";
  }

  const ageMs = now.getTime() - lastValidated.getTime();
  const graceMs = TRIAL_GRACE_PERIOD_DAYS * 24 * 60 * 60 * 1000;

  // ageMs <= graceMs → still in grace → full access.
  return ageMs <= graceMs ? "full" : "read_only";
}
