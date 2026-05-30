import { render, RenderOptions } from "@testing-library/react-native";

import { ThemeProvider } from "@/theme/ThemeProvider";

import type { ThemeId } from "@/theme/contract";

type Options = Omit<RenderOptions, "wrapper"> & {
  themeId?: ThemeId;
};

export function renderWithTheme(ui: React.ReactElement, options: Options = {}) {
  const themeId = options.themeId ?? "zen";

  function Wrapper({ children }: { children: React.ReactNode }) {
    return (
      <ThemeProvider initialThemeId={themeId} intendedThemeId={themeId}>
        {children}
      </ThemeProvider>
    );
  }

  return render(ui, { ...options, wrapper: Wrapper });
}

export { screen, act, fireEvent, waitFor } from "@testing-library/react-native";
