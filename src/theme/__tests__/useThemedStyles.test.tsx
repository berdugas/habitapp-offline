import { render, screen, act } from "@testing-library/react-native";
import { StyleSheet, Text, View } from "react-native";

import { ThemeProvider, useThemeContext } from "@/theme/ThemeProvider";
import { useThemedStyles } from "@/theme/useThemedStyles";

function Box() {
  const styles = useThemedStyles((theme) =>
    StyleSheet.create({
      box: { backgroundColor: theme.colors.bg },
    }),
  );
  return <View testID="box" style={styles.box} />;
}

function Switcher() {
  const { setActiveTheme } = useThemeContext();
  return <Text testID="switch" onPress={() => setActiveTheme("fantasy")}>switch</Text>;
}

describe("useThemedStyles", () => {
  it("returns styles built from the current theme", () => {
    render(
      <ThemeProvider initialThemeId="zen" intendedThemeId="zen">
        <Box />
      </ThemeProvider>,
    );
    const flat = StyleSheet.flatten(screen.getByTestId("box").props.style);
    expect(flat.backgroundColor).toBe("#fbf9f5"); // Zen bg
  });

  it("rebuilds styles when theme changes", () => {
    render(
      <ThemeProvider initialThemeId="zen" intendedThemeId="zen">
        <Box />
        <Switcher />
      </ThemeProvider>,
    );

    let flat = StyleSheet.flatten(screen.getByTestId("box").props.style);
    expect(flat.backgroundColor).toBe("#fbf9f5");

    act(() => {
      screen.getByTestId("switch").props.onPress();
    });

    flat = StyleSheet.flatten(screen.getByTestId("box").props.style);
    expect(flat.backgroundColor).toBe("#FFFFFF"); // Fantasy bg
  });
});
