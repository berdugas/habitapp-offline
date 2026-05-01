import { TRIAL_GRACE_PERIOD_DAYS } from "@/features/trial/types";
import type { AccessMode } from "@/features/trial/types";

export type ComputeAccessModeInput = {
  lastValidatedAt: string | null;
  now: Date;
};

export function computeAccessMode({
  lastValidatedAt,
  now,
}: ComputeAccessModeInput): AccessMode {
  // (D4) Strict invariant: no cache → read_only.
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
  // Matches isWithinRetroWindow's <= comparator for codebase consistency.
  return ageMs <= graceMs ? "full" : "read_only";
}
