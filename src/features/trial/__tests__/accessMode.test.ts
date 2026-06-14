import { isReadOnly, isPaywallLocked } from "@/features/trial/accessMode";

describe("isReadOnly", () => {
  it("returns false for full access", () => {
    expect(isReadOnly("full")).toBe(false);
  });

  it("returns true for read_only", () => {
    expect(isReadOnly("read_only")).toBe(true);
  });

  it("returns true for expired_no_purchase (treated like read_only until paywall ships)", () => {
    expect(isReadOnly("expired_no_purchase")).toBe(true);
  });
});

describe("isPaywallLocked", () => {
  it("is true only for expired_no_purchase", () => {
    expect(isPaywallLocked("expired_no_purchase")).toBe(true);
    expect(isPaywallLocked("read_only")).toBe(false);
    expect(isPaywallLocked("full")).toBe(false);
  });
});
