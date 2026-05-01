import { getStoredJson, removeStoredItem, setStoredJson } from "@/lib/storage";
import { storageKeys } from "@/lib/storage/keys";

import type { CachedTrialEntitlement } from "@/features/trial/types";

export async function readCachedEntitlement(): Promise<CachedTrialEntitlement | null> {
  return getStoredJson<CachedTrialEntitlement | null>(
    storageKeys.trialEntitlement,
    null,
  );
}

export async function writeCachedEntitlement(
  entitlement: CachedTrialEntitlement,
): Promise<void> {
  await setStoredJson(storageKeys.trialEntitlement, entitlement);
}

export async function clearCachedEntitlement(): Promise<void> {
  await removeStoredItem(storageKeys.trialEntitlement);
}
