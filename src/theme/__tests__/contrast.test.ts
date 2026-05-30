import { THEMES } from "@/theme/registry";

import type { Colors, Theme } from "@/theme/contract";

type Waiver = {
  themeId: Theme["id"];
  fg: keyof Colors;
  bg: keyof Colors;
  reason: string;
};

const KNOWN_CONTRAST_WAIVERS: Waiver[] = [
  // textFaint is a deliberately-faint hint color; fails AA Normal on every
  // surface in all three themes (~2.3-3.1:1). Pre-existing in Zen; mirrored in
  // Cafe/Fantasy. Tracked in spec §12 v2 followups #8.
  { themeId: "zen",     fg: "textFaint",       bg: "bg",             reason: "Body-faint copy fails AA Normal; spec §12 #8" },
  { themeId: "zen",     fg: "textFaint",       bg: "surfaceCard",    reason: "Body-faint copy fails AA Normal; spec §12 #8" },
  { themeId: "zen",     fg: "textFaint",       bg: "surface",        reason: "Body-faint copy fails AA Normal; spec §12 #8" },
  { themeId: "cafe",    fg: "textFaint",       bg: "bg",             reason: "Body-faint copy fails AA Normal; spec §12 #8" },
  { themeId: "cafe",    fg: "textFaint",       bg: "surfaceCard",    reason: "Body-faint copy fails AA Normal; spec §12 #8" },
  { themeId: "cafe",    fg: "textFaint",       bg: "surface",        reason: "Body-faint copy fails AA Normal; spec §12 #8" },
  { themeId: "fantasy", fg: "textFaint",       bg: "bg",             reason: "Body-faint copy fails AA Normal; spec §12 #8" },
  { themeId: "fantasy", fg: "textFaint",       bg: "surfaceCard",    reason: "Body-faint copy fails AA Normal; spec §12 #8" },
  { themeId: "fantasy", fg: "textFaint",       bg: "surface",        reason: "Body-faint copy fails AA Normal; spec §12 #8" },
  // Zen's mint-on-mint graduated badge (2.38:1) is the shipping app's pairing;
  // Zen is frozen to today's look. Cafe/Fantasy graduated pairs pass AA.
  { themeId: "zen",     fg: "graduatedCircle", bg: "graduatedBadge", reason: "Pre-existing low-contrast graduated badge; Zen frozen; spec §12 #8" },
];

const REQUIRED_PAIRS: Array<{ fg: keyof Colors; bg: keyof Colors }> = [
  { fg: "text",            bg: "bg" },
  { fg: "text",            bg: "surfaceCard" },
  { fg: "text",            bg: "surface" },
  { fg: "textMuted",       bg: "bg" },
  { fg: "textMuted",       bg: "surfaceCard" },
  { fg: "textMuted",       bg: "surface" },
  { fg: "textFaint",       bg: "bg" },
  { fg: "textFaint",       bg: "surfaceCard" },
  { fg: "textFaint",       bg: "surface" },
  { fg: "primaryText",     bg: "primary" },
  { fg: "graduatedCircle", bg: "graduatedBadge" },
];

const AA_NORMAL = 4.5;

function linearize(channel: number): number {
  const c = channel / 255;
  return c <= 0.03928 ? c / 12.92 : Math.pow((c + 0.055) / 1.055, 2.4);
}

function luminance(hex: string): number {
  const r = parseInt(hex.slice(1, 3), 16);
  const g = parseInt(hex.slice(3, 5), 16);
  const b = parseInt(hex.slice(5, 7), 16);
  return 0.2126 * linearize(r) + 0.7152 * linearize(g) + 0.0722 * linearize(b);
}

function contrastRatio(fgHex: string, bgHex: string): number {
  const l1 = luminance(fgHex);
  const l2 = luminance(bgHex);
  const [hi, lo] = l1 > l2 ? [l1, l2] : [l2, l1];
  return (hi + 0.05) / (lo + 0.05);
}

function isWaived(themeId: Theme["id"], fg: keyof Colors, bg: keyof Colors): boolean {
  return KNOWN_CONTRAST_WAIVERS.some(
    (w) => w.themeId === themeId && w.fg === fg && w.bg === bg,
  );
}

describe("Theme color contrast", () => {
  for (const [themeId, theme] of Object.entries(THEMES) as Array<[Theme["id"], Theme]>) {
    describe(`${themeId} theme`, () => {
      for (const { fg, bg } of REQUIRED_PAIRS) {
        const fgValue = theme.colors[fg];
        const bgValue = theme.colors[bg];
        const ratio = contrastRatio(fgValue, bgValue);
        const waived = isWaived(themeId, fg, bg);

        if (waived) {
          it(`${fg} on ${bg} is waived (ratio: ${ratio.toFixed(2)})`, () => {
            expect(waived).toBe(true);
          });
        } else {
          it(`${fg} on ${bg} meets AA Normal (4.5:1)`, () => {
            expect(ratio).toBeGreaterThanOrEqual(AA_NORMAL);
          });
        }
      }
    });
  }
});
