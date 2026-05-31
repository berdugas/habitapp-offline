import { computeAccessMode } from "@/features/trial/grace";
import { TRIAL_GRACE_PERIOD_DAYS } from "@/features/trial/types";

describe("computeAccessMode", () => {
  function isoDaysAgo(days: number, fromNow: Date = new Date()): string {
    return new Date(fromNow.getTime() - days * 24 * 60 * 60 * 1000).toISOString();
  }

  it("returns read_only when lastValidatedAt is null", () => {
    expect(
      computeAccessMode({
        lastValidatedAt: null,
        now: new Date("2026-05-01T00:00:00.000Z"),
      }),
    ).toBe("read_only");
  });

  it("returns read_only when lastValidatedAt is malformed", () => {
    expect(
      computeAccessMode({
        lastValidatedAt: "not-a-real-iso-string",
        now: new Date("2026-05-01T00:00:00.000Z"),
      }),
    ).toBe("read_only");
  });

  it("returns full at 0 days (just validated)", () => {
    const now = new Date("2026-05-01T00:00:00.000Z");
    expect(
      computeAccessMode({
        lastValidatedAt: now.toISOString(),
        now,
      }),
    ).toBe("full");
  });

  it("returns full just inside the boundary", () => {
    const now = new Date("2026-05-01T00:00:00.000Z");
    expect(
      computeAccessMode({
        lastValidatedAt: isoDaysAgo(TRIAL_GRACE_PERIOD_DAYS - 1, now),
        now,
      }),
    ).toBe("full");
  });

  it("returns full at exact boundary (inclusive)", () => {
    const now = new Date("2026-05-01T00:00:00.000Z");
    expect(
      computeAccessMode({
        lastValidatedAt: isoDaysAgo(TRIAL_GRACE_PERIOD_DAYS, now),
        now,
      }),
    ).toBe("full");
  });

  it("returns read_only at 1 ms past the boundary", () => {
    const now = new Date("2026-05-01T00:00:00.000Z");
    const oneMsAfterBoundary = new Date(
      now.getTime() - TRIAL_GRACE_PERIOD_DAYS * 24 * 60 * 60 * 1000 - 1,
    ).toISOString();
    expect(
      computeAccessMode({
        lastValidatedAt: oneMsAfterBoundary,
        now,
      }),
    ).toBe("read_only");
  });

  it("returns read_only just past the boundary", () => {
    const now = new Date("2026-05-01T00:00:00.000Z");
    expect(
      computeAccessMode({
        lastValidatedAt: isoDaysAgo(TRIAL_GRACE_PERIOD_DAYS + 1, now),
        now,
      }),
    ).toBe("read_only");
  });

  it("returns read_only well past the boundary", () => {
    const now = new Date("2026-05-01T00:00:00.000Z");
    expect(
      computeAccessMode({
        lastValidatedAt: isoDaysAgo(TRIAL_GRACE_PERIOD_DAYS * 2, now),
        now,
      }),
    ).toBe("read_only");
  });

  it("returns full when validation timestamp is in the future (clock skew)", () => {
    // If device clock drifted backward, cached timestamp may be ahead of now.
    // Negative age stays within grace — don't flip to read_only on skew.
    const now = new Date("2026-05-01T00:00:00.000Z");
    const futureIso = new Date(now.getTime() + 60 * 1000).toISOString();
    expect(
      computeAccessMode({
        lastValidatedAt: futureIso,
        now,
      }),
    ).toBe("full");
  });
});
