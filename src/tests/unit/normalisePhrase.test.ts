import { normaliseBecomingPhrase } from "@/utils/normalisePhrase";

describe("normaliseBecomingPhrase", () => {
  // Baseline article logic
  it("prepends 'a' to a plain noun phrase", () => {
    expect(normaliseBecomingPhrase("runner")).toBe("a runner");
  });

  it("lowercases and prepends 'a' to a capitalised phrase", () => {
    expect(normaliseBecomingPhrase("Healthy Guy")).toBe("a healthy guy");
  });

  it("prepends 'an' for a vowel-initial phrase", () => {
    expect(normaliseBecomingPhrase("active person")).toBe("an active person");
  });

  it("is a no-op when phrase already starts with 'a '", () => {
    expect(normaliseBecomingPhrase("a runner")).toBe("a runner");
  });

  it("is a no-op when phrase already starts with 'an '", () => {
    expect(normaliseBecomingPhrase("An honest person")).toBe("an honest person");
  });

  it("is a no-op when phrase starts with 'the '", () => {
    expect(normaliseBecomingPhrase("the focused parent")).toBe("the focused parent");
  });

  it("is a no-op when phrase starts with 'someone'", () => {
    expect(normaliseBecomingPhrase("someone who reads daily")).toBe("someone who reads daily");
  });

  it("is a no-op when phrase starts with 'people'", () => {
    expect(normaliseBecomingPhrase("people who exercise")).toBe("people who exercise");
  });

  it("trims surrounding whitespace", () => {
    expect(normaliseBecomingPhrase("  runner  ")).toBe("a runner");
  });

  it("collapses internal whitespace", () => {
    expect(normaliseBecomingPhrase("better  partner")).toBe("a better partner");
  });

  it("returns empty string for blank input", () => {
    expect(normaliseBecomingPhrase("   ")).toBe("");
  });

  // Strip redundant sentence starters
  it("strips 'I am a ' prefix", () => {
    expect(normaliseBecomingPhrase("I am a runner")).toBe("a runner");
  });

  it("strips 'I am ' prefix and adds article to bare noun", () => {
    expect(normaliseBecomingPhrase("I am runner")).toBe("a runner");
  });

  it("strips 'I'm a ' prefix", () => {
    expect(normaliseBecomingPhrase("I'm a runner")).toBe("a runner");
  });

  it("strips 'I'm ' prefix and adds article", () => {
    expect(normaliseBecomingPhrase("I'm runner")).toBe("a runner");
  });

  it("strips 'Become a ' prefix", () => {
    expect(normaliseBecomingPhrase("Become a runner")).toBe("a runner");
  });

  it("strips 'Becoming a ' prefix", () => {
    expect(normaliseBecomingPhrase("Becoming a runner")).toBe("a runner");
  });

  it("strips 'I want to be a ' prefix", () => {
    expect(normaliseBecomingPhrase("I want to be a runner")).toBe("a runner");
  });

  it("strips 'I want to become a ' prefix", () => {
    expect(normaliseBecomingPhrase("I want to become a better reader")).toBe("a better reader");
  });

  it("strips prefix and preserves 'someone who' form", () => {
    expect(normaliseBecomingPhrase("I am someone who reads daily")).toBe("someone who reads daily");
  });

  it("handles mixed case 'BECOME a runner'", () => {
    expect(normaliseBecomingPhrase("BECOME a runner")).toBe("a runner");
  });
});
