import type { AccessMode } from "@/features/trial/types";

/**
 * Centralized check for "should this screen disable mutations?".
 *
 * Returns true for both `read_only` (offline cache too stale) and
 * `expired_no_purchase` (trial ended, user hasn't paid). Sub-plan 1's
 * contract is that both states surface the same per-screen UI today —
 * see AccessGateBanner in src/features/trial/ for the banner-side of
 * that contract.
 *
 * After the paywall sub-plan ships, `expired_no_purchase` will be caught
 * by an app-shell handler before any screen renders, so this helper will
 * only ever see `read_only` in practice. The shape stays the same so
 * consumers don't need a second migration.
 */
export function isReadOnly(mode: AccessMode): boolean {
  return mode === "read_only" || mode === "expired_no_purchase";
}
