import { isReadOnly } from "@/features/trial/accessMode";

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
