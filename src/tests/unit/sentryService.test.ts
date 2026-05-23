import * as Sentry from "@sentry/react-native";
import type { ErrorEvent, Breadcrumb } from "@sentry/react-native";

import {
  __resetForTests,
  __testables,
  initSentry,
  isSentryInitialized,
} from "@/services/sentry";

let mockExtra: Record<string, unknown> = {};
let mockVersion: string | undefined = undefined;

jest.mock("expo-constants", () => ({
  __esModule: true,
  default: {
    get expoConfig() {
      return { extra: mockExtra, version: mockVersion };
    },
  },
}));

beforeEach(() => {
  __resetForTests();
  mockExtra = {};
  mockVersion = undefined;
  jest.clearAllMocks();
});

describe("initSentry()", () => {
  it("no-ops when DSN is missing", () => {
    initSentry();
    expect(Sentry.init).not.toHaveBeenCalled();
    expect(isSentryInitialized()).toBe(false);
  });

  it("no-ops in __DEV__ unless telemetryInDev override is set", () => {
    mockExtra = {
      sentryDsn: "https://example@sentry.io/1",
    };
    // __DEV__ is true in jest unless explicitly set false
    initSentry();
    expect(Sentry.init).not.toHaveBeenCalled();
    expect(isSentryInitialized()).toBe(false);
  });

  it("initializes when DSN present and telemetryInDev override is true", () => {
    mockExtra = {
      sentryDsn: "https://example@sentry.io/1",
      telemetryInDev: true,
    };
    initSentry();
    expect(Sentry.init).toHaveBeenCalledTimes(1);
    const call = (Sentry.init as jest.Mock).mock.calls[0][0];
    expect(call.dsn).toBe("https://example@sentry.io/1");
    expect(call.sendDefaultPii).toBe(false);
    expect(typeof call.beforeSend).toBe("function");
    expect(typeof call.beforeBreadcrumb).toBe("function");
    expect(isSentryInitialized()).toBe(true);
  });

  it("does not re-init on a second call", () => {
    mockExtra = {
      sentryDsn: "https://example@sentry.io/1",
      telemetryInDev: true,
    };
    initSentry();
    initSentry();
    expect(Sentry.init).toHaveBeenCalledTimes(1);
  });
});

describe("applyBeforeSend (PII redaction scope)", () => {
  it("redacts event.extra", () => {
    const event = {
      extra: { habit_id: "abc", email: "x@y.z" },
    } as unknown as ErrorEvent;
    const result = __testables.applyBeforeSend(event);
    expect(result.extra).toEqual({ habit_id: "abc", email: "[redacted]" });
  });

  it("redacts event.contexts.*", () => {
    const event = {
      contexts: {
        custom: { habit_id: "abc", habit_name: "Therapy" },
      },
    } as unknown as ErrorEvent;
    const result = __testables.applyBeforeSend(event);
    expect(result.contexts?.custom).toEqual({
      habit_id: "abc",
      habit_name: "[redacted]",
    });
  });

  it("redacts breadcrumb.data within event.breadcrumbs", () => {
    const event = {
      breadcrumbs: [
        {
          category: "analytics",
          message: "habit_created",
          data: { habit_id: "abc", habit_name: "Therapy" },
        },
      ],
    } as unknown as ErrorEvent;
    const result = __testables.applyBeforeSend(event);
    expect(result.breadcrumbs?.[0]?.data).toEqual({
      habit_id: "abc",
      habit_name: "[redacted]",
    });
  });

  it("does NOT touch event.exception.values[].value (dev-written messages survive)", () => {
    const event = {
      exception: {
        values: [
          {
            type: "Error",
            value: "Habit save failed",
            stacktrace: { frames: [] },
          },
        ],
      },
    } as unknown as ErrorEvent;
    const result = __testables.applyBeforeSend(event);
    expect(result.exception?.values?.[0]?.value).toBe("Habit save failed");
  });

  it("returns the event without crashing when no redactable fields are present", () => {
    const event = {} as ErrorEvent;
    expect(__testables.applyBeforeSend(event)).toBe(event);
  });
});

describe("applyBeforeBreadcrumb", () => {
  it("redacts breadcrumb.data", () => {
    const breadcrumb: Breadcrumb = {
      category: "analytics",
      message: "habit_created",
      data: { habit_id: "abc", habit_name: "Therapy" },
    };
    const result = __testables.applyBeforeBreadcrumb(breadcrumb);
    expect(result?.data).toEqual({
      habit_id: "abc",
      habit_name: "[redacted]",
    });
  });

  it("passes breadcrumbs without data unchanged", () => {
    const breadcrumb: Breadcrumb = {
      category: "navigation",
      message: "/today",
    };
    expect(__testables.applyBeforeBreadcrumb(breadcrumb)).toBe(breadcrumb);
  });

  it("does NOT touch breadcrumb.message or .category", () => {
    const breadcrumb: Breadcrumb = {
      category: "analytics",
      message: "user typed name: Therapy",
      data: {},
    };
    const result = __testables.applyBeforeBreadcrumb(breadcrumb);
    expect(result?.message).toBe("user typed name: Therapy");
    expect(result?.category).toBe("analytics");
  });
});
