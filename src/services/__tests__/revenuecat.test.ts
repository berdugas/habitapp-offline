import { __resetForTests, initRevenueCat } from "@/services/revenuecat";
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
