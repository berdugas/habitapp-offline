import type { AccessMode } from "@/features/trial/types";

/**
 * Centralized check for "should this screen disable mutations?".
 *
 * Returns true for both `read_only` (offline cache too stale) and
 * `expired_no_purchase` (trial ended, user hasn't paid) so screens can
 * uniformly disable mutations and forms.
 *
 * Banner copy and CTA differ between the two states — see AccessGateBanner
 * in src/features/trial/. The paywall sub-plan replaces AccessGateBanner's
 * expired-no-purchase branch with an app-shell paywall mount.
 */
export function isReadOnly(mode: AccessMode): boolean {
  return mode === "read_only" || mode === "expired_no_purchase";
}
