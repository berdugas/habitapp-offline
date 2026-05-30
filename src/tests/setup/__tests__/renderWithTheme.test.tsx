import { Text } from "react-native";

import { renderWithTheme, screen } from "@/tests/setup/renderWithTheme";
import { useTheme } from "@/theme/useTheme";

function Probe() {
  const theme = useTheme();
  return <Text testID="id">{theme.id}</Text>;
}

describe("renderWithTheme", () => {
  it("provides Zen by default", () => {
    renderWithTheme(<Probe />);
    expect(screen.getByTestId("id").props.children).toBe("zen");
  });

  it("accepts a themeId override", () => {
    renderWithTheme(<Probe />, { themeId: "fantasy" });
    expect(screen.getByTestId("id").props.children).toBe("fantasy");
  });
});
