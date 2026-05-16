import { normalizeParam } from "@/utils/params";

describe("normalizeParam", () => {
  it("returns the value unchanged when given a string", () => {
    expect(normalizeParam("abc")).toBe("abc");
  });

  it("returns the first element when given an array", () => {
    expect(normalizeParam(["first", "second"])).toBe("first");
  });

  it("returns undefined when given undefined", () => {
    expect(normalizeParam(undefined)).toBeUndefined();
  });
});
