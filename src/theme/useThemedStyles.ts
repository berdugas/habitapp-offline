import { useMemo } from "react";

import { useTheme } from "@/theme/useTheme";

import type { Theme } from "@/theme/contract";

/**
 * Builds a memoized StyleSheet from the current theme. The factory is called
 * once per theme change. Components should prefer this over inline styles to
 * keep the existing StyleSheet.create performance characteristics.
 *
 * Usage:
 *   const styles = useThemedStyles((theme) =>
 *     StyleSheet.create({ card: { backgroundColor: theme.colors.surfaceCard } })
 *   );
 */
export function useThemedStyles<T>(factory: (theme: Theme) => T): T {
  const theme = useTheme();
  return useMemo(() => factory(theme), [theme, factory]);
}
