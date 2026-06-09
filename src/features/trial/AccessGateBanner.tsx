import { ReadOnlyBanner } from "@/components/ReadOnlyBanner";
import { TrialEndedBanner } from "@/features/trial/TrialEndedBanner";

import type { AccessMode } from "@/features/trial/types";

type Props = {
  accessMode: AccessMode;
  isReconnecting: boolean;
  onReconnect: () => void;
};

/**
 * Picks the right banner for the current access mode.
 *
 * - `full`: render nothing (caller doesn't need to gate on this).
 * - `read_only`: stale offline cache — show ReadOnlyBanner with a working
 *   "Reconnect" button.
 * - `expired_no_purchase`: trial ended — show TrialEndedBanner with NO
 *   action button. (See TrialEndedBanner for the rationale.)
 *
 * The paywall sub-plan replaces the `expired_no_purchase` branch with an
 * app-shell paywall mount, at which point this component shrinks back to
 * a thin wrapper around ReadOnlyBanner.
 */
export function AccessGateBanner({ accessMode, isReconnecting, onReconnect }: Props) {
  if (accessMode === "full") return null;
  if (accessMode === "expired_no_purchase") return <TrialEndedBanner />;
  // accessMode === "read_only" — stale cache, original behavior.
  return <ReadOnlyBanner isReconnecting={isReconnecting} onReconnect={onReconnect} />;
}
