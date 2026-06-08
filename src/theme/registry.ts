import { zen } from "@/theme/themes/zen";
import { cafe } from "@/theme/themes/cafe";
import { fantasy } from "@/theme/themes/fantasy";
import { play } from "@/theme/themes/play";
import { energy } from "@/theme/themes/energy";
import { sound } from "@/theme/themes/sound";

import type { Theme, ThemeId } from "@/theme/contract";

export const THEMES: Record<ThemeId, Theme> = {
  zen,
  cafe,
  fantasy,
  play,
  energy,
  sound,
};

export function getTheme(id: ThemeId): Theme {
  return THEMES[id];
}

export function isKnownThemeId(value: unknown): value is ThemeId {
  return (
    value === "zen" ||
    value === "cafe" ||
    value === "fantasy" ||
    value === "play" ||
    value === "energy" ||
    value === "sound"
  );
}
