import {
  PurchaseError,
  getLifetimePackage,
  purchaseLifetimeUnlock,
  initRevenueCat,
  __resetForTests,
} from "@/services/revenuecat";
import Purchases from "react-native-purchases";

let mockExecutionEnvironment: string | null = null;
let mockExtra: Record<string, unknown> = {};

jest.mock("expo-constants", () => ({
  __esModule: true,
  default: {
    get executionEnvironment() {
      return mockExecutionEnvironment;
    },
    get expoConfig() {
      return { extra: mockExtra };
    },
  },
}));

const mockGetOfferings = Purchases.getOfferings as jest.Mock;
const mockPurchasePackage = Purchases.purchasePackage as jest.Mock;
const mockLogIn = Purchases.logIn as jest.Mock;

const LIFETIME_PKG = { identifier: "$rc_lifetime", product: { priceString: "$1.99" } };

beforeEach(() => {
  __resetForTests();
  mockGetOfferings.mockReset();
  mockPurchasePackage.mockReset();
  mockLogIn.mockReset();
  mockLogIn.mockResolvedValue({ customerInfo: {}, created: false });
  mockExecutionEnvironment = "standalone";
  mockExtra = { revenueCatApiKey: "appl_FAKEKEY" };
  initRevenueCat();
});

describe("getLifetimePackage", () => {
  it("returns the current offering's lifetime package", async () => {
    mockGetOfferings.mockResolvedValue({
      current: { lifetime: LIFETIME_PKG, availablePackages: [LIFETIME_PKG] },
    });
    expect(await getLifetimePackage()).toBe(LIFETIME_PKG);
  });

  it("falls back to the first available package when `lifetime` is null", async () => {
    mockGetOfferings.mockResolvedValue({
      current: { lifetime: null, availablePackages: [LIFETIME_PKG] },
    });
    expect(await getLifetimePackage()).toBe(LIFETIME_PKG);
  });

  it("throws PurchaseError('no_offering') when there is no current offering", async () => {
    mockGetOfferings.mockResolvedValue({ current: null });
    await expect(getLifetimePackage()).rejects.toMatchObject({
      name: "PurchaseError",
      reason: "no_offering",
    });
  });

  it("throws PurchaseError('not_configured') when the SDK was never initialized", async () => {
    __resetForTests();
    await expect(getLifetimePackage()).rejects.toMatchObject({
      name: "PurchaseError",
      reason: "not_configured",
    });
    expect(mockGetOfferings).not.toHaveBeenCalled();
  });
});

describe("purchaseLifetimeUnlock", () => {
  it("resolves { cancelled: false } on a successful purchase", async () => {
    mockGetOfferings.mockResolvedValue({ current: { lifetime: LIFETIME_PKG } });
    mockPurchasePackage.mockResolvedValue({ customerInfo: {} });
    await expect(purchaseLifetimeUnlock("user-1")).resolves.toEqual({ cancelled: false });
    expect(mockPurchasePackage).toHaveBeenCalledWith(LIFETIME_PKG);
  });

  it("resolves { cancelled: true } when the user cancels (userCancelled flag)", async () => {
    mockGetOfferings.mockResolvedValue({ current: { lifetime: LIFETIME_PKG } });
    mockPurchasePackage.mockRejectedValue({ userCancelled: true });
    await expect(purchaseLifetimeUnlock("user-1")).resolves.toEqual({ cancelled: true });
  });

  it("rethrows non-cancel purchase errors", async () => {
    mockGetOfferings.mockResolvedValue({ current: { lifetime: LIFETIME_PKG } });
    mockPurchasePackage.mockRejectedValue(new Error("network down"));
    await expect(purchaseLifetimeUnlock("user-1")).rejects.toThrow("network down");
  });

  it("establishes the buyer's RC identity (logIn) BEFORE charging", async () => {
    mockGetOfferings.mockResolvedValue({ current: { lifetime: LIFETIME_PKG } });
    const order: string[] = [];
    mockLogIn.mockImplementation(async () => {
      order.push("logIn");
      return { customerInfo: {}, created: false };
    });
    mockPurchasePackage.mockImplementation(async () => {
      order.push("purchase");
      return { customerInfo: {} };
    });

    await purchaseLifetimeUnlock("user-7");

    expect(mockLogIn).toHaveBeenCalledWith("user-7");
    // Identity must be established first — a purchase against the anonymous/
    // previous RC customer can't be matched to this Supabase user.
    expect(order).toEqual(["logIn", "purchase"]);
  });

  it("throws PurchaseError('identity_failed') and does NOT charge when logIn fails", async () => {
    mockGetOfferings.mockResolvedValue({ current: { lifetime: LIFETIME_PKG } });
    mockLogIn.mockRejectedValue(new Error("identity down"));

    await expect(purchaseLifetimeUnlock("user-7")).rejects.toMatchObject({
      name: "PurchaseError",
      reason: "identity_failed",
    });
    expect(mockPurchasePackage).not.toHaveBeenCalled();
  });
});
