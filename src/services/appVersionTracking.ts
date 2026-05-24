import AsyncStorage from "@react-native-async-storage/async-storage";
import Constants from "expo-constants";

import { trackEvent } from "@/services/analytics";
import { logger } from "@/services/logger";

// AsyncStorage key for the last app version observed on this device.
// Prefixed `app:` so the namespace stays grouped with other app-level
// flags (vs. per-habit / per-user keys which use other prefixes).
const LAST_SEEN_VERSION_KEY = "app:lastSeenVersion";

/**
 * Detects an app-version upgrade on launch and fires
 * `app_version_upgraded { reason }` when the current binary's version
 * differs from the last value persisted in AsyncStorage. The `reason`
 * key carries a "v{previous}->v{current}" string so funnels can bucket
 * upgrades by source/target without leaking other context.
 *
 * Semantics:
 * - First launch ever (no stored value): write but do NOT fire.
 *   First-launch funnels are owned by onboarding_step_viewed / app
 *   lifecycle, not by this signal.
 * - Same version (most launches): no-op.
 * - Different version: fire the event, then update the stored value.
 *
 * Best-effort: never throws. Storage failures are logged via
 * logger.warn — they won't crash the launch path. Caller fires-and-forgets.
 */
export async function checkAndTrackVersionUpgrade(): Promise<void> {
  const current = Constants.expoConfig?.version;
  if (typeof current !== "string" || current.length === 0) return;

  try {
    const previous = await AsyncStorage.getItem(LAST_SEEN_VERSION_KEY);
    if (previous && previous !== current) {
      // Only ship the version pair under `reason` (allowlisted key);
      // separate from/to keys aren't on the allowlist and would
      // redact. Format keeps both ends visible for segment queries.
      trackEvent("app_version_upgraded", {
        reason: `v${previous}->v${current}`,
      });
    }
    if (previous !== current) {
      await AsyncStorage.setItem(LAST_SEEN_VERSION_KEY, current);
    }
  } catch (err) {
    logger.warn("checkAndTrackVersionUpgrade: storage failed", { err });
  }
}
