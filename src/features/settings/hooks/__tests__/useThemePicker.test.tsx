import { Alert } from "react-native";
import { act, renderHook, waitFor } from "@testing-library/react-native";

import { ThemeProvider } from "@/theme/ThemeProvider";
import { useThemePicker } from "@/features/settings/hooks/useThemePicker";
import { THEMES } from "@/theme/registry";

import type { ThemeId } from "@/theme/contract";

jest.mock("@/theme/fonts/loader", () => ({ loadFontsFor: jest.fn(() => Promise.resolve()) }));
jest.mock("@/services/analytics", () => ({ trackEvent: jest.fn() }));
jest.mock("@/lib/db/repositories/preferences", () => ({ setPreference: jest.fn(() => Promise.resolve()) }));
jest.mock("@/theme/fonts/cache", () => ({
  clearFontCache: jest.fn(() => Promise.resolve()),
  areAllFontsCached: jest.fn(() => Promise.resolve(false)),
}));

import { loadFontsFor } from "@/theme/fonts/loader";
import { trackEvent } from "@/services/analytics";
import { setPreference } from "@/lib/db/repositories/preferences";
import { areAllFontsCached } from "@/theme/fonts/cache";

const mockedLoad = loadFontsFor as jest.Mock;
const mockedCached = areAllFontsCached as jest.Mock;

function wrap(themeId: ThemeId) {
  return function Wrapper({ children }: { children: React.ReactNode }) {
    return (
      <ThemeProvider initialThemeId={themeId} intendedThemeId={themeId}>
        {children}
      </ThemeProvider>
    );
  };
}

beforeEach(() => {
  jest.clearAllMocks();
  mockedLoad.mockResolvedValue(undefined);
  mockedCached.mockResolvedValue(false);
});

describe("useThemePicker", () => {
  it("no-ops onCardPress when target is already active", async () => {
    const { result } = renderHook(() => useThemePicker(), { wrapper: wrap("zen") });
    await act(async () => {
      await result.current.onCardPress(THEMES.zen);
    });
    expect(setPreference).not.toHaveBeenCalled();
    expect(trackEvent).toHaveBeenCalledWith(
      "theme_picker_card_pressed",
      expect.objectContaining({ theme_id: "zen", was_active: true }),
    );
  });

  it("applies a bundled theme without showing the Alert", async () => {
    const alertSpy = jest.spyOn(Alert, "alert");
    const { result } = renderHook(() => useThemePicker(), { wrapper: wrap("cafe") });
    await act(async () => {
      await result.current.onCardPress(THEMES.zen);
    });
    await waitFor(() => {
      expect(setPreference).toHaveBeenCalledWith("theme_id", "zen");
    });
    expect(alertSpy).not.toHaveBeenCalled();
    alertSpy.mockRestore();
  });

  it("Alert → Download path applies a remote theme and emits theme_changed", async () => {
    const alertSpy = jest
      .spyOn(Alert, "alert")
      .mockImplementation((_t, _m, btns: any) => {
        btns?.find((b: any) => b.text === "Download")?.onPress?.();
      });
    const { result } = renderHook(() => useThemePicker(), { wrapper: wrap("zen") });
    await act(async () => {
      await result.current.onCardPress(THEMES.cafe);
    });
    await waitFor(() => {
      expect(setPreference).toHaveBeenCalledWith("theme_id", "cafe");
    });
    expect(trackEvent).toHaveBeenCalledWith(
      "theme_changed",
      expect.objectContaining({ from_theme_id: "zen", to_theme_id: "cafe", required_download: true, was_retry: false }),
    );
    alertSpy.mockRestore();
  });

  it("skips the Alert when remote-theme fonts are already cached", async () => {
    mockedCached.mockResolvedValue(true);
    const alertSpy = jest.spyOn(Alert, "alert");
    const { result } = renderHook(() => useThemePicker(), { wrapper: wrap("zen") });
    await act(async () => {
      await result.current.onCardPress(THEMES.cafe);
    });
    await waitFor(() => {
      expect(setPreference).toHaveBeenCalledWith("theme_id", "cafe");
    });
    expect(alertSpy).not.toHaveBeenCalled();
    alertSpy.mockRestore();
  });

  it("Cancel on the Alert leaves nothing applied", async () => {
    const alertSpy = jest
      .spyOn(Alert, "alert")
      .mockImplementation((_t, _m, btns: any) => {
        btns?.find((b: any) => b.text === "Cancel")?.onPress?.();
      });
    const { result } = renderHook(() => useThemePicker(), { wrapper: wrap("zen") });
    await act(async () => {
      await result.current.onCardPress(THEMES.cafe);
    });
    expect(setPreference).not.toHaveBeenCalled();
    expect(mockedLoad).not.toHaveBeenCalled();
    alertSpy.mockRestore();
  });

  it("classifies network failures and exposes loadError", async () => {
    mockedLoad.mockRejectedValueOnce(new Error("Network request failed"));
    const alertSpy = jest
      .spyOn(Alert, "alert")
      .mockImplementation((_t, _m, btns: any) => {
        btns?.find((b: any) => b.text === "Download")?.onPress?.();
      });
    const { result } = renderHook(() => useThemePicker(), { wrapper: wrap("zen") });
    await act(async () => {
      await result.current.onCardPress(THEMES.cafe);
    });
    await waitFor(() => {
      expect(result.current.loadError).toEqual(
        expect.objectContaining({ themeId: "cafe", themeName: "Cafe", kind: "network" }),
      );
    });
    expect(trackEvent).toHaveBeenCalledWith(
      "theme_font_download_failed",
      expect.objectContaining({ theme_id: "cafe", error_kind: "network" }),
    );
    expect(setPreference).not.toHaveBeenCalled();
    alertSpy.mockRestore();
  });

  it("retry() re-applies the theme stored in loadError with was_retry=true", async () => {
    mockedLoad.mockRejectedValueOnce(new Error("Network request failed"));
    const alertSpy = jest
      .spyOn(Alert, "alert")
      .mockImplementation((_t, _m, btns: any) => {
        btns?.find((b: any) => b.text === "Download")?.onPress?.();
      });
    const { result } = renderHook(() => useThemePicker(), { wrapper: wrap("zen") });
    await act(async () => {
      await result.current.onCardPress(THEMES.cafe);
    });
    await waitFor(() => {
      expect(result.current.loadError).not.toBeNull();
    });
    mockedLoad.mockResolvedValueOnce(undefined);
    await act(async () => {
      result.current.retry();
    });
    await waitFor(() => {
      expect(setPreference).toHaveBeenCalledWith("theme_id", "cafe");
    });
    expect(trackEvent).toHaveBeenCalledWith(
      "theme_changed",
      expect.objectContaining({ to_theme_id: "cafe", was_retry: true }),
    );
    alertSpy.mockRestore();
  });
});
