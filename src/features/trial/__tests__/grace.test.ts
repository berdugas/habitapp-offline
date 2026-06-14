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

  describe("with entitlement-aware branches", () => {
    const now = new Date("2026-05-15T00:00:00.000Z");
    const freshCache = now.toISOString(); // last validated just now

    it("returns full for paid entitlement, regardless of staleness", () => {
      // Even with an ancient cache, paid users get full access.
      expect(
        computeAccessMode({
          lastValidatedAt: isoDaysAgo(365, now),
          entitlementStatus: "paid",
          trialEndsAt: null,
          now,
        }),
      ).toBe("full");
    });

    it("returns expired_no_purchase for explicit 'expired' status", () => {
      expect(
        computeAccessMode({
          lastValidatedAt: freshCache,
          entitlementStatus: "expired",
          trialEndsAt: isoDaysAgo(1, now),
          now,
        }),
      ).toBe("expired_no_purchase");
    });

    it("returns expired_no_purchase for 'trial' status when trial_ends_at has passed (client guard)", () => {
      expect(
        computeAccessMode({
          lastValidatedAt: freshCache,
          entitlementStatus: "trial",
          trialEndsAt: isoDaysAgo(1, now),
          now,
        }),
      ).toBe("expired_no_purchase");
    });

    it("returns full for 'trial' status when trial_ends_at is still in the future", () => {
      expect(
        computeAccessMode({
          lastValidatedAt: freshCache,
          entitlementStatus: "trial",
          trialEndsAt: new Date(now.getTime() + 86400000).toISOString(), // +1 day
          now,
        }),
      ).toBe("full");
    });

    it("falls through to staleness logic when entitlementStatus is null", () => {
      expect(
        computeAccessMode({
          lastValidatedAt: freshCache,
          entitlementStatus: null,
          trialEndsAt: null,
          now,
        }),
      ).toBe("full");
    });

    it("paid bypass beats stale cache", () => {
      // (D4) says "no cache → read_only", but paid users should never
      // hit that branch. Paid bypass is checked first.
      expect(
        computeAccessMode({
          lastValidatedAt: null,
          entitlementStatus: "paid",
          trialEndsAt: null,
          now,
        }),
      ).toBe("full");
    });

    it("treats 'active' like 'paid' (defensive — dead in current client, live in schema)", () => {
      expect(
        computeAccessMode({
          lastValidatedAt: isoDaysAgo(365, now),
          entitlementStatus: "active",
          trialEndsAt: null,
          now,
        }),
      ).toBe("full");
    });

    it("treats 'cancelled' like 'expired' (defensive)", () => {
      expect(
        computeAccessMode({
          lastValidatedAt: freshCache,
          entitlementStatus: "cancelled",
          trialEndsAt: null,
          now,
        }),
      ).toBe("expired_no_purchase");
    });
  });

  it("uses a 14-day staleness grace window in production", () => {
    expect(TRIAL_GRACE_PERIOD_DAYS).toBe(14);
  });
});
