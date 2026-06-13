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

// Returns true if the identity was successfully established (or if the
// SDK gate short-circuited in Expo Go, where there's no real identity to
// establish). Returns false on a real SDK failure. Callers MUST check
// the return value before calling restorePurchases() — restoring against
// a stale RC identity would associate purchases with the wrong account.
export async function logInRevenueCat(userId: string): Promise<boolean> {
  if (isExpoGo()) return true;
  try {
    await Purchases.logIn(userId);
    return true;
  } catch (error) {
    logger.error("RevenueCat logIn failed", { userId, error });
    return false;
  }
}

export async function logOutRevenueCat(): Promise<void> {
  if (isExpoGo()) return;
  try {
    await Purchases.logOut();
  } catch (error) {
    logger.error("RevenueCat logOut failed", { error });
  }
}

export async function restorePurchases(): Promise<void> {
  if (isExpoGo()) return;
  try {
    await Purchases.restorePurchases();
  } catch (error) {
    logger.error("RevenueCat restorePurchases failed", { error });
  }
}

export { Purchases };

export function __resetForTests(): void {
  initialized = false;
}
