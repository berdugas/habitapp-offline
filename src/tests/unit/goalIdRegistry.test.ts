// AsyncStorage is auto-mocked via __mocks__/@react-native-async-storage/
// async-storage.ts (which delegates to the package's official in-memory
// mock). No per-test jest.mock() needed.

import AsyncStorage from "@react-native-async-storage/async-storage";

import {
  __resetForTests,
  goalIdFor,
  initGoalIdRegistry,
  isGoalIdRegistryHydrated,
  whenGoalIdRegistryHydrated,
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

describe("hydration race safety", () => {
  it("pre-hydration goalIdFor writes do not clobber stored data when init is in flight", async () => {
    // Pre-existing persisted state.
    await AsyncStorage.setItem(
      STORAGE_KEY,
      JSON.stringify({ "phrase A": "stored1" }),
    );

    // Kick off init but do NOT await — this opens the race window:
    // hydrationPromise is set, hydrated is still false, AsyncStorage
    // .getItem is in flight. Pre-fix, the registry flipped its
    // `initialized` flag synchronously so persistMap was unblocked,
    // and the next goalIdFor call would persist a single-entry map
    // that erased "phrase A". Post-fix, persistMap is gated on the
    // separate `hydrated` flag and stays suppressed until merge runs.
    const initPromise = initGoalIdRegistry();
    expect(isGoalIdRegistryHydrated()).toBe(false);

    // Synchronous goalIdFor for a new phrase during the race window.
    const phraseBId = goalIdFor("phrase B");
    expect(phraseBId).toMatch(/^[0-9a-f]{8}$/);

    // Allow hydration to complete. The merge step preserves the
    // stored entry AND the session-local one.
    await initPromise;
    expect(isGoalIdRegistryHydrated()).toBe(true);

    const stored = await AsyncStorage.getItem(STORAGE_KEY);
    expect(stored).not.toBeNull();
    const parsed = JSON.parse(stored!) as Record<string, string>;
    expect(parsed["phrase A"]).toBe("stored1");
    expect(parsed["phrase B"]).toBe(phraseBId);
  });

  it("isGoalIdRegistryHydrated is false before init, false during, true after", async () => {
    expect(isGoalIdRegistryHydrated()).toBe(false);
    const initPromise = initGoalIdRegistry();
    expect(isGoalIdRegistryHydrated()).toBe(false);
    await initPromise;
    expect(isGoalIdRegistryHydrated()).toBe(true);
  });

  it("whenGoalIdRegistryHydrated resolves to the init promise once init has started", async () => {
    const initPromise = initGoalIdRegistry();
    const waitPromise = whenGoalIdRegistryHydrated();
    // Both await the same hydration; resolution must precede observing
    // hydrated=true (the init promise sets the flag inside its own
    // microtask before resolving, so awaiting waitPromise should be
    // observably equivalent).
    await waitPromise;
    expect(isGoalIdRegistryHydrated()).toBe(true);
    await initPromise; // already resolved; harmless
  });

  it("whenGoalIdRegistryHydrated resolves immediately when init was never called", async () => {
    // Tests / callers that haven't wired init shouldn't deadlock.
    await whenGoalIdRegistryHydrated();
    expect(isGoalIdRegistryHydrated()).toBe(false);
  });

  it("init is still idempotent after the Promise-based refactor", async () => {
    const first = initGoalIdRegistry();
    const second = initGoalIdRegistry();
    expect(first).toBe(second);
  });
});
