import { render, screen, act } from "@testing-library/react-native";
import { Text } from "react-native";

import { ThemeId } from "@/theme/contract";
import { ThemeProvider, useThemeContext } from "@/theme/ThemeProvider";

function Probe() {
  const { theme, intendedThemeId } = useThemeContext();
  return (
    <>
      <Text testID="active-id">{theme.id}</Text>
      <Text testID="intended-id">{intendedThemeId}</Text>
    </>
  );
}

describe("ThemeProvider", () => {
  it("renders with the initial theme", () => {
    render(
      <ThemeProvider initialThemeId="cafe" intendedThemeId="cafe">
        <Probe />
      </ThemeProvider>,
    );
    expect(screen.getByTestId("active-id").props.children).toBe("cafe");
    expect(screen.getByTestId("intended-id").props.children).toBe("cafe");
  });

  it("setActiveTheme switches the active theme", () => {
    let captured: ((id: ThemeId) => void) | null = null;

    function Capture() {
      const { setActiveTheme, theme } = useThemeContext();
      captured = setActiveTheme;
      return <Text testID="active-id">{theme.id}</Text>;
    }

    render(
      <ThemeProvider initialThemeId="zen" intendedThemeId="zen">
        <Capture />
      </ThemeProvider>,
    );
    expect(screen.getByTestId("active-id").props.children).toBe("zen");

    act(() => {
      captured!("fantasy");
    });
    expect(screen.getByTestId("active-id").props.children).toBe("fantasy");
  });

  it("intendedThemeId differs from active when fallback fired", () => {
    render(
      <ThemeProvider initialThemeId="zen" intendedThemeId="cafe">
        <Probe />
      </ThemeProvider>,
    );
    expect(screen.getByTestId("active-id").props.children).toBe("zen");
    expect(screen.getByTestId("intended-id").props.children).toBe("cafe");
  });

  it("throws when used outside provider", () => {
    const original = console.error;
    console.error = () => {};
    expect(() => render(<Probe />)).toThrow(/ThemeProvider/);
    console.error = original;
  });
});
