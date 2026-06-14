import Constants from "expo-constants";

import { logger } from "@/services/logger";

function isExpoGo(): boolean {
  return Constants.executionEnvironment === "storeClient";
}

type PurchasesModule = typeof import("react-native-purchases").default;

function makePurchasesStub(): PurchasesModule {
  const noop = (..._args: unknown[]) => {};
  const asyncNoop = (..._args: unknown[]) => Promise.resolve({} as never);
  return {
    configure: noop,
    logIn: asyncNoop,
    logOut: asyncNoop,
    restorePurchases: asyncNoop,
    syncPurchases: asyncNoop,
    getCustomerInfo: asyncNoop,
    getOfferings: asyncNoop,
    purchasePackage: asyncNoop,
  } as unknown as PurchasesModule;
}

// In Jest the mock at __mocks__/react-native-purchases.ts is used; in
// Expo Go we still need a stub because requiring the module would touch
// the native module at runtime. In standalone the real SDK is required.
const Purchases: PurchasesModule = (() => {
  if (isExpoGo()) return makePurchasesStub();
  // eslint-disable-next-line @typescript-eslint/no-var-requires
  const mod = require("react-native-purchases");
  return (mod.default ?? mod) as PurchasesModule;
})();

function readApiKey(): string | undefined {
  const key = Constants.expoConfig?.extra?.revenueCatApiKey;
  return typeof key === "string" && key.length > 0 ? key : undefined;
}

let initialized = false;

export function initRevenueCat(): void {
  if (initialized) return;
  if (isExpoGo()) return;
  const apiKey = readApiKey();
  if (!apiKey) {
    logger.warn("RevenueCat API key missing — skipping init");
    return;
  }
  Purchases.configure({ apiKey });
  initialized = true;
  logger.info("RevenueCat initialized");
}

// Identity-op queue: ensures logIn / logOut / sync / restore execute in
// caller order against the SDK. Without this, two overlapping logIn
// calls can race at the native layer and leave RC stuck on whichever
// promise resolves last, regardless of which was called last by the app.
// The queue is a single in-flight tail; every public wrapper appends.
let identityQueue: Promise<unknown> = Promise.resolve();
function enqueueIdentityOp<T>(op: () => Promise<T>): Promise<T> {
  const next = identityQueue.then(op, op);
  // Swallow the result type for the chain; tail tracks only ordering.
  identityQueue = next.catch(() => undefined);
  return next;
}

// Returns true if the identity was successfully established (or if the
// SDK was never configured — Expo Go, or no API key in the EAS env,
// both of which are no-op success cases). Returns false on a real SDK
// failure. Callers MUST check the return value before calling
// syncPurchases() / restorePurchases() — running those against a stale
// RC identity would associate purchases with the wrong account.
//
// Gating on `initialized` (not just isExpoGo) is important: in a
// standalone build with no API key in the EAS env, initRevenueCat()
// logs a warning and returns; the native SDK is then unconfigured and
// every wrapper call would error at the JNI layer. Treat that as a
// silent no-op success — there's no RC identity to keep in sync.
//
// Serialized via the identity queue: an in-flight logIn(A) finishes
// before logIn(B) starts, so the SDK's final appUserID always reflects
// the last caller (in program order), not whichever native promise
// resolved last in real time.
export async function logInRevenueCat(userId: string): Promise<boolean> {
  if (!initialized) return true;
  return enqueueIdentityOp(async () => {
    try {
      await Purchases.logIn(userId);
      return true;
    } catch (error) {
      logger.error("RevenueCat logIn failed", { userId, error });
      return false;
    }
  });
}

export async function logOutRevenueCat(): Promise<void> {
  if (!initialized) return;
  await enqueueIdentityOp(async () => {
    try {
      await Purchases.logOut();
    } catch (error) {
      logger.error("RevenueCat logOut failed", { error });
    }
  });
}

// Silent, programmatic purchase sync. Safe to run on every app launch /
// auth change because it does NOT trigger OS sign-in prompts. Per RC
// docs, this is the correct API for background reconciliation; the
// loud restorePurchases() below is reserved for an explicit user gesture
// ("Restore Purchase" button) where an iOS prompt is acceptable.
export async function syncPurchases(): Promise<void> {
  if (!initialized) return;
  await enqueueIdentityOp(async () => {
    try {
      await Purchases.syncPurchases();
    } catch (error) {
      logger.error("RevenueCat syncPurchases failed", { error });
    }
  });
}

// User-initiated restore — may show OS sign-in prompts (iOS).
// Call ONLY from a user tap (e.g. Settings → Restore Purchase), never
// from auto-running lifecycle code. The lifecycle hook uses
// syncPurchases() instead.
export async function restorePurchases(): Promise<void> {
  if (!initialized) return;
  await enqueueIdentityOp(async () => {
    try {
      await Purchases.restorePurchases();
    } catch (error) {
      logger.error("RevenueCat restorePurchases failed", { error });
    }
  });
}

export { Purchases };

export type PurchaseFailureReason = "no_offering" | "not_configured";

export class PurchaseError extends Error {
  reason: PurchaseFailureReason;
  constructor(reason: PurchaseFailureReason) {
    super(`Purchase unavailable: ${reason}`);
    this.name = "PurchaseError";
    this.reason = reason;
  }
}

/**
 * Fetch the lifetime-unlock package from RevenueCat's current offering.
 * Prefers the typed `lifetime` package; falls back to the first available
 * package so a mis-typed dashboard offering still purchases.
 */
export async function getLifetimePackage() {
  if (!initialized) {
    throw new PurchaseError("not_configured");
  }
  const offerings = await Purchases.getOfferings();
  const current = offerings.current;
  const pkg = current?.lifetime ?? current?.availablePackages?.[0] ?? null;
  if (!pkg) {
    throw new PurchaseError("no_offering");
  }
  return pkg;
}

/**
 * Open the Google Play purchase sheet for the lifetime unlock. Resolves
 * { cancelled: true } when the user backs out (RC throws with
 * userCancelled=true) and { cancelled: false } on success. Any other
 * error propagates so the caller can show a toast. The actual entitlement
 * flip happens server-side via the RC webhook; the client just refetches
 * the trial context afterward.
 *
 * Deliberately NOT routed through any identity queue: a purchase is not an
 * identity op, and the Play purchase sheet is inherently user-serialized.
 */
export async function purchaseLifetimeUnlock(): Promise<{ cancelled: boolean }> {
  const pkg = await getLifetimePackage();
  try {
    await Purchases.purchasePackage(pkg);
    return { cancelled: false };
  } catch (err) {
    if (err && typeof err === "object" && (err as { userCancelled?: boolean }).userCancelled) {
      return { cancelled: true };
    }
    throw err;
  }
}

export function __resetForTests(): void {
  initialized = false;
  identityQueue = Promise.resolve();
}
