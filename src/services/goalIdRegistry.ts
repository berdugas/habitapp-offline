import AsyncStorage from "@react-native-async-storage/async-storage";

// Local pseudonymous goal-id registry. Maps each user-typed identityPhrase
// to a random 8-char hex id that never depends on the phrase's content.
//
// Why this exists: goal mutations and screen-view enrichments need a stable
// per-goal identifier that can ship to PostHog without leaking the goal's
// text. An earlier draft hashed the phrase with unsalted FNV-1a, but a
// 32-bit non-cryptographic hash of user-entered content is trivially
// dictionary-attackable for common phrases AND collides across users for
// the same phrase. A persisted random id has neither property: an
// attacker with PostHog data and a list of common goal phrases cannot
// derive the goal_id without per-device storage access, and the same
// phrase from two different devices produces two different ids (no
// cross-user correlation buckets).
//
// Threat model and limits:
// - Defends against: PostHog data leak revealing user goals; cross-user
//   correlation via shared goal phrases.
// - Does NOT defend against: device compromise (the AsyncStorage value
//   is readable by anyone with filesystem access); user-side correlation
//   between a session that ships goal_id=X and a separate observation
//   that the same session also ships identifying screen names. The
//   goal_id is a pseudonym, not an anonymizer.
//
// Storage: a single AsyncStorage key holds a JSON map { [phrase]: id }.
// Persists fire-and-forget on first write per phrase; the in-memory map
// is the source of truth within a session.

const STORAGE_KEY = "analytics:goalIdMap";
const ID_BYTES = 4; // 8 hex chars — same width as the previous hash for
// downstream funnel consistency; collision probability is still negligible
// at any realistic per-user goal count.

// Module state — three phases:
//
//   1. Pre-init: hydrationPromise is null, hydrated is false. cachedMap is
//      empty. goalIdFor() works (creates session-local ids) but persistMap
//      is suppressed because we haven't read storage yet — writing now
//      would clobber any persisted ids from prior sessions.
//   2. Hydrating: initGoalIdRegistry() has been called, AsyncStorage.getItem
//      is in flight. hydrationPromise is non-null, hydrated is still false.
//      Same semantics as pre-init: persistMap is suppressed.
//   3. Hydrated: storage read resolved, merge step ran, cachedMap reflects
//      stored ∪ session-local. hydrated flips true. persistMap is unblocked.
//
// hydrationPromise is exposed via whenGoalIdRegistryHydrated() so callers
// that care about cross-session id consistency (notably ScreenTracker on
// deep-link launches) can wait for phase 3 before reading goalIdFor.
let cachedMap: Record<string, string> = {};
let hydrated = false;
let hydrationPromise: Promise<void> | null = null;

/**
 * Load any persisted phrase→id mapping from AsyncStorage and merge it
 * into the in-memory map. Idempotent; subsequent calls return the same
 * Promise resolved by the first. Best-effort: storage failures leave the
 * in-memory map intact (degraded mode: ids persist within the session
 * only). Storage failures still mark the registry hydrated so subsequent
 * goalIdFor calls can persist their writes locally (they may fail too,
 * but that's harmless — the in-memory map remains the source of truth
 * within the session).
 *
 * Call this once at app launch alongside initSentry / initPostHog.
 */
