import { extractIdentityNoun } from "../identityNoun";

describe("extractIdentityNoun", () => {
  describe('pattern: "a [word]"', () => {
    it.each([
      ["a runner", "runner"],
      ["a writer", "writer"],
      ["a reader", "reader"],
      ["a meditator", "meditator"],
    ])("%s → %s", (input, expected) => {
      expect(extractIdentityNoun(input)).toBe(expected);
    });
  });

  describe('pattern: "a [word] person"', () => {
    it.each([
      ["a calmer person", "calmer"],
      ["a kinder person", "kinder"],
      // Multi-word adjective is a known coverage gap — pattern 1's regex
      // requires a single \S+ before "person".
      ["a more patient person", null],
    ])("%s → %s", (input, expected) => {
      expect(extractIdentityNoun(input)).toBe(expected);
    });
  });

  describe('pattern: "someone who [verb]"', () => {
    it.each([
      ["someone who runs", "runner"],
      ["someone who reads", "reader"],
      ["someone who writes", "writer"],
      ["someone who meditates", "meditator"],
      ["someone who walks", "walker"],
      ["someone who exercises", "exerciser"],
    ])("%s → %s", (input, expected) => {
      expect(extractIdentityNoun(input)).toBe(expected);
    });

    it("returns null for verbs not in the lookup table", () => {
      expect(extractIdentityNoun("someone who jogs")).toBeNull();
      expect(extractIdentityNoun("someone who codes")).toBeNull();
    });
  });

  describe("fallbacks", () => {
    it.each([
      ["", null],
      ["   ", null],
      ["I want to be healthy", null],
      ["happy", null],
      ["a", null],
    ])("%s → %s", (input, expected) => {
      expect(extractIdentityNoun(input)).toBe(expected);
    });
  });

  describe("case insensitivity", () => {
    it.each([
      ["A Runner", "runner"],
      ["SOMEONE WHO READS", "reader"],
      ["a Calmer Person", "calmer"],
    ])("%s → %s", (input, expected) => {
      expect(extractIdentityNoun(input)).toBe(expected);
    });
  });
});
