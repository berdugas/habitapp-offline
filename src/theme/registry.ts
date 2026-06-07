import { zen } from "@/theme/themes/zen";
import { cafe } from "@/theme/themes/cafe";
import { fantasy } from "@/theme/themes/fantasy";
import { play } from "@/theme/themes/play";

import type { Theme, ThemeId } from "@/theme/contract";

export const THEMES = {
  zen,
  cafe,
  fantasy,
  play,
} satisfies Partial<Record<ThemeId, Theme>>;

export function getTheme(id: ThemeId): Theme {
  return THEMES[id]!;
}

export function isKnownThemeId(value: unknown): value is ThemeId {
  return (
    value === "zen" ||
    value === "cafe" ||
    value === "fantasy" ||
    value === "play"
  );
}
