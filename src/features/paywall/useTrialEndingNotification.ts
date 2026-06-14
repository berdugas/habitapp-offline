import { useEffect, useRef } from "react";
import * as Notifications from "expo-notifications";

import { getStoredItem, setStoredItem } from "@/lib/storage";
import { now } from "@/utils/clock";
import { logger } from "@/services/logger";

import type { TrialEntitlementStatus } from "@/features/trial/types";

const SCHEDULED_KEY = "paywall_ending_notif"; // stores `${trialEndsAt}|${notifId}`
const LEAD_MS = 48 * 60 * 60 * 1000;

export function computeNotificationFireDate(trialEndsAt: string, current: Date): Date | null {
  const ends = new Date(trialEndsAt);
  if (Number.isNaN(ends.getTime())) return null;
  const fire = new Date(ends.getTime() - LEAD_MS);
  if (fire.getTime() <= current.getTime()) return null;
  return fire;
}

/**
 * Schedules a single "trial ends in 2 days" local notification, once per trial
 * window, only if notification permission is ALREADY granted (no prompt — the
 * in-app banner is the guaranteed fallback). Cancels a stale scheduled
 * notification when the user becomes paid/non-trial.
 *
 * Takes entitlement data as ARGS (not via useTrialValidation()) so it can mount
 * in TrialValidationBootstrap, whose body runs OUTSIDE the trial context.
 */
export function useTrialEndingNotification(
  entitlementStatus: TrialEntitlementStatus | null,
  trialEndsAt: string | null,
): void {
  // Serialize every sync() run through one chain (anchored on a ref — this hook
  // is a singleton, mounted once in TrialValidationBootstrap). Two effect runs
  // must never interleave their reads/writes of the singleton storage key: a
  // superseded effect's in-flight write could otherwise land AFTER a newer
  // effect's and leave the current notification untracked. The active checks
  // make a superseded run bail, but they can't revoke an already-started write.
  const syncChainRef = useRef<Promise<void>>(Promise.resolve());

  useEffect(() => {
    let active = true;
    async function sync() {
      const stored = await getStoredItem(SCHEDULED_KEY);
      // Superseded during the read (deps changed) — a newer effect re-reads the
      // same state and handles it. Bail before mutating shared notification /
      // storage state so we can't clobber what the newer effect committed.
      if (!active) return;

      if (entitlementStatus !== "trial") {
        if (stored) {
          const [, notifId] = stored.split("|");
          if (notifId) {
            await Notifications.cancelScheduledNotificationAsync(notifId).catch(() => {});
          }
          // A newer effect may have scheduled + stored a notification after our
          // read; if we were superseded mid-cancel, clearing storage now would
          // orphan ITS id. Re-check ownership before the clear.
          if (!active) return;
          await setStoredItem(SCHEDULED_KEY, "");
        }
        return;
      }

      if (!trialEndsAt) return;
      if (stored && stored.startsWith(`${trialEndsAt}|`)) return;

      // A stored id for a DIFFERENT trial window (a trial extension, or a switch
      // between two trial accounts sharing this device-global key) must be
      // cancelled before we schedule its replacement — otherwise the old
      // window's reminder is orphaned and still fires.
      if (stored) {
        const [, oldId] = stored.split("|");
        if (oldId) {
          await Notifications.cancelScheduledNotificationAsync(oldId).catch(() => {});
        }
      }

      const fire = computeNotificationFireDate(trialEndsAt, now());
      if (!fire) return;

      let perms;
      try {
        perms = await Notifications.getPermissionsAsync();
      } catch (err) {
        // Notifications module unavailable (or rejected) — fail safe and skip
        // scheduling; the in-app banner is the guaranteed fallback.
        logger.warn("Failed to read notification permissions", { err });
        return;
      }
      if (perms?.status !== "granted") return; // no prompt — banner covers it

      // Cleanup may have raced the permissions await — don't schedule for a
      // superseded effect (account/status changed).
      if (!active) return;

      let id: string;
      try {
        id = await Notifications.scheduleNotificationAsync({
          content: {
            title: "Your trial is ending",
            body: "Your free trial ends in 2 days. Unlock anytime for $1.99.",
            data: { type: "trial_ending" },
          },
          trigger: {
            type: Notifications.SchedulableTriggerInputTypes.DATE,
            date: fire,
          },
        });
      } catch (err) {
        logger.warn("Failed to schedule trial-ending notification", { err });
        return;
      }

      // A notification IS now scheduled. We MUST either persist its id (so a
      // later effect can find + cancel it) or cancel it ourselves — never leave
      // it scheduled-but-untracked.
      if (!active) {
        // Cleanup raced the scheduling itself — we can't store this id, so a
        // replacement effect couldn't cancel it. Cancel the orphan now.
        await Notifications.cancelScheduledNotificationAsync(id).catch(() => {});
        return;
      }

      try {
        await setStoredItem(SCHEDULED_KEY, `${trialEndsAt}|${id}`);
      } catch (err) {
        // Scheduled but persistence failed → the id would be untracked and
        // could never be cancelled. Cancel it now rather than orphan it.
        logger.warn("Failed to persist trial-ending notification id; cancelling", {
          err,
        });
        await Notifications.cancelScheduledNotificationAsync(id).catch(() => {});
      }
    }
    // Queue behind any prior run's in-flight sync (serialization), and catch the
    // WHOLE operation so a storage rejection from the read or the non-trial
    // clear can't escape this fire-and-forget call as an unhandled rejection —
    // fail safe; the in-app banner is the guaranteed fallback.
    syncChainRef.current = syncChainRef.current
      .then(() => sync())
      .catch((err) => {
        logger.warn("Trial-ending notification sync failed", { err });
      });
    return () => {
      active = false;
    };
  }, [entitlementStatus, trialEndsAt]);
}
