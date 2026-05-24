// AsyncStorage is auto-mocked via __mocks__/@react-native-async-storage/
// async-storage.ts (which delegates to the package's official in-memory
// mock). No per-test jest.mock() needed.

import AsyncStorage from "@react-native-async-storage/async-storage";

import {
  __resetForTests,
  goalIdFor,
  initGoalIdRegistry,
} from "@/services/goalIdRegistry";

const STORAGE_KEY = "analytics:goalIdMap";

beforeEach(async () => {
  await AsyncStorage.clear();
  __resetForTests();
});

describe("goalIdFor (pre-init / session-local mode)", () => {
  it("returns an 8-character hex id for a new phrase", () => {
    const id = goalIdFor("become a runner");
    expect(id).toMatch(/^[0-9a-f]{8}$/);
  });

  it("returns the same id for the same phrase within a session", () => {
    const a = goalIdFor("become a runner");
    const b = goalIdFor("become a runner");
    expect(a).toBe(b);
  });

  it("returns distinct ids for distinct phrases", () => {
    const a = goalIdFor("become a runner");
    const b = goalIdFor("become a writer");
    expect(a).not.toBe(b);
  });

  it("treats whitespace and case as significant — no normalization", () => {
    // The goal mutations key on identity_phrase as-stored, so a leading
    // space or capitalization change is a different goal in the DB and
    // must yield a different id here.
    expect(goalIdFor("Become a runner")).not.toBe(goalIdFor("become a runner"));
    expect(goalIdFor(" become a runner")).not.toBe(goalIdFor("become a runner"));
  });

  it("session-local ids are not persisted to storage before init", async () => {
    goalIdFor("become a runner");
    const stored = await AsyncStorage.getItem(STORAGE_KEY);
    expect(stored).toBeNull();
  });
});

describe("initGoalIdRegistry merge + persistence", () => {
  it("loads previously-persisted ids and uses them for matching phrases", async () => {
    await AsyncStorage.setItem(
      STORAGE_KEY,
      JSON.stringify({ "become a runner": "cafef00d" }),
    );
    await initGoalIdRegistry();
    expect(goalIdFor("become a runner")).toBe("cafef00d");
  });

  it("session-local entries get promoted to persisted storage by init's merge", async () => {
    // Caller created an id before init had a chance to load storage.
    const sessionId = goalIdFor("become a runner");
    // Init runs (storage is empty). The session id should survive AND
    // get written to storage so future launches see the same id.
    await initGoalIdRegistry();
    const stored = await AsyncStorage.getItem(STORAGE_KEY);
    expect(stored).not.toBeNull();
    const parsed = JSON.parse(stored!) as Record<string, string>;
    expect(parsed["become a runner"]).toBe(sessionId);
  });

  it("stored entries win over session-local entries for the same phrase", async () => {
    // Pre-existing persisted id from an earlier session.
    await AsyncStorage.setItem(
      STORAGE_KEY,
      JSON.stringify({ "become a runner": "deadbeef" }),
    );
    // The user opens the app; before init runs, a goal mutation fires
    // and creates a session-local id for the same phrase.
    const sessionId = goalIdFor("become a runner");
    expect(sessionId).not.toBe("deadbeef");
    // Now init resolves. The stored id is authoritative — that's the
    // one PostHog has been seeing in prior sessions — so subsequent
    // goalIdFor calls return the stored id, not the session-local one.
    await initGoalIdRegistry();
    expect(goalIdFor("become a runner")).toBe("deadbeef");
  });

  it("a new phrase first seen post-init is persisted immediately", async () => {
    await initGoalIdRegistry();
    const id = goalIdFor("brand new phrase");
    // Persist is fire-and-forget; flush microtasks before reading.
    await new Promise((resolve) => setTimeout(resolve, 0));
    const stored = await AsyncStorage.getItem(STORAGE_KEY);
    expect(stored).not.toBeNull();
    const parsed = JSON.parse(stored!) as Record<string, string>;
    expect(parsed["brand new phrase"]).toBe(id);
  });

  it("init is idempotent", async () => {
    await AsyncStorage.setItem(
      STORAGE_KEY,
      JSON.stringify({ a: "11111111" }),
    );
    await initGoalIdRegistry();
    // Mutate storage out-of-band; second init should be a no-op so the
    // in-memory map still reflects the first load.
    await AsyncStorage.setItem(
      STORAGE_KEY,
      JSON.stringify({ a: "22222222" }),
    );
    await initGoalIdRegistry();
    expect(goalIdFor("a")).toBe("11111111");
  });
});
