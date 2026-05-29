import {
  isValidIdentityPhraseDraft,
  normaliseBecomingPhrase,
} from "@/utils/normalisePhrase";

describe("normaliseBecomingPhrase", () => {
  it("keeps a plain noun as typed (no article added)", () => {
    expect(normaliseBecomingPhrase("runner")).toBe("runner");
  });

  it("lowercases a capitalised phrase", () => {
    expect(normaliseBecomingPhrase("Healthy Guy")).toBe("healthy guy");
  });

  it("keeps a vowel-initial phrase as typed (no 'an' added)", () => {
    expect(normaliseBecomingPhrase("active person")).toBe("active person");
  });

  it("preserves a leading article the user typed", () => {
    expect(normaliseBecomingPhrase("a runner")).toBe("a runner");
    expect(normaliseBecomingPhrase("An honest person")).toBe("an honest person");
    expect(normaliseBecomingPhrase("the focused parent")).toBe("the focused parent");
  });

  it("preserves 'someone who' / 'people who' forms", () => {
    expect(normaliseBecomingPhrase("someone who reads daily")).toBe("someone who reads daily");
    expect(normaliseBecomingPhrase("people who exercise")).toBe("people who exercise");
  });

  it("trims surrounding whitespace", () => {
    expect(normaliseBecomingPhrase("  runner  ")).toBe("runner");
  });

  it("collapses internal whitespace", () => {
    expect(normaliseBecomingPhrase("better  partner")).toBe("better partner");
  });

  it("returns empty string for blank input", () => {
    expect(normaliseBecomingPhrase("   ")).toBe("");
  });

  it("strips 'I am a ' / 'I am ' lead-ins without adding an article", () => {
    expect(normaliseBecomingPhrase("I am a runner")).toBe("a runner");
    expect(normaliseBecomingPhrase("I am runner")).toBe("runner");
  });

  it("strips 'I'm a ' / 'I'm ' lead-ins", () => {
    expect(normaliseBecomingPhrase("I'm a runner")).toBe("a runner");
    expect(normaliseBecomingPhrase("I'm runner")).toBe("runner");
  });

  it("strips 'Become a ' / 'Becoming a ' lead-ins", () => {
    expect(normaliseBecomingPhrase("Become a runner")).toBe("a runner");
    expect(normaliseBecomingPhrase("Becoming a runner")).toBe("a runner");
  });

  it("strips 'I want to be a ' / 'I want to become a ' lead-ins", () => {
    expect(normaliseBecomingPhrase("I want to be a runner")).toBe("a runner");
    expect(normaliseBecomingPhrase("I want to become a better reader")).toBe("a better reader");
  });

  it("strips a lead-in and preserves the 'someone who' form", () => {
    expect(normaliseBecomingPhrase("I am someone who reads daily")).toBe("someone who reads daily");
  });

  it("handles mixed case 'BECOME a runner'", () => {
    expect(normaliseBecomingPhrase("BECOME a runner")).toBe("a runner");
  });

  it("regression: adjectives and verb phrases are no longer mangled with 'a'", () => {
    expect(normaliseBecomingPhrase("healthy")).toBe("healthy");
    expect(normaliseBecomingPhrase("read the bible")).toBe("read the bible");
  });
});

describe("isValidIdentityPhraseDraft", () => {
  it("accepts a cleaned phrase of length >= 2", () => {
    expect(isValidIdentityPhraseDraft("healthy")).toBe(true);
    expect(isValidIdentityPhraseDraft("ab")).toBe(true);
  });

  it("rejects input that cleans to fewer than 2 chars", () => {
    expect(isValidIdentityPhraseDraft("")).toBe(false);
    expect(isValidIdentityPhraseDraft("   ")).toBe(false);
    expect(isValidIdentityPhraseDraft("a")).toBe(false);
    // "become a" strips the "become " lead-in -> "a" (1 char)
    expect(isValidIdentityPhraseDraft("become a")).toBe(false);
  });

  it("rejects a cleaned phrase longer than the 240-char cap", () => {
    expect(isValidIdentityPhraseDraft("x".repeat(240))).toBe(true);
    expect(isValidIdentityPhraseDraft("x".repeat(241))).toBe(false);
  });
});
