import { useEffect } from "react";
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
  useEffect(() => {
    let active = true;
    async function sync() {
      const stored = await getStoredItem(SCHEDULED_KEY);

      if (entitlementStatus !== "trial") {
        if (stored) {
          const [, notifId] = stored.split("|");
          if (notifId) {
            await Notifications.cancelScheduledNotificationAsync(notifId).catch(() => {});
          }
          await setStoredItem(SCHEDULED_KEY, "");
        }
        return;
      }

      if (!trialEndsAt) return;
      if (stored && stored.startsWith(`${trialEndsAt}|`)) return;

      const fire = computeNotificationFireDate(trialEndsAt, now());
      if (!fire) return;

      const perms = await Notifications.getPermissionsAsync();
      if (perms.status !== "granted") return; // no prompt — banner covers it

      try {
        const id = await Notifications.scheduleNotificationAsync({
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
        if (active) await setStoredItem(SCHEDULED_KEY, `${trialEndsAt}|${id}`);
      } catch (err) {
        logger.warn("Failed to schedule trial-ending notification", { err });
      }
    }
    void sync();
    return () => {
      active = false;
    };
  }, [entitlementStatus, trialEndsAt]);
}
