import { THEMES, getTheme, isKnownThemeId } from "@/theme/registry";

describe("Theme registry", () => {
  it("THEMES exposes zen, cafe, fantasy", () => {
    expect(THEMES.zen.id).toBe("zen");
    expect(THEMES.cafe.id).toBe("cafe");
    expect(THEMES.fantasy.id).toBe("fantasy");
  });

  it("getTheme returns the registered theme", () => {
    expect(getTheme("cafe").name).toBe("Cafe");
  });

  it("isKnownThemeId returns true for valid ids, false for others", () => {
    expect(isKnownThemeId("zen")).toBe(true);
    expect(isKnownThemeId("cafe")).toBe(true);
    expect(isKnownThemeId("fantasy")).toBe(true);
    expect(isKnownThemeId("nonsense")).toBe(false);
    expect(isKnownThemeId(null)).toBe(false);
    expect(isKnownThemeId(undefined)).toBe(false);
  });
});
