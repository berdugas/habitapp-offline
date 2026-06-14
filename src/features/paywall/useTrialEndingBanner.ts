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
    getStoredItem(STORAGE_KEY)
      .then((v) => {
        if (active) {
          setDismissedKey(v);
          setLoaded(true);
        }
      })
      .catch(() => {
        // Storage read failed — treat as "no dismissal recorded" and still mark
        // loaded, so a storage glitch can't leave the banner permanently
        // unloaded (visible stays false while !loaded). Fail open: showing the
        // reminder is the safe outcome for a non-blocking banner.
        if (active) setLoaded(true);
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
    // In-memory latch hides it this session regardless of persistence.
    setSessionHidden(true);
    if (trialEndsAt) {
      try {
        await setStoredItem(STORAGE_KEY, endingBannerKey(trialEndsAt));
      } catch {
        // Persisting the dismissal failed — the sessionHidden latch still hides
        // it this session; it may re-show on a future launch, which is
        // acceptable. Never let this escape as an unhandled rejection (dismiss
        // is invoked fire-and-forget).
      }
    }
  }

  return { visible, dismiss };
}