export function initGoalIdRegistry(): Promise<void> {
  if (hydrationPromise) return hydrationPromise;
  hydrationPromise = (async () => {
    try {
      const json = await AsyncStorage.getItem(STORAGE_KEY);
      const stored: Record<string, string> = json
        ? (JSON.parse(json) as Record<string, string>)
        : {};
      const sessionLocalCount = Object.keys(cachedMap).length;
      // Stored values win over session-local values (a stored id was
      // already shipped to PostHog in a prior session, so it's the
      // authoritative one). New session-local entries — phrases first
      // seen this session before init resolved — survive the merge and
      // get persisted alongside the stored entries.
      const merged: Record<string, string> = { ...cachedMap };
      for (const [phrase, id] of Object.entries(stored)) {
        if (typeof id === "string" && id.length > 0) {
          merged[phrase] = id;
        }
      }
      cachedMap = merged;
      // Mark hydrated BEFORE calling persistMap so the inner persistMap
      // (and any concurrent goalIdFor that races with this microtask)
      // sees the post-merge map and the unblocked persist gate.
      hydrated = true;
      if (sessionLocalCount > 0) {
        void persistMap();
      }
    } catch {
      // Storage failure: stay in session-only mode. We deliberately don't
      // log here — logger.error forwards to trackEvent("app_error") which
      // could call goalIdFor through some other code path, creating a
      // cycle. Mark hydrated anyway so future writes aren't stuck — they
      // won't persist successfully, but blocking them forever would be
      // worse (the in-memory map is still useful within the session).
      hydrated = true;
    }
  })();
  return hydrationPromise;
}

/**
 * Returns true once initGoalIdRegistry() has finished reading
 * AsyncStorage and the in-memory map reflects the persisted state.
 * Callers that care about cross-session id consistency (e.g. event
 * emitters that fire on first-render before user interaction) should
 * gate their goal_id inclusion on this. Goal mutations triggered by
 * user actions don't need to check — by the time the user navigates
 * to mutate, the storage read has long since resolved.
 */
export function isGoalIdRegistryHydrated(): boolean {
  return hydrated;
}

/**
 * Returns a Promise that resolves when initGoalIdRegistry()'s storage
 * read completes (or fails into degraded mode). Resolves immediately
 * if already hydrated, or to Promise.resolve() if init was never
 * called (so awaiters don't deadlock when used in tests or in code
 * paths where init hasn't been wired up).
 */
export function whenGoalIdRegistryHydrated(): Promise<void> {
  return hydrationPromise ?? Promise.resolve();
}

/**
 * Return the stable random id for this phrase. Creates a new id on
 * first encounter; otherwise returns the cached value. Always
 * synchronous — call sites in goal mutations and screen-view trackers
 * don't need to await anything.
 *
 * Pre-hydration calls produce session-local ids that may differ from
 * ids stored in a prior session. Once hydration completes, the merge
 * step ensures stored ids win over those session-local entries for
 * subsequent calls — but events that already shipped with a session
 * id stay inconsistent in PostHog. Call sites for which cross-session
 * consistency matters should gate on isGoalIdRegistryHydrated() or
 * await whenGoalIdRegistryHydrated() before reading.
 */
export function goalIdFor(phrase: string): string {
  if (phrase in cachedMap) return cachedMap[phrase];
  const id = generateRandomHex(ID_BYTES);
  cachedMap[phrase] = id;
  // CRITICAL: only persist after hydration. Persisting pre-hydration
  // would write a single-entry map and clobber any previously-stored
  // ids that the in-flight AsyncStorage.getItem hasn't returned yet.
  // Pre-hydration writes get persisted wholesale by the merge step.
  if (hydrated) void persistMap();
  return id;
}

async function persistMap(): Promise<void> {
  try {
    await AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(cachedMap));
  } catch {
    // Silent: same rationale as initGoalIdRegistry's catch.
  }
}

function generateRandomHex(bytes: number): string {
  // Math.random is not cryptographic, but for an analytics pseudonym
  // it's sufficient. The threat model is dictionary attack on hashed
  // user content + cross-user correlation, both of which are defeated
  // by *any* per-device randomness regardless of source quality.
  let out = "";
  for (let i = 0; i < bytes * 2; i++) {
    out += Math.floor(Math.random() * 16).toString(16);
  }
  return out;
}

// Test-only: reset module state so each test starts from a clean slate.
// Pass `seed` to pre-populate the in-memory map for deterministic
// assertions (e.g. set { "lose weight": "deadbeef" } before exercising
// a code path that emits goal_id, then assert "deadbeef" in the event).
export function __resetForTests(seed: Record<string, string> = {}): void {
  cachedMap = { ...seed };
  hydrated = false;
  hydrationPromise = null;
}
