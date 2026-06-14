import { useEffect, useState } from "react";

import { getStoredItem, setStoredItem } from "@/lib/storage";
import { useTrialValidation } from "@/features/trial/hooks";
import { now } from "@/utils/clock";

import type { TrialEntitlementStatus } from "@/features/trial/types";

const STORAGE_KEY = "paywall_banner_dismissed_at";
const WINDOW_MS = 48 * 60 * 60 * 1000;

export function endingBannerKey(trialEndsAt: string): string {
  return trialEndsAt;
}

export function shouldShowEndingBanner(input: {
  status: TrialEntitlementStatus | null;
  trialEndsAt: string | null;
  now: Date;
  dismissedKey: string | null;
}): boolean {
  const { status, trialEndsAt, now: current, dismissedKey } = input;
  if (status !== "trial" || !trialEndsAt) return false;
  const ends = new Date(trialEndsAt);
  if (Number.isNaN(ends.getTime())) return false;
  const msLeft = ends.getTime() - current.getTime();
  if (msLeft <= 0 || msLeft > WINDOW_MS) return false;
  if (dismissedKey === endingBannerKey(trialEndsAt)) return false;
  return true;
}

/**
 * Returns { visible, dismiss }. Reads persisted dismissal once on mount, then
 * computes visibility. Once dismissed (or hidden) within a session it never
 * re-shows that session (the in-memory sessionHidden latch).
 */
export function useTrialEndingBanner() {
  const { entitlementStatus, trialEndsAt } = useTrialValidation();
  const [dismissedKey, setDismissedKey] = useState<string | null>(null);
  const [loaded, setLoaded] = useState(false);
  const [sessionHidden, setSessionHidden] = useState(false);

  useEffect(() => {
    let active = true;
    getStoredItem(STORAGE_KEY).then((v) => {
      if (active) {
        setDismissedKey(v);
        setLoaded(true);
      }
    });
    return () => {
      active = false;
    };
  }, []);

  const visible =
    loaded &&
    !sessionHidden &&
    shouldShowEndingBanner({ status: entitlementStatus, trialEndsAt, now: now(), dismissedKey });

  async function dismiss() {
    setSessionHidden(true);
    if (trialEndsAt) {
      await setStoredItem(STORAGE_KEY, endingBannerKey(trialEndsAt));
    }
  }

  return { visible, dismiss };
}
