import {
  __resetForTests,
  initRevenueCat,
  logInRevenueCat,
  logOutRevenueCat,
  restorePurchases,
  syncPurchases,
} from "@/services/revenuecat";
import Purchases from "react-native-purchases";

// Use the getter pattern (mirroring src/tests/unit/sentryService.test.ts)
// because the default export from expo-constants is a frozen object
// whose properties cannot be mutated directly in a test setup helper.
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

const mockConfigure = Purchases.configure as jest.Mock;

function setEnv(opts: {
  executionEnvironment: "storeClient" | "standalone" | "bare" | null;
  apiKey: string | undefined;
}) {
  mockExecutionEnvironment = opts.executionEnvironment;
  mockExtra = { revenueCatApiKey: opts.apiKey };
}

describe("revenuecat service — Expo Go gate", () => {
  beforeEach(() => {
    mockConfigure.mockClear();
    __resetForTests();
  });

  it("does NOT initialize the SDK when running in Expo Go", () => {
    setEnv({ executionEnvironment: "storeClient", apiKey: "appl_FAKEKEY" });
    initRevenueCat();
    expect(mockConfigure).not.toHaveBeenCalled();
  });

  it("initializes the SDK when NOT in Expo Go (standalone build)", () => {
    setEnv({ executionEnvironment: "standalone", apiKey: "appl_FAKEKEY" });
    initRevenueCat();
    expect(mockConfigure).toHaveBeenCalledTimes(1);
    expect(mockConfigure.mock.calls[0][0]).toMatchObject({ apiKey: "appl_FAKEKEY" });
  });

  it("does NOT initialize when revenueCatApiKey is missing (defensive)", () => {
    setEnv({ executionEnvironment: "standalone", apiKey: undefined });
    initRevenueCat();
    expect(mockConfigure).not.toHaveBeenCalled();
  });

  it("is idempotent — second call skips configure", () => {
    setEnv({ executionEnvironment: "standalone", apiKey: "appl_FAKEKEY" });
    initRevenueCat();
    initRevenueCat();
    expect(mockConfigure).toHaveBeenCalledTimes(1);
  });
});

describe("revenuecat service — wrappers gate on initialized", () => {
  // Regression: in a standalone build with EXPO_PUBLIC_REVENUECAT_API_KEY
  // missing in the EAS env, initRevenueCat() warns and skips configure().
  // Wrappers previously only checked isExpoGo(), so they still tried to
  // call the unconfigured native SDK and produced LogBox errors at
  // runtime. They must silently no-op when the SDK was never configured.

  const mockLogIn = Purchases.logIn as jest.Mock;
  const mockLogOut = Purchases.logOut as jest.Mock;
  const mockSync = Purchases.syncPurchases as jest.Mock;
  const mockRestore = Purchases.restorePurchases as jest.Mock;

  beforeEach(() => {
    mockConfigure.mockClear();
    mockLogIn.mockClear();
    mockLogOut.mockClear();
    mockSync.mockClear();
    mockRestore.mockClear();
    __resetForTests();
    setEnv({ executionEnvironment: "standalone", apiKey: undefined });
    initRevenueCat(); // intentionally no-ops (no apiKey)
  });

  it("logInRevenueCat is a no-op success when init was skipped (no API key)", async () => {
    const ok = await logInRevenueCat("user-1");
    expect(ok).toBe(true);
    expect(mockLogIn).not.toHaveBeenCalled();
  });

  it("logOutRevenueCat is a no-op when init was skipped", async () => {
    await logOutRevenueCat();
    expect(mockLogOut).not.toHaveBeenCalled();
  });

  it("syncPurchases is a no-op when init was skipped", async () => {
    await syncPurchases();
    expect(mockSync).not.toHaveBeenCalled();
  });

  it("restorePurchases is a no-op when init was skipped", async () => {
    await restorePurchases();
    expect(mockRestore).not.toHaveBeenCalled();
  });
});
