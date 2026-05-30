import { useThemeContext } from "@/theme/ThemeProvider";

import type { Theme } from "@/theme/contract";

/**
 * Returns the runtime-active Theme object. Components should use this for any
 * styling values that should reflect the user's theme choice.
 */
export function useTheme(): Theme {
  return useThemeContext().theme;
}
