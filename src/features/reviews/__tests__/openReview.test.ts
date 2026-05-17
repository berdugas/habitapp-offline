const mockRouterPush = jest.fn();
const mockIsWeeklyReviewIntroSeen = jest.fn();
const mockLoggerWarn = jest.fn();

jest.mock("expo-router", () => ({
  router: {
    push: (...args: unknown[]) => mockRouterPush(...args),
  },
}));

jest.mock("@/features/reviews/onboardingStorage", () => ({
  isWeeklyReviewIntroSeen: () => mockIsWeeklyReviewIntroSeen(),
}));

jest.mock("@/services/logger", () => ({
  logger: {
    info: jest.fn(),
    warn: (...args: unknown[]) => mockLoggerWarn(...args),
    error: jest.fn(),
  },
}));

import { openGoalWeeklyReview } from "@/features/reviews/openReview";

async function flushMicrotasks() {
  // Run several rounds so the queueMicrotask lock-release also drains.
  for (let i = 0; i < 5; i++) {
    await Promise.resolve();
  }
}

beforeEach(() => {
  jest.clearAllMocks();
});

describe("openGoalWeeklyReview", () => {
  it("pushes the intro route when the intro hasn't been seen", async () => {
    mockIsWeeklyReviewIntroSeen.mockResolvedValue(false);
    await openGoalWeeklyReview({
      identityPhrase: "Becoming a runner",
      returnTo: "habitDetail",
    });
    expect(mockRouterPush).toHaveBeenCalledTimes(1);
    const arg = mockRouterPush.mock.calls[0][0];
    expect(arg.pathname).toBe("/(app)/reviews/intro");
    expect(arg.params.identityPhrase).toBe(
      encodeURIComponent("Becoming a runner"),
    );
    expect(arg.params.returnTo).toBe("habitDetail");
  });

  it("pushes the goal review route when the intro has been seen", async () => {
    mockIsWeeklyReviewIntroSeen.mockResolvedValue(true);
    await openGoalWeeklyReview({
      identityPhrase: "stoic",
      returnTo: "goalDetail",
    });
    expect(mockRouterPush).toHaveBeenCalledTimes(1);
    const arg = mockRouterPush.mock.calls[0][0];
    expect(arg.pathname).toBe("/(app)/reviews/goal/[identityPhrase]");
    expect(arg.params.identityPhrase).toBe(encodeURIComponent("stoic"));
    expect(arg.params.returnTo).toBe("goalDetail");
  });

  it("locks against double-tap while the read is pending", async () => {
    let resolveRead: (v: boolean) => void = () => {};
    mockIsWeeklyReviewIntroSeen.mockReturnValue(
      new Promise<boolean>((res) => {
        resolveRead = res;
      }),
    );

    const first = openGoalWeeklyReview({
      identityPhrase: "x",
      returnTo: "today",
    });
    const second = openGoalWeeklyReview({
      identityPhrase: "x",
      returnTo: "today",
    });

    // No push yet — read is still pending.
    expect(mockRouterPush).not.toHaveBeenCalled();
    // The second call returned immediately because the lock was held.
    await second;
    expect(mockRouterPush).not.toHaveBeenCalled();

    resolveRead(false);
    await first;
    expect(mockRouterPush).toHaveBeenCalledTimes(1);
  });

  it("falls back to the goal review route and logs when the read rejects", async () => {
    mockIsWeeklyReviewIntroSeen.mockRejectedValue(new Error("db locked"));

    await expect(
      openGoalWeeklyReview({ identityPhrase: "x", returnTo: "today" }),
    ).resolves.toBeUndefined();

    expect(mockRouterPush).toHaveBeenCalledTimes(1);
    expect(mockRouterPush.mock.calls[0][0].pathname).toBe(
      "/(app)/reviews/goal/[identityPhrase]",
    );
    expect(mockLoggerWarn).toHaveBeenCalledTimes(1);
  });

  it("releases the lock after a read failure so a later tap can push again", async () => {
    mockIsWeeklyReviewIntroSeen.mockRejectedValueOnce(new Error("transient"));
    await openGoalWeeklyReview({ identityPhrase: "x", returnTo: "today" });
    // Drain microtasks so queueMicrotask-scheduled lock release fires.
    await flushMicrotasks();

    mockIsWeeklyReviewIntroSeen.mockResolvedValueOnce(true);
    await openGoalWeeklyReview({ identityPhrase: "x", returnTo: "today" });

    expect(mockRouterPush).toHaveBeenCalledTimes(2);
  });
});
