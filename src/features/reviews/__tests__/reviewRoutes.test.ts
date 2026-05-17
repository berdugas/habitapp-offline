import {
  goalReviewRoute,
  normalizeReturnTo,
  weeklyReviewIntroRoute,
} from "@/features/reviews/reviewRoutes";

describe("normalizeReturnTo", () => {
  it("passes through 'today'", () => {
    expect(normalizeReturnTo("today")).toBe("today");
  });

  it("passes through 'habitDetail'", () => {
    expect(normalizeReturnTo("habitDetail")).toBe("habitDetail");
  });

  it("passes through 'goalDetail'", () => {
    expect(normalizeReturnTo("goalDetail")).toBe("goalDetail");
  });

  it("defaults undefined to 'goalDetail'", () => {
    expect(normalizeReturnTo(undefined)).toBe("goalDetail");
  });

  it("unwraps array values via normalizeParam", () => {
    expect(normalizeReturnTo(["today"])).toBe("today");
    expect(normalizeReturnTo(["habitDetail", "today"])).toBe("habitDetail");
  });

  it("defaults unrecognized strings to 'goalDetail'", () => {
    expect(normalizeReturnTo("nowhere")).toBe("goalDetail");
    expect(normalizeReturnTo("")).toBe("goalDetail");
  });
});

describe("goalReviewRoute", () => {
  it("returns the goal review pathname with URL-encoded identityPhrase", () => {
    const route = goalReviewRoute("Becoming a runner", "today");
    expect(route.pathname).toBe("/(app)/reviews/goal/[identityPhrase]");
    expect(route.params.identityPhrase).toBe(
      encodeURIComponent("Becoming a runner"),
    );
    expect(route.params.returnTo).toBe("today");
  });

  it("encodes special characters that require URL encoding", () => {
    const route = goalReviewRoute("a/b%c d", "goalDetail");
    expect(route.params.identityPhrase).toBe(encodeURIComponent("a/b%c d"));
  });
});

describe("weeklyReviewIntroRoute", () => {
  it("returns the intro pathname with URL-encoded identityPhrase", () => {
    const route = weeklyReviewIntroRoute("Becoming a runner", "habitDetail");
    expect(route.pathname).toBe("/(app)/reviews/intro");
    expect(route.params.identityPhrase).toBe(
      encodeURIComponent("Becoming a runner"),
    );
    expect(route.params.returnTo).toBe("habitDetail");
  });
});
