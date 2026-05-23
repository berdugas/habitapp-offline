import { hashIdentityPhrase } from "@/utils/hash";

describe("hashIdentityPhrase", () => {
  it("returns an 8-character hex string", () => {
    const hash = hashIdentityPhrase("become a runner");
    expect(hash).toMatch(/^[0-9a-f]{8}$/);
  });

  it("is deterministic — same input always hashes to the same value", () => {
    expect(hashIdentityPhrase("read more books")).toBe(
      hashIdentityPhrase("read more books"),
    );
  });

  it("differentiates distinct inputs", () => {
    const a = hashIdentityPhrase("become a runner");
    const b = hashIdentityPhrase("become a writer");
    expect(a).not.toBe(b);
  });

  it("treats whitespace and case as significant — does not normalize", () => {
    // Important: the goal mutations key on identity_phrase as-stored,
    // so the hash must mirror the stored form exactly. A leading space
    // or capitalization change yields a different goal in the DB and
    // must yield a different hash here.
    expect(hashIdentityPhrase("Become a runner")).not.toBe(
      hashIdentityPhrase("become a runner"),
    );
    expect(hashIdentityPhrase(" become a runner")).not.toBe(
      hashIdentityPhrase("become a runner"),
    );
  });

  it("handles the empty string by returning the FNV offset basis", () => {
    // Documented behavior: empty input collapses to the algorithm's
    // initial state. Won't happen in practice (the goal mutations
    // reject empty identityPhrase upstream) but the hash itself
    // shouldn't throw.
    expect(hashIdentityPhrase("")).toBe("811c9dc5");
  });

  it("handles unicode characters without throwing", () => {
    expect(() => hashIdentityPhrase("become a 🏃 runner")).not.toThrow();
    expect(hashIdentityPhrase("become a 🏃 runner")).toMatch(/^[0-9a-f]{8}$/);
  });
});
