import type { AccessMode } from "@/features/trial/types";
import { ReadOnlyBanner } from "@/components/ReadOnlyBanner";

type Props = {
  accessMode: AccessMode;
  isReconnecting: boolean;
  onReconnect: () => void;
};

/**
 * Single insertion point for screens that need to surface a "you can't
 * mutate right now" banner. Today renders ReadOnlyBanner for both
 * `read_only` and `expired_no_purchase` — matches sub-plan 1's contract
 * of "no user-facing behavior change for the new state." The paywall
 * sub-plan replaces the `expired_no_purchase` branch with an app-shell
 * paywall mount; consumers don't need a second migration when that lands.
 */
export function AccessGateBanner({ accessMode, isReconnecting, onReconnect }: Props) {
  if (accessMode === "full") return null;
  return <ReadOnlyBanner isReconnecting={isReconnecting} onReconnect={onReconnect} />;
}
