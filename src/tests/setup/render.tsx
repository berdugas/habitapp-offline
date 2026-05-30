import { renderWithTheme } from "@/tests/setup/renderWithTheme";

/**
 * Drop-in replacement for @testing-library/react-native's `render` that wraps
 * the UI in a default-Zen ThemeProvider. Use this in tests for components that
 * call `useTheme()` or `useThemedStyles()`.
 *
 * For tests that need a specific theme, import `renderWithTheme` directly.
 */
export const render = renderWithTheme;
export { screen, act, fireEvent, waitFor } from "@testing-library/react-native";
