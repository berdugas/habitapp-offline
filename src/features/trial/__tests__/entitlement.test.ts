import { isPaidStatus } from "@/features/trial/entitlement";

describe("isPaidStatus", () => {
  it("returns true for paid", () => {
    expect(isPaidStatus("paid")).toBe(true);
  });
  it("returns true for active (defensive — dead value but paid-like)", () => {
    expect(isPaidStatus("active")).toBe(true);
  });
  it("returns false for trial", () => {
    expect(isPaidStatus("trial")).toBe(false);
  });
  it("returns false for expired", () => {
    expect(isPaidStatus("expired")).toBe(false);
  });
  it("returns false for cancelled", () => {
    expect(isPaidStatus("cancelled")).toBe(false);
  });
  it("returns false for null", () => {
    expect(isPaidStatus(null)).toBe(false);
  });
});
