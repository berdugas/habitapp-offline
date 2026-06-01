import { Alert } from "react-native";

import { renderWithTheme, screen, fireEvent, act, waitFor } from "@/tests/setup/renderWithTheme";

import MakeItYoursScreen from "@/features/onboarding/screens/MakeItYoursScreen";

jest.mock("react-native-svg", () => ({
  ...jest.requireActual("react-native-svg"),
  Path: () => null,
}));

const mockPush = jest.fn();
const mockReplace = jest.fn();
const mockBack = jest.fn();

jest.mock("expo-router", () => ({
  router: {
    push: (...args: unknown[]) => mockPush(...args),
    replace: (...args: unknown[]) => mockReplace(...args),
    back: (...args: unknown[]) => mockBack(...args),
  },
}));

const mockUpdate = jest.fn();
jest.mock("@/features/onboarding/OnboardingProvider", () => ({
  useOnboarding: () => ({
    draft: { step: "make-it-yours" },
    update: mockUpdate,
  }),
}));

jest.mock("@/theme/fonts/loader", () => ({ loadFontsFor: jest.fn(() => Promise.resolve()) }));
jest.mock("@/services/analytics", () => ({ trackEvent: jest.fn() }));
jest.mock("@/lib/db/repositories/preferences", () => ({ setPreference: jest.fn(() => Promise.resolve()) }));
jest.mock("@/theme/fonts/cache", () => ({
  clearFontCache: jest.fn(() => Promise.resolve()),
  areAllFontsCached: jest.fn(() => Promise.resolve(false)),
}));

import { loadFontsFor } from "@/theme/fonts/loader";
import { setPreference } from "@/lib/db/repositories/preferences";
import { areAllFontsCached } from "@/theme/fonts/cache";

const mockedLoad = loadFontsFor as jest.Mock;
const mockedCached = areAllFontsCached as jest.Mock;

beforeEach(() => {
  jest.clearAllMocks();
  mockedLoad.mockResolvedValue(undefined);
  mockedCached.mockResolvedValue(false);
});

describe("MakeItYoursScreen", () => {
  it("renders the headline and reminder microcopy", () => {
    renderWithTheme(<MakeItYoursScreen />);
    expect(screen.getByText("Make it yours.")).toBeTruthy();
    expect(screen.getByText(/Pick a look for your app/i)).toBeTruthy();
    expect(
      screen.getByText(/You can change the theme anytime in Settings/i),
    ).toBeTruthy();
  });

  it("renders one card per theme with Zen pre-selected as the active theme", () => {
    renderWithTheme(<MakeItYoursScreen />, { themeId: "zen" });
    expect(screen.getByTestId("theme-card-zen")).toBeTruthy();
    expect(screen.getByTestId("theme-card-cafe")).toBeTruthy();
    expect(screen.getByTestId("theme-card-fantasy")).toBeTruthy();
    expect(screen.getByTestId("active-checkmark-zen")).toBeTruthy();
  });

  it("does NOT render a back-affordance (no element with accessibilityLabel='Go back')", () => {
    renderWithTheme(<MakeItYoursScreen />);
    expect(screen.queryByLabelText("Go back")).toBeNull();
  });

  it("shows the download-size caption on uncached remote themes", () => {
    renderWithTheme(<MakeItYoursScreen />, { themeId: "zen" });
    // Cafe and Fantasy are remote; areAllFontsCached defaults to false in beforeEach.
    expect(screen.getAllByText(/ · first time$/i).length).toBeGreaterThan(0);
  });

  it("hides the download-size caption once fonts are cached on disk", async () => {
    mockedCached.mockResolvedValue(true);
    renderWithTheme(<MakeItYoursScreen />, { themeId: "zen" });
    // Preload effect populates cachedThemeIds asynchronously; the caption
    // disappears once isFontReady flips to true.
    await waitFor(() => {
      expect(screen.queryByText(/ · first time$/i)).toBeNull();
    });
  });

  it("tapping Continue updates the draft step to confirmation and pushes the route", () => {
    renderWithTheme(<MakeItYoursScreen />);
    fireEvent.press(screen.getByText("Continue"));
    expect(mockUpdate).toHaveBeenCalledWith({ step: "confirmation" });
    expect(mockPush).toHaveBeenCalledWith("/(onboarding)/confirmation");
  });

  it("tapping a non-active card triggers the shared picker flow (Alert → Download → setPreference)", async () => {
    const alertSpy = jest
      .spyOn(Alert, "alert")
      .mockImplementation((_t, _m, btns: any) => {
        btns?.find((b: any) => b.text === "Download")?.onPress?.();
      });
    renderWithTheme(<MakeItYoursScreen />, { themeId: "zen" });
    await act(async () => {
      fireEvent.press(screen.getByTestId("theme-card-cafe"));
    });
    await waitFor(() => {
      expect(setPreference).toHaveBeenCalledWith("theme_id", "cafe");
    });
    alertSpy.mockRestore();
  });
});
