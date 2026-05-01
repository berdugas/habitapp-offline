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

import { render, screen } from "@testing-library/react-native";
import React from "react";

import SettingsScreen from "@/features/settings/screens/SettingsScreen";
import { useTrialValidation } from "@/features/trial/hooks";

jest.mock("expo-router", () => ({
  router: { replace: jest.fn(), push: jest.fn() },
}));

jest.mock("@/features/auth/hooks", () => ({
  useAuthSession: jest.fn(),
}));

jest.mock("@/features/auth/api", () => ({
  signOut: jest.fn().mockResolvedValue(undefined),
}));

jest.mock("@/features/habits/hooks", () => ({
  useInactiveHabitsQuery: jest.fn(),
}));

const { useAuthSession } = jest.requireMock("@/features/auth/hooks") as {
  useAuthSession: jest.Mock;
};
const { useInactiveHabitsQuery } = jest.requireMock("@/features/habits/hooks") as {
  useInactiveHabitsQuery: jest.Mock;
};
const mockUseTrialValidation = useTrialValidation as jest.Mock;

function defaultSetup(overrides: {
  email?: string | null;
  entitlementStatus?: string | null;
  inactiveHabits?: unknown[];
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
  useInactiveHabitsQuery.mockReturnValue({
    data: overrides.inactiveHabits ?? [],
    isLoading: false,
    error: null,
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

  it("does not render the Foundation status card", () => {
    render(<SettingsScreen />);
    expect(screen.queryByText("Foundation status")).toBeNull();
  });

  it("uses updated heading and helper text for archived habits section", () => {
    render(<SettingsScreen />);
    expect(screen.getByText("Your archived habits")).toBeTruthy();
    expect(
      screen.getByText("Pause and resume habits without losing their history."),
    ).toBeTruthy();
  });

  it("About card shows the app version", () => {
    render(<SettingsScreen />);
    expect(screen.getByText("1.2.3")).toBeTruthy();
  });
});
