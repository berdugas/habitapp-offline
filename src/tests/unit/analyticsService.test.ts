import { addBreadcrumb } from "@/services/sentry";
import { capture as posthogCapture } from "@/services/posthog";

jest.mock("@/services/sentry", () => ({
  __esModule: true,
  addBreadcrumb: jest.fn(),
  captureException: jest.fn(),
  captureMessage: jest.fn(),
  setUser: jest.fn(),
}));

jest.mock("@/services/posthog", () => ({
  __esModule: true,
  capture: jest.fn(),
  screen: jest.fn(),
  getPostHogClient: jest.fn(() => null),
  TelemetryProvider: ({ children }: { children: React.ReactNode }) => children,
  initPostHog: jest.fn(),
}));

import { trackEvent } from "@/services/analytics";

beforeEach(() => {
  jest.clearAllMocks();
  jest.spyOn(console, "info").mockImplementation(() => {});
});

afterEach(() => {
  jest.restoreAllMocks();
});

describe("trackEvent", () => {
  it("forwards allowlisted properties to both Sentry breadcrumb and PostHog capture", () => {
    trackEvent("habit_created", { habit_id: "abc-123" });

    expect(addBreadcrumb).toHaveBeenCalledTimes(1);
    expect(addBreadcrumb).toHaveBeenCalledWith({
      category: "analytics",
      message: "habit_created",
      level: "info",
      data: { habit_id: "abc-123" },
    });

    expect(posthogCapture).toHaveBeenCalledTimes(1);
    expect(posthogCapture).toHaveBeenCalledWith("habit_created", {
      habit_id: "abc-123",
    });
  });

  it("redacts non-allowlisted free-text in the breadcrumb data", () => {
    trackEvent("habit_created", { habit_id: "abc", habit_name: "Therapy" });

    const breadcrumb = (addBreadcrumb as jest.Mock).mock.calls[0][0];
    expect(breadcrumb.data).toEqual({
      habit_id: "abc",
      habit_name: "[redacted]",
    });
  });

  it("works with no properties at all", () => {
    trackEvent("weekly_review_first_run_completed");
    expect(addBreadcrumb).toHaveBeenCalledWith({
      category: "analytics",
      message: "weekly_review_first_run_completed",
      level: "info",
      data: undefined,
    });
    expect(posthogCapture).toHaveBeenCalledWith(
      "weekly_review_first_run_completed",
      undefined,
    );
  });

  it("dual-emits even when properties include numeric primitives", () => {
    trackEvent("weekly_review_intro_viewed", { slide: 2 });
    expect(addBreadcrumb).toHaveBeenCalledWith({
      category: "analytics",
      message: "weekly_review_intro_viewed",
      level: "info",
      data: { slide: 2 },
    });
    expect(posthogCapture).toHaveBeenCalledWith("weekly_review_intro_viewed", {
      slide: 2,
    });
  });
});
