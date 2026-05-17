import { act, fireEvent, render, screen } from "@testing-library/react-native";
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
  it("shows slide 1 headline initially", () => {
    render(<WeeklyReviewIntroScreen />);
    expect(screen.queryByText("This isn't a report card.")).toBeTruthy();
    expect(screen.queryByText("Five quick steps.")).toBeNull();
  });

  it("advances to slide 2 when Continue is pressed", () => {
    render(<WeeklyReviewIntroScreen />);
    fireEvent.press(screen.getByText("Continue"));
    expect(screen.queryByText("Five quick steps.")).toBeTruthy();
    expect(screen.queryByText("This isn't a report card.")).toBeNull();
  });

  it("shows 'Start review' on slide 2 when an identityPhrase is present", () => {
    render(<WeeklyReviewIntroScreen />);
    fireEvent.press(screen.getByText("Continue"));
    expect(screen.queryByText("Start review")).toBeTruthy();
  });

  it("shows 'Got it' on slide 2 when no identityPhrase is present (settings replay)", () => {
    mockParams = { identityPhrase: undefined, returnTo: undefined };
    render(<WeeklyReviewIntroScreen />);
    fireEvent.press(screen.getByText("Continue"));
    expect(screen.queryByText("Got it")).toBeTruthy();
    expect(screen.queryByText("Start review")).toBeNull();
  });

  it("on 'Start review' marks intro seen and replaces to the goal review route", async () => {
    render(<WeeklyReviewIntroScreen />);
    fireEvent.press(screen.getByText("Continue"));
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
      { slide: 2 },
    );
  });

  it("on Skip from slide 1, marks intro seen, fires skipped analytics, and replaces to review", async () => {
    render(<WeeklyReviewIntroScreen />);
    await act(async () => {
      fireEvent.press(screen.getByLabelText("Skip intro"));
    });

    expect(mockMarkWeeklyReviewIntroSeen).toHaveBeenCalledTimes(1);
    expect(mockTrackEvent).toHaveBeenCalledWith(
      "weekly_review_intro_skipped",
      { slide: 1 },
    );
    expect(mockRouterReplace).toHaveBeenCalledTimes(1);
    expect(mockRouterReplace.mock.calls[0][0].pathname).toBe(
      "/(app)/reviews/goal/[identityPhrase]",
    );
  });

  it("on 'Got it' (no identityPhrase), marks intro seen and calls router.back", async () => {
    mockParams = { identityPhrase: undefined, returnTo: undefined };
    render(<WeeklyReviewIntroScreen />);
    fireEvent.press(screen.getByText("Continue"));
    await act(async () => {
      fireEvent.press(screen.getByText("Got it"));
    });

    expect(mockMarkWeeklyReviewIntroSeen).toHaveBeenCalledTimes(1);
    expect(mockRouterReplace).not.toHaveBeenCalled();
    expect(mockRouterBack).toHaveBeenCalledTimes(1);
  });

  it("fires 'viewed' analytics on mount and on slide transition", () => {
    render(<WeeklyReviewIntroScreen />);
    expect(mockTrackEvent).toHaveBeenCalledWith("weekly_review_intro_viewed", {
      slide: 1,
    });
    fireEvent.press(screen.getByText("Continue"));
    expect(mockTrackEvent).toHaveBeenCalledWith("weekly_review_intro_viewed", {
      slide: 2,
    });
  });

  it("when persistence fails, still navigates but does NOT emit 'completed' analytics", async () => {
    mockMarkWeeklyReviewIntroSeen.mockResolvedValue(false);
    render(<WeeklyReviewIntroScreen />);
    fireEvent.press(screen.getByText("Continue"));
    await act(async () => {
      fireEvent.press(screen.getByText("Start review"));
    });

    // Navigation still happens (no dead tap).
    expect(mockRouterReplace).toHaveBeenCalledTimes(1);
    // The "completed" analytics is suppressed because the write didn't persist.
    expect(mockTrackEvent).not.toHaveBeenCalledWith(
      "weekly_review_intro_completed",
      expect.anything(),
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
      expect.anything(),
    );
  });
});
