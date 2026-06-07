import { THEMES, getTheme, isKnownThemeId } from "@/theme/registry";

describe("Theme registry", () => {
  it("THEMES exposes zen, cafe, fantasy, play", () => {
    expect(THEMES.zen.id).toBe("zen");
    expect(THEMES.cafe.id).toBe("cafe");
    expect(THEMES.fantasy.id).toBe("fantasy");
    expect(THEMES.play.id).toBe("play");
  });

  it("getTheme returns the registered theme", () => {
    expect(getTheme("cafe").name).toBe("Cafe");
    expect(getTheme("play").name).toBe("Play");
  });

  it("isKnownThemeId returns true for valid ids, false for others", () => {
    expect(isKnownThemeId("zen")).toBe(true);
    expect(isKnownThemeId("cafe")).toBe(true);
    expect(isKnownThemeId("fantasy")).toBe(true);
    expect(isKnownThemeId("play")).toBe(true);
    expect(isKnownThemeId("nonsense")).toBe(false);
    expect(isKnownThemeId(null)).toBe(false);
    expect(isKnownThemeId(undefined)).toBe(false);
  });
});
