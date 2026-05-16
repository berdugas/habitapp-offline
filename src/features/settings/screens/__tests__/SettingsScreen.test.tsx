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

import { fireEvent, render, screen } from "@testing-library/react-native";
import React from "react";

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
  beforeEach(() => {
    jest.clearAllMocks();
    defaultSetup();
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

  it("shows a 'Manage habits' row that navigates to the backlog screen", () => {
    render(<SettingsScreen />);
    const row = screen.getByText("Manage habits");
    expect(row).toBeTruthy();
    fireEvent.press(row);
    expect(mockPush).toHaveBeenCalledWith("/(app)/habits/backlog");
  });

  it("About card shows the app version", () => {
    render(<SettingsScreen />);
    expect(screen.getByText("1.2.3")).toBeTruthy();
  });
});
