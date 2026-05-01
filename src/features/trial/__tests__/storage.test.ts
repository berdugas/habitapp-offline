jest.mock(
  "@react-native-async-storage/async-storage",
  () => require("@react-native-async-storage/async-storage/jest/async-storage-mock"),
);

import AsyncStorage from "@react-native-async-storage/async-storage";

import {
  clearCachedEntitlement,
  readCachedEntitlement,
  writeCachedEntitlement,
} from "@/features/trial/storage";

import type { CachedTrialEntitlement } from "@/features/trial/types";

const sampleEntitlement: CachedTrialEntitlement = {
  user_id: "user-1",
  trial_started_at: "2026-04-15T00:00:00.000Z",
  trial_ends_at: "2026-04-29T00:00:00.000Z",
  entitlement_status: "trial",
  last_validated_at: "2026-05-01T00:00:00.000Z",
};

describe("trial storage", () => {
  beforeEach(async () => {
    await AsyncStorage.clear();
  });

  it("returns null when no entitlement is cached", async () => {
    expect(await readCachedEntitlement()).toBeNull();
  });

  it("round-trips a cached entitlement", async () => {
    await writeCachedEntitlement(sampleEntitlement);
    const result = await readCachedEntitlement();
    expect(result).toEqual(sampleEntitlement);
  });

  it("clearCachedEntitlement removes the cache", async () => {
    await writeCachedEntitlement(sampleEntitlement);
    await clearCachedEntitlement();
    expect(await readCachedEntitlement()).toBeNull();
  });

  it("returns null when cache is corrupt JSON", async () => {
    await AsyncStorage.setItem("habits.trial.entitlement", "{not-valid-json");
    expect(await readCachedEntitlement()).toBeNull();
  });

  it("overwrites an existing cache on second write", async () => {
    await writeCachedEntitlement(sampleEntitlement);
    const updated: CachedTrialEntitlement = {
      ...sampleEntitlement,
      entitlement_status: "expired",
    };
    await writeCachedEntitlement(updated);
    const result = await readCachedEntitlement();
    expect(result?.entitlement_status).toBe("expired");
  });
});
