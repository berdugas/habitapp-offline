// Each test re-evaluates the service module under different mocked
// `executionEnvironment` values so the module-top `isExpoGo` constant
// re-evaluates against the current state. `jest.isolateModules` creates a
// fresh module registry per call — including a fresh copy of the
// `__mocks__/@sentry/react-native.ts` manual mock — so we must `require`
// the mock INSIDE the isolation block to get the same instance the service
// is calling. Importing the mock at the top of the file would point at a
// different jest.fn than the one the gated `require()` inside the service
// resolves to.

let mockExtra: Record<string, unknown> = {};
let mockVersion: string | undefined = undefined;
let mockExecutionEnvironment: string | undefined;

jest.mock("expo-constants", () => ({
  __esModule: true,
  default: {
    get executionEnvironment() {
      return mockExecutionEnvironment;
    },
    get expoConfig() {
      return { extra: mockExtra, version: mockVersion };
    },
  },
}));

beforeEach(() => {
  jest.resetModules();
  mockExtra = {};
  mockVersion = undefined;
  mockExecutionEnvironment = undefined;
  jest.clearAllMocks();
});

describe("Expo Go gate (executionEnvironment === 'storeClient')", () => {
  beforeEach(() => {
    mockExecutionEnvironment = "storeClient";
    mockExtra = {
      sentryDsn: "https://example@sentry.io/1",
      telemetryInDev: true,
    };
  });

  it("initSentry does not invoke real Sentry.init", () => {
    jest.isolateModules(() => {
      const MockedSentry = require("@sentry/react-native");
      const { initSentry } = require("@/services/sentry");
      initSentry();
      expect(MockedSentry.init).not.toHaveBeenCalled();
    });
  });

  it("captureException does not reach real Sentry.captureException", () => {
    jest.isolateModules(() => {
      const MockedSentry = require("@sentry/react-native");
      const { initSentry, captureException } = require("@/services/sentry");
      initSentry();
      captureException(new Error("test"));
      expect(MockedSentry.captureException).not.toHaveBeenCalled();
    });
  });

  it("captureMessage does not reach real Sentry.captureMessage", () => {
    jest.isolateModules(() => {
      const MockedSentry = require("@sentry/react-native");
      const { initSentry, captureMessage } = require("@/services/sentry");
      initSentry();
      captureMessage("test");
      expect(MockedSentry.captureMessage).not.toHaveBeenCalled();
    });
  });

  it("addBreadcrumb does not reach real Sentry.addBreadcrumb", () => {
    jest.isolateModules(() => {
      const MockedSentry = require("@sentry/react-native");
      const { initSentry, addBreadcrumb } = require("@/services/sentry");
      initSentry();
      addBreadcrumb({ category: "test", message: "test" });
      expect(MockedSentry.addBreadcrumb).not.toHaveBeenCalled();
    });
  });

  it("setUser does not reach real Sentry.setUser", () => {
    jest.isolateModules(() => {
      const MockedSentry = require("@sentry/react-native");
      const { initSentry, setUser } = require("@/services/sentry");
      initSentry();
      setUser({ id: "abc" });
      expect(MockedSentry.setUser).not.toHaveBeenCalled();
    });
  });

  it("wrap returns the input component unchanged AND does not invoke real Sentry.wrap", () => {
    const TestComponent = () => null;
    jest.isolateModules(() => {
      const MockedSentry = require("@sentry/react-native");
      const { wrap } = require("@/services/sentry");
      const result = wrap(TestComponent);
      expect(result).toBe(TestComponent);
      expect(MockedSentry.wrap).not.toHaveBeenCalled();
    });
  });

  it("ErrorBoundary renders bare children (Fragment passthrough) AND does not invoke real Sentry.ErrorBoundary", () => {
    jest.isolateModules(() => {
      const MockedSentry = require("@sentry/react-native");
      const { ErrorBoundary } = require("@/services/sentry");
      const rendered = ErrorBoundary({ children: "hello" });
      // Stub renders React.createElement(Fragment, null, children) — verify
      // the element's children prop is unchanged.
      expect(rendered.props.children).toBe("hello");
      expect(MockedSentry.ErrorBoundary).not.toHaveBeenCalled();
    });
  });
});

describe("Standalone build gate (executionEnvironment !== 'storeClient')", () => {
  beforeEach(() => {
    mockExecutionEnvironment = "standalone";
    mockExtra = {
      sentryDsn: "https://example@sentry.io/1",
      telemetryInDev: true,
    };
  });

  it("initSentry invokes the real Sentry.init with the expected args", () => {
    jest.isolateModules(() => {
      const MockedSentry = require("@sentry/react-native");
      const { initSentry } = require("@/services/sentry");
      initSentry();
      expect(MockedSentry.init).toHaveBeenCalledTimes(1);
      const initCall = MockedSentry.init.mock.calls[0][0];
      expect(initCall.dsn).toBe("https://example@sentry.io/1");
      expect(initCall.sendDefaultPii).toBe(false);
    });
  });

  it("captureException reaches the real Sentry.captureException", () => {
    jest.isolateModules(() => {
      const MockedSentry = require("@sentry/react-native");
      const { initSentry, captureException } = require("@/services/sentry");
      initSentry();
      captureException(new Error("test"));
      expect(MockedSentry.captureException).toHaveBeenCalledTimes(1);
    });
  });
});
