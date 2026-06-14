import type { AccessMode } from "@/features/trial/types";
import { ReadOnlyBanner } from "@/components/ReadOnlyBanner";

type Props = {
  accessMode: AccessMode;
  isReconnecting: boolean;
  onReconnect: () => void;
};

/**
 * Surfaces the offline "you can't mutate right now" banner. Only fires for
 * `read_only` (offline cache too stale). `expired_no_purchase` is owned by
 * the paywall: over-cap users get the app-shell hard-block, resolved
 * free-tier users get per-action "Unlock to…" affordances — neither wants
 * a "Reconnect" banner.
 */
export function AccessGateBanner({ accessMode, isReconnecting, onReconnect }: Props) {
  if (accessMode !== "read_only") return null;
  return <ReadOnlyBanner isReconnecting={isReconnecting} onReconnect={onReconnect} />;
}
