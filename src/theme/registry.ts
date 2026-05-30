import { zen } from "@/theme/themes/zen";
import { cafe } from "@/theme/themes/cafe";
import { fantasy } from "@/theme/themes/fantasy";

import type { Theme, ThemeId } from "@/theme/contract";

export const THEMES: Record<ThemeId, Theme> = {
  zen,
  cafe,
  fantasy,
};

export function getTheme(id: ThemeId): Theme {
  return THEMES[id];
}

export function isKnownThemeId(value: unknown): value is ThemeId {
  return value === "zen" || value === "cafe" || value === "fantasy";
}
