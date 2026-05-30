import { act, fireEvent, render, screen } from "@/tests/setup/render";
import React from "react";

const mockRouterReplace = jest.fn();
const mockRouterBack = jest.fn();
const mockRouterCanGoBack = jest.fn(() => true);
const mockMarkWeeklyReviewIntroSeen = jest.fn();
const mockTrackEvent = jest.fn();

let mockParams: { identityPhrase?: string; returnTo?: string | string[] } = {
  identityPhrase: encodeURIComponent("Becoming a runner"),
  returnTo: "habitDetail",
};

jest.mock("expo-router", () => ({
  router: {
    replace: (...args: unknown[]) => mockRouterReplace(...args),
    back: () => mockRouterBack(),
    canGoBack: () => mockRouterCanGoBack(),
  },
  useLocalSearchParams: () => mockParams,
}));

jest.mock("@/features/reviews/onboardingStorage", () => ({
  markWeeklyReviewIntroSeen: () => mockMarkWeeklyReviewIntroSeen(),
}));

jest.mock("@/services/analytics", () => ({
  trackEvent: (...args: unknown[]) => mockTrackEvent(...args),
}));

import WeeklyReviewIntroScreen from "@/features/reviews/screens/WeeklyReviewIntroScreen";

beforeEach(() => {
  jest.clearAllMocks();
  mockMarkWeeklyReviewIntroSeen.mockResolvedValue(true);
  mockRouterCanGoBack.mockReturnValue(true);
  mockParams = {
    identityPhrase: encodeURIComponent("Becoming a runner"),
    returnTo: "habitDetail",
  };
});

describe("WeeklyReviewIntroScreen", () => {
  it("renders the single-slide headline and body", () => {
    render(<WeeklyReviewIntroScreen />);
    expect(screen.getByText("A weekly look back.")).toBeTruthy();
    expect(
      screen.getByText(
        /See what's settling in, and what isn't fitting yet/,
      ),
    ).toBeTruthy();
  });

  it("shows 'Start review' as the primary CTA when an identityPhrase is present", () => {
    render(<WeeklyReviewIntroScreen />);
    expect(screen.getByText("Start review")).toBeTruthy();
  });

  it("shows 'Got it' as the primary CTA when no identityPhrase is present (settings replay)", () => {
    mockParams = { identityPhrase: undefined, returnTo: undefined };
    render(<WeeklyReviewIntroScreen />);
    expect(screen.getByText("Got it")).toBeTruthy();
    expect(screen.queryByText("Start review")).toBeNull();
  });

  it("on 'Start review' marks intro seen and replaces to the goal review route", async () => {
    render(<WeeklyReviewIntroScreen />);
    await act(async () => {
      fireEvent.press(screen.getByText("Start review"));
    });

    expect(mockMarkWeeklyReviewIntroSeen).toHaveBeenCalledTimes(1);
    expect(mockRouterReplace).toHaveBeenCalledTimes(1);
    const arg = mockRouterReplace.mock.calls[0][0];
    expect(arg.pathname).toBe("/(app)/reviews/goal/[identityPhrase]");
    expect(arg.params.identityPhrase).toBe(
      encodeURIComponent("Becoming a runner"),
    );
    expect(arg.params.returnTo).toBe("habitDetail");
    expect(mockTrackEvent).toHaveBeenCalledWith(
      "weekly_review_intro_completed",
    );
  });

  it("on Skip, marks intro seen, fires skipped analytics, and replaces to review", async () => {
    render(<WeeklyReviewIntroScreen />);
    await act(async () => {
      fireEvent.press(screen.getByLabelText("Skip intro"));
    });

    expect(mockMarkWeeklyReviewIntroSeen).toHaveBeenCalledTimes(1);
    expect(mockTrackEvent).toHaveBeenCalledWith("weekly_review_intro_skipped");
    expect(mockRouterReplace).toHaveBeenCalledTimes(1);
    expect(mockRouterReplace.mock.calls[0][0].pathname).toBe(
      "/(app)/reviews/goal/[identityPhrase]",
    );
  });

  it("on 'Got it' (no identityPhrase), marks intro seen and calls router.back", async () => {
    mockParams = { identityPhrase: undefined, returnTo: undefined };
    render(<WeeklyReviewIntroScreen />);
    await act(async () => {
      fireEvent.press(screen.getByText("Got it"));
    });

    expect(mockMarkWeeklyReviewIntroSeen).toHaveBeenCalledTimes(1);
    expect(mockRouterReplace).not.toHaveBeenCalled();
    expect(mockRouterBack).toHaveBeenCalledTimes(1);
  });

  it("fires 'viewed' analytics on mount (no slide param under one-slide collapse)", () => {
    render(<WeeklyReviewIntroScreen />);
    expect(mockTrackEvent).toHaveBeenCalledWith("weekly_review_intro_viewed");
    // Exactly one viewed call — no second event from a slide transition.
    const viewedCalls = mockTrackEvent.mock.calls.filter(
      (call) => call[0] === "weekly_review_intro_viewed",
    );
    expect(viewedCalls).toHaveLength(1);
  });

  it("when persistence fails on Start review, still navigates but does NOT emit 'completed' analytics", async () => {
    mockMarkWeeklyReviewIntroSeen.mockResolvedValue(false);
    render(<WeeklyReviewIntroScreen />);
    await act(async () => {
      fireEvent.press(screen.getByText("Start review"));
    });

    expect(mockRouterReplace).toHaveBeenCalledTimes(1);
    expect(mockTrackEvent).not.toHaveBeenCalledWith(
      "weekly_review_intro_completed",
    );
  });

  it("when persistence fails on Skip, still navigates but does NOT emit 'skipped' analytics", async () => {
    mockMarkWeeklyReviewIntroSeen.mockResolvedValue(false);
    render(<WeeklyReviewIntroScreen />);
    await act(async () => {
      fireEvent.press(screen.getByLabelText("Skip intro"));
    });

    expect(mockRouterReplace).toHaveBeenCalledTimes(1);
    expect(mockTrackEvent).not.toHaveBeenCalledWith(
      "weekly_review_intro_skipped",
    );
  });
});
