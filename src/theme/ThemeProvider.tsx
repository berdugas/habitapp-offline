import { createContext, useCallback, useContext, useMemo, useState } from "react";

import { getTheme } from "@/theme/registry";

import type { Theme, ThemeId } from "@/theme/contract";

type ThemeContextValue = {
  /** Runtime-active theme (what's actually rendering). */
  theme: Theme;
  /** Theme id the user picked. May differ from `theme.id` after fallback. */
  intendedThemeId: ThemeId;
  /** Switch the runtime-active theme. Does NOT update intended/preference — caller does that. */
  setActiveTheme: (id: ThemeId) => void;
};

const ThemeContext = createContext<ThemeContextValue | null>(null);

type Props = {
  initialThemeId: ThemeId;
  intendedThemeId: ThemeId;
  children: React.ReactNode;
};

export function ThemeProvider({ initialThemeId, intendedThemeId, children }: Props) {
  const [activeId, setActiveId] = useState<ThemeId>(initialThemeId);

  const setActiveTheme = useCallback((id: ThemeId) => {
    setActiveId(id);
  }, []);

  const value = useMemo<ThemeContextValue>(
    () => ({
      theme: getTheme(activeId),
      intendedThemeId,
      setActiveTheme,
    }),
    [activeId, intendedThemeId, setActiveTheme],
  );

  return <ThemeContext.Provider value={value}>{children}</ThemeContext.Provider>;
}

export function useThemeContext(): ThemeContextValue {
  const ctx = useContext(ThemeContext);
  if (!ctx) {
    throw new Error("useThemeContext must be used inside <ThemeProvider>");
  }
  return ctx;
}
