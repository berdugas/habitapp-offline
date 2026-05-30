jest.mock("@/features/trial/hooks", () => ({
  useTrialValidation: jest.fn(() => ({
    isBootstrapping: false,
    isValidating: false,
    accessMode: "full",
    entitlementStatus: "trial",
    trialStartedAt: null,
    trialEndsAt: null,
    lastValidatedAt: null,
    refresh: jest.fn().mockResolvedValue(undefined),
  })),
}));

jest.mock("expo-constants", () => ({
  __esModule: true,
  default: {
    expoConfig: { version: "1.2.3" },
  },
}));

import { fireEvent, render, screen } from "@/tests/setup/render";
import React from "react";
import { Linking } from "react-native";

import SettingsScreen from "@/features/settings/screens/SettingsScreen";
import { useTrialValidation } from "@/features/trial/hooks";

const mockPush = jest.fn();

jest.mock("expo-router", () => ({
  router: {
    replace: jest.fn(),
    push: (...args: unknown[]) => mockPush(...args),
  },
}));

jest.mock("@/features/auth/hooks", () => ({
  useAuthSession: jest.fn(),
}));

jest.mock("@/features/auth/api", () => ({
  signOut: jest.fn().mockResolvedValue(undefined),
}));

const { useAuthSession } = jest.requireMock("@/features/auth/hooks") as {
  useAuthSession: jest.Mock;
};
const mockUseTrialValidation = useTrialValidation as jest.Mock;

function defaultSetup(overrides: {
  email?: string | null;
  entitlementStatus?: string | null;
} = {}) {
  useAuthSession.mockReturnValue({
    user: overrides.email !== undefined ? { email: overrides.email } : { email: "test@example.com" },
    isBootstrapping: false,
    session: null,
  });
  mockUseTrialValidation.mockReturnValue({
    isBootstrapping: false,
    isValidating: false,
    accessMode: "full",
    entitlementStatus: overrides.entitlementStatus !== undefined ? overrides.entitlementStatus : "trial",
    trialStartedAt: null,
    trialEndsAt: null,
    lastValidatedAt: null,
    refresh: jest.fn().mockResolvedValue(undefined),
  });
}

describe("SettingsScreen", () => {
  let openURLSpy: jest.SpyInstance;

  beforeEach(() => {
    jest.clearAllMocks();
    defaultSetup();
    openURLSpy = jest.spyOn(Linking, "openURL").mockResolvedValue(true);
  });

  afterEach(() => {
    openURLSpy.mockRestore();
  });

  it("shows the user email", () => {
    defaultSetup({ email: "user@example.com" });
    render(<SettingsScreen />);
    expect(screen.getByText("user@example.com")).toBeTruthy();
  });

  it("shows 'Trial' status sub-line when entitlementStatus is 'trial'", () => {
    defaultSetup({ entitlementStatus: "trial" });
    render(<SettingsScreen />);
    expect(screen.getByText("Trial")).toBeTruthy();
  });

  it("shows 'Trial ended' sub-line when entitlementStatus is 'expired'", () => {
    defaultSetup({ entitlementStatus: "expired" });
    render(<SettingsScreen />);
    expect(screen.getByText("Trial ended")).toBeTruthy();
  });

  it("omits the status sub-line when entitlementStatus is null", () => {
    defaultSetup({ entitlementStatus: null });
    render(<SettingsScreen />);
    expect(screen.queryByText("Trial")).toBeNull();
    expect(screen.queryByText("Trial ended")).toBeNull();
    expect(screen.queryByText("Active")).toBeNull();
  });

  it("does not render the legacy archived habits card", () => {
    render(<SettingsScreen />);
    expect(screen.queryByText("YOUR ARCHIVED HABITS")).toBeNull();
    expect(
      screen.queryByText("Pause and resume habits without losing their history."),
    ).toBeNull();
  });

  it("shows an 'Archive' row that navigates to the archive screen", () => {
    render(<SettingsScreen />);
    const row = screen.getByText("Archive");
    expect(row).toBeTruthy();
    fireEvent.press(row);
    expect(mockPush).toHaveBeenCalledWith("/(app)/habits/backlog");
  });

  it("shows a 'Privacy & Data' section with an 'Export your data' row", () => {
    render(<SettingsScreen />);
    expect(screen.getByText("PRIVACY & DATA")).toBeTruthy();
    expect(screen.getByText("Export your data")).toBeTruthy();
  });

  it("tapping 'Export your data' navigates to the export screen", () => {
    render(<SettingsScreen />);
    const row = screen.getByText("Export your data");
    fireEvent.press(row);
    expect(mockPush).toHaveBeenCalledWith("/(app)/settings/export");
  });

  it("About card shows the app version", () => {
    render(<SettingsScreen />);
    expect(screen.getByText("1.2.3")).toBeTruthy();
  });

  it("tapping 'Privacy Policy' opens the hosted policy URL in the browser", () => {
    render(<SettingsScreen />);
    const row = screen.getByText("Privacy Policy");
    fireEvent.press(row);
    expect(openURLSpy).toHaveBeenCalledWith(
      "https://berdugas.github.io/habitapp-legal/",
    );
  });

  it("Terms of Service row still shows 'Coming soon' placeholder", () => {
    render(<SettingsScreen />);
    expect(screen.getByText("TERMS OF SERVICE")).toBeTruthy();
    expect(screen.getByText("Coming soon")).toBeTruthy();
  });
});
