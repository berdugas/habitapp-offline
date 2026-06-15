import { redact } from "@/services/telemetryRedact";

describe("redact()", () => {
  it("returns {} for undefined / null / empty input", () => {
    expect(redact()).toEqual({});
    expect(redact(undefined)).toEqual({});
    expect(redact(null)).toEqual({});
    expect(redact({})).toEqual({});
  });

  it("passes allowlisted string keys unchanged", () => {
    expect(redact({ habit_id: "abc-123", goal_id: "g-456" })).toEqual({
      habit_id: "abc-123",
      goal_id: "g-456",
    });
  });

  it("redacts string values for keys NOT on the allowlist", () => {
    expect(redact({ email: "user@example.com", habit_name: "Therapy" })).toEqual({
      email: "[redacted]",
      habit_name: "[redacted]",
    });
  });

  it("passes paywall funnel enums (trigger, error_kind) unchanged", () => {
    // These keys carry the expiry funnel's grouping value and the failure
    // classification — they must reach PostHog unredacted or the funnel and
    // error segmentation collapse to "[redacted]".
    expect(
      redact({ trigger: "expiry", error_kind: "identity_failed" }),
    ).toEqual({ trigger: "expiry", error_kind: "identity_failed" });
  });

  it("passes numbers regardless of key", () => {
    expect(redact({ streak: 5, randomNumber: 42 })).toEqual({
      streak: 5,
      randomNumber: 42,
    });
  });

  it("passes booleans regardless of key", () => {
    expect(redact({ success: true, secretFlag: false })).toEqual({
      success: true,
      secretFlag: false,
    });
  });

  it("preserves null and undefined values", () => {
    expect(redact({ reason: null, status: undefined })).toEqual({
      reason: null,
      status: undefined,
    });
  });

  it("recurses into nested plain objects", () => {
    const result = redact({
      action: "create",
      nested: {
        habit_id: "abc",
        email: "x@y.z",
        deeper: { count: 7, secret: "hush" },
      },
    });
    expect(result).toEqual({
      action: "create",
      nested: {
        habit_id: "abc",
        email: "[redacted]",
        deeper: { count: 7, secret: "[redacted]" },
      },
    });
  });

  it("redacts Error instances (does not recurse into them)", () => {
    const err = new Error("boom");
    expect(redact({ contextMessage: "wrapped", err })).toEqual({
      contextMessage: "wrapped",
      err: "[redacted]",
    });
  });

  it("walks arrays of primitives, redacting strings when key not allowlisted", () => {
    expect(redact({ habit_id: ["a", "b", "c"], emails: ["x@y.z"] })).toEqual({
      habit_id: ["a", "b", "c"],
      emails: ["[redacted]"],
    });
  });

  it("walks arrays of objects", () => {
    expect(
      redact({
        items: [
          { habit_id: "h1", note: "private" },
          { habit_id: "h2", note: "secret" },
        ],
      }),
    ).toEqual({
      items: [
        { habit_id: "h1", note: "[redacted]" },
        { habit_id: "h2", note: "[redacted]" },
      ],
    });
  });

  it("keeps numbers and booleans inside arrays regardless of key", () => {
    expect(redact({ counts: [1, 2, 3], flags: [true, false] })).toEqual({
      counts: [1, 2, 3],
      flags: [true, false],
    });
  });
});
