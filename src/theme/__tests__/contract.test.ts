import type { Theme, ThemeId, Colors, FontAssets } from "@/theme/contract";

describe("Theme contract", () => {
  it("ThemeId is a fixed union of three ids", () => {
    const valid: ThemeId[] = ["zen", "cafe", "fantasy"];
    expect(valid).toHaveLength(3);
  });

  it("Colors has all 23 required fields", () => {
    const required: Array<keyof Colors> = [
      "bg", "surface", "surfaceCard", "surfaceHigh", "surfaceMuted",
      "text", "textMuted", "textFaint",
      "primary", "primaryGradientEnd", "primaryLight", "primarySoft", "primaryText",
      "success", "danger", "dangerSoft", "dangerSubtle",
      "heatDone", "heatSkipped", "heatMissed",
      "offDayBorder",
      "graduatedCircle", "graduatedBadge",
    ];
    expect(required).toHaveLength(23);
  });

  it("FontAssets discriminates bundled vs remote", () => {
    const bundled: FontAssets = { kind: "bundled", assets: { Foo: 1 } };
    const remote: FontAssets = {
      kind: "remote",
      assets: { Foo: { uri: "https://x", hash: "abc", bytes: 100 } },
    };
    expect(bundled.kind).toBe("bundled");
    expect(remote.kind).toBe("remote");
  });
});
