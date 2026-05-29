import { Alert } from "react-native";

import { renderWithTheme, screen, fireEvent, act, waitFor } from "@/tests/setup/renderWithTheme";

import AppearanceScreen from "@/features/settings/screens/AppearanceScreen";

// lucide spreads testID onto root <Svg> AND child <Path>; stub Path so the
// active-checkmark testID resolves to a single node. Keep the rest of the
// real module so SvgXml + other primitives still work.
jest.mock("react-native-svg", () => ({
  ...jest.requireActual("react-native-svg"),
  Path: () => null,
}));

jest.mock("@/theme/fonts/loader", () => ({ loadFontsFor: jest.fn(() => Promise.resolve()) }));
jest.mock("@/services/analytics", () => ({ trackEvent: jest.fn() }));
jest.mock("@/lib/db/repositories/preferences", () => ({ setPreference: jest.fn(() => Promise.resolve()) }));
jest.mock("@/theme/fonts/cache", () => ({ clearFontCache: jest.fn(() => Promise.resolve()) }));

import { loadFontsFor } from "@/theme/fonts/loader";
import { trackEvent } from "@/services/analytics";
import { setPreference } from "@/lib/db/repositories/preferences";
import { clearFontCache } from "@/theme/fonts/cache";

const mockedLoad = loadFontsFor as jest.Mock;

beforeEach(() => {
  jest.clearAllMocks();
  mockedLoad.mockResolvedValue(undefined);
});

describe("AppearanceScreen", () => {
  it("renders one card per theme + fires opened telemetry", () => {
    renderWithTheme(<AppearanceScreen />);
    expect(screen.getByText("Zen")).toBeTruthy();
    expect(screen.getByText("Cafe")).toBeTruthy();
    expect(screen.getByText("Fantasy")).toBeTruthy();
    expect(trackEvent).toHaveBeenCalledWith("settings_appearance_opened");
  });

  it("no-ops when tapping the already-active theme", async () => {
    renderWithTheme(<AppearanceScreen />, { themeId: "cafe" });
    await act(async () => {
      fireEvent.press(screen.getByTestId("theme-card-cafe"));
    });
    expect(setPreference).not.toHaveBeenCalled();
    expect(trackEvent).toHaveBeenCalledWith(
      "theme_picker_card_pressed",
      expect.objectContaining({ theme_id: "cafe", was_active: true }),
    );
  });

  it("applies a bundled theme instantly without a modal", async () => {
    const alertSpy = jest.spyOn(Alert, "alert");
    renderWithTheme(<AppearanceScreen />, { themeId: "fantasy" });
    await act(async () => {
      fireEvent.press(screen.getByTestId("theme-card-zen"));
    });
    await waitFor(() => {
      expect(setPreference).toHaveBeenCalledWith("theme_id", "zen");
    });
    expect(alertSpy).not.toHaveBeenCalled();
    expect(trackEvent).toHaveBeenCalledWith(
      "theme_changed",
      expect.objectContaining({ from_theme_id: "fantasy", to_theme_id: "zen", required_download: false, was_retry: false }),
    );
    alertSpy.mockRestore();
  });

  it("shows a confirm modal then applies a remote theme on Download", async () => {
    const alertSpy = jest
      .spyOn(Alert, "alert")
      .mockImplementation((_t, _m, btns: any) => {
        btns?.find((b: any) => b.text === "Download")?.onPress?.();
      });
    renderWithTheme(<AppearanceScreen />, { themeId: "zen" });
    await act(async () => {
      fireEvent.press(screen.getByTestId("theme-card-cafe"));
    });
    expect(alertSpy).toHaveBeenCalledWith(
      expect.stringContaining("Apply Cafe theme?"),
      expect.stringContaining("download"),
      expect.any(Array),
      expect.any(Object),
    );
    await waitFor(() => {
      expect(setPreference).toHaveBeenCalledWith("theme_id", "cafe");
    });
    expect(trackEvent).toHaveBeenCalledWith(
      "theme_changed",
      expect.objectContaining({ to_theme_id: "cafe", required_download: true, was_retry: false }),
    );
    alertSpy.mockRestore();
  });

  it("does NOT apply when the user cancels the modal", async () => {
    const alertSpy = jest
      .spyOn(Alert, "alert")
      .mockImplementation((_t, _m, btns: any) => {
        btns?.find((b: any) => b.text === "Cancel")?.onPress?.();
      });
    renderWithTheme(<AppearanceScreen />, { themeId: "zen" });
    await act(async () => {
      fireEvent.press(screen.getByTestId("theme-card-cafe"));
    });
    expect(setPreference).not.toHaveBeenCalled();
    expect(mockedLoad).not.toHaveBeenCalled();
    alertSpy.mockRestore();
  });

  it("surfaces an inline error + telemetry when font load fails", async () => {
    mockedLoad.mockRejectedValueOnce(new Error("Network request failed"));
    const alertSpy = jest
      .spyOn(Alert, "alert")
      .mockImplementation((_t, _m, btns: any) => {
        btns?.find((b: any) => b.text === "Download")?.onPress?.();
      });
    renderWithTheme(<AppearanceScreen />, { themeId: "zen" });
    await act(async () => {
      fireEvent.press(screen.getByTestId("theme-card-cafe"));
    });
    await waitFor(() => {
      expect(screen.getByText(/Couldn.t load Cafe theme/i)).toBeTruthy();
    });
    expect(trackEvent).toHaveBeenCalledWith(
      "theme_font_download_failed",
      expect.objectContaining({ theme_id: "cafe", error_kind: "network" }),
    );
    expect(setPreference).not.toHaveBeenCalled();
    alertSpy.mockRestore();
  });

  it("[DEV] clear font cache button calls clearFontCache", async () => {
    renderWithTheme(<AppearanceScreen />);
    await act(async () => {
      fireEvent.press(screen.getByText(/Clear font cache/i));
    });
    await waitFor(() => {
      expect(clearFontCache).toHaveBeenCalled();
    });
  });
});
