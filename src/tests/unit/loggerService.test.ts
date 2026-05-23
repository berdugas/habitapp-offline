import {
  addBreadcrumb,
  captureException,
  captureMessage,
} from "@/services/sentry";

jest.mock("@/services/sentry", () => ({
  __esModule: true,
  captureException: jest.fn(),
  captureMessage: jest.fn(),
  addBreadcrumb: jest.fn(),
  setUser: jest.fn(),
}));

import { logger } from "@/services/logger";

beforeEach(() => {
  jest.clearAllMocks();
  // Silence console output during tests; the production behavior of
  // console.info/warn/error is preserved by logger.ts itself, not under test.
  jest.spyOn(console, "info").mockImplementation(() => {});
  jest.spyOn(console, "warn").mockImplementation(() => {});
  jest.spyOn(console, "error").mockImplementation(() => {});
});

afterEach(() => {
  jest.restoreAllMocks();
});

describe("logger.error forwarding", () => {
  it("no Error in meta → captureMessage with redacted extra", () => {
    logger.error("DB write rejected", { habit_id: "abc" });
    expect(captureException).not.toHaveBeenCalled();
    expect(captureMessage).toHaveBeenCalledTimes(1);
    expect(captureMessage).toHaveBeenCalledWith("DB write rejected", {
      level: "error",
      extra: { habit_id: "abc" },
    });
  });

  it("no meta at all → captureMessage with empty extra", () => {
    logger.error("something happened");
    expect(captureMessage).toHaveBeenCalledWith("something happened", {
      level: "error",
      extra: {},
    });
  });

  it("exactly one Error → captureException with Error, redacted rest, message as contextMessage", () => {
    const err = new Error("boom");
    logger.error("Sign-in failed", { email: "x@y.z", unexpectedError: err });

    expect(captureMessage).not.toHaveBeenCalled();
    expect(captureException).toHaveBeenCalledTimes(1);
    expect(captureException).toHaveBeenCalledWith(err, {
      level: "error",
      extra: {
        contextMessage: "Sign-in failed",
        email: "[redacted]",
      },
    });
  });

  it("multiple Errors → captures first, attaches rest as additionalErrors unredacted", () => {
    const primary = new Error("a");
    const secondary = new Error("b");
    logger.error("Batch retry failed", {
      primaryErr: primary,
      secondaryErr: secondary,
      habit_id: "abc",
    });

    expect(captureException).toHaveBeenCalledTimes(1);
    const [errArg, options] = (captureException as jest.Mock).mock.calls[0];
    expect(errArg).toBe(primary);
    expect(options.level).toBe("error");
    expect(options.extra.contextMessage).toBe("Batch retry failed");
    expect(options.extra.habit_id).toBe("abc");
    expect(options.extra.additionalErrors).toEqual([
      {
        name: "Error",
        message: "b",
        stack: expect.any(String),
      },
    ]);
  });

  it("redacts non-allowlisted free-text in meta even alongside Error", () => {
    const err = new Error("boom");
    logger.error("X failed", { authError: err, sensitiveText: "secret data" });
    const [, options] = (captureException as jest.Mock).mock.calls[0];
    expect(options.extra.sensitiveText).toBe("[redacted]");
  });
});

describe("logger.warn forwarding", () => {
  it("no Error in meta → captureMessage level=warning", () => {
    logger.warn("rate limited", { reason: "throttle" });
    expect(captureMessage).toHaveBeenCalledWith("rate limited", {
      level: "warning",
      extra: { reason: "throttle" },
    });
  });

  it("with Error → captureException level=warning", () => {
    const err = new Error("boom");
    logger.warn("retry needed", { err });
    expect(captureException).toHaveBeenCalledWith(err, {
      level: "warning",
      extra: { contextMessage: "retry needed" },
    });
  });
});

describe("logger.info does NOT forward to Sentry", () => {
  it("does not call any Sentry forwarding method", () => {
    logger.info("trace step", { habit_id: "abc" });
    expect(captureException).not.toHaveBeenCalled();
    expect(captureMessage).not.toHaveBeenCalled();
    expect(addBreadcrumb).not.toHaveBeenCalled();
  });
});
