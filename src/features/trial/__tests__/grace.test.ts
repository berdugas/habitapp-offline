import { computeAccessMode } from "@/features/trial/grace";

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

  it("returns full at 6 days", () => {
    const now = new Date("2026-05-01T00:00:00.000Z");
    expect(
      computeAccessMode({
        lastValidatedAt: isoDaysAgo(6, now),
        now,
      }),
    ).toBe("full");
  });

  it("returns full at exactly 7 days (boundary inclusive)", () => {
    const now = new Date("2026-05-01T00:00:00.000Z");
    expect(
      computeAccessMode({
        lastValidatedAt: isoDaysAgo(7, now),
        now,
      }),
    ).toBe("full");
  });

  it("returns read_only at 7 days + 1 millisecond", () => {
    const now = new Date("2026-05-01T00:00:00.000Z");
    const oneMsAfterBoundary = new Date(
      now.getTime() - 7 * 24 * 60 * 60 * 1000 - 1,
    ).toISOString();
    expect(
      computeAccessMode({
        lastValidatedAt: oneMsAfterBoundary,
        now,
      }),
    ).toBe("read_only");
  });

  it("returns read_only at 8 days", () => {
    const now = new Date("2026-05-01T00:00:00.000Z");
    expect(
      computeAccessMode({
        lastValidatedAt: isoDaysAgo(8, now),
        now,
      }),
    ).toBe("read_only");
  });

  it("returns read_only at 30 days", () => {
    const now = new Date("2026-05-01T00:00:00.000Z");
    expect(
      computeAccessMode({
        lastValidatedAt: isoDaysAgo(30, now),
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
