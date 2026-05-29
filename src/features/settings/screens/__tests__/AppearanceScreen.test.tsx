import { renderWithTheme, screen } from "@/tests/setup/renderWithTheme";

import AppearanceScreen from "@/features/settings/screens/AppearanceScreen";

// lucide-react-native's icons propagate `testID` onto BOTH the root <Svg> and
// each child <Path>, so queryByTestId would throw on a duplicate match. Stub
// <Path> so only the icon's root node carries the testID. (Real <Svg>/<SvgXml>
// are preserved so previews and the icon root still render.)
jest.mock("react-native-svg", () => ({
  ...jest.requireActual("react-native-svg"),
  Path: () => null,
}));

jest.mock("@/services/analytics", () => ({ trackEvent: jest.fn() }));

import { trackEvent } from "@/services/analytics";

beforeEach(() => {
  jest.clearAllMocks();
});

describe("AppearanceScreen", () => {
  it("renders one card per theme", () => {
    renderWithTheme(<AppearanceScreen />);
    expect(screen.getByText("Zen")).toBeTruthy();
    expect(screen.getByText("Cafe")).toBeTruthy();
    expect(screen.getByText("Fantasy")).toBeTruthy();
  });

  it("marks the active theme card with a checkmark", () => {
    renderWithTheme(<AppearanceScreen />, { themeId: "fantasy" });
    expect(screen.queryByTestId("active-checkmark-fantasy")).toBeTruthy();
    expect(screen.queryByTestId("active-checkmark-zen")).toBeFalsy();
    expect(screen.queryByTestId("active-checkmark-cafe")).toBeFalsy();
  });

  it("fires settings_appearance_opened on mount", () => {
    renderWithTheme(<AppearanceScreen />);
    expect(trackEvent).toHaveBeenCalledWith("settings_appearance_opened");
  });
});
