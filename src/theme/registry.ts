import { zen } from "@/theme/themes/zen";
import { cafe } from "@/theme/themes/cafe";
import { fantasy } from "@/theme/themes/fantasy";
import { play } from "@/theme/themes/play";

import type { Theme, ThemeId } from "@/theme/contract";

// `energy` and `sound` are absent until Tasks 6 and 7; the cast preserves the
// strict-Record contract for callers. The lie is safe because `isKnownThemeId`
// gates the only entry points that resolve a `ThemeId` against `THEMES`.
export const THEMES: Record<ThemeId, Theme> = {
  zen,
  cafe,
  fantasy,
  play,
} as Record<ThemeId, Theme>;

export function getTheme(id: ThemeId): Theme {
  return THEMES[id];
}

export function isKnownThemeId(value: unknown): value is ThemeId {
  return (
    value === "zen" ||
    value === "cafe" ||
    value === "fantasy" ||
    value === "play"
  );
}
