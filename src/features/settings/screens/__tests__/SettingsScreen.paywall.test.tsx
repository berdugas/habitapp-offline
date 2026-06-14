const mockShowCapBlock = jest.fn();
const mockRestore = jest.fn().mockResolvedValue(undefined);

jest.mock("@/features/paywall/PaywallController", () => ({
  usePaywall: () => ({ showCapBlockPaywall: mockShowCapBlock }),
}));

jest.mock("@/services/revenuecat", () => ({
  restorePurchases: (...a: unknown[]) => mockRestore(...a),
}));

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

jest.mock("expo-router", () => ({
  router: {
    replace: jest.fn(),
    push: jest.fn(),
  },
}));

jest.mock("@/features/auth/hooks", () => ({
  useAuthSession: jest.fn(() => ({
    user: { email: "test@example.com" },
    isBootstrapping: false,
    session: null,
  })),
}));

jest.mock("@/features/auth/api", () => ({
  signOut: jest.fn().mockResolvedValue(undefined),
}));

import { act, fireEvent, render, screen } from "@/tests/setup/render";
import React from "react";

import SettingsScreen from "@/features/settings/screens/SettingsScreen";
import { useTrialValidation } from "@/features/trial/hooks";
import { useAuthSession } from "@/features/auth/hooks";

const mockUseTrialValidation = useTrialValidation as jest.Mock;
const mockUseAuthSession = useAuthSession as jest.Mock;

function defaultSetup(overrides: {
  entitlementStatus?: string | null;
  accessMode?: "full" | "read_only" | "expired_no_purchase";
} = {}) {
  mockUseAuthSession.mockReturnValue({
    user: { email: "test@example.com" },
    isBootstrapping: false,
    session: null,
  });
  mockUseTrialValidation.mockReturnValue({
    isBootstrapping: false,
    isValidating: false,
    accessMode: overrides.accessMode ?? "full",
    entitlementStatus: overrides.entitlementStatus !== undefined
      ? overrides.entitlementStatus
      : "trial",
    trialStartedAt: null,
    trialEndsAt: null,
    lastValidatedAt: null,
    refresh: jest.fn().mockResolvedValue(undefined),
  });
}

describe("SettingsScreen — paywall rows", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    defaultSetup();
  });

  it("shows the Upgrade row and opens the paywall when not paid", () => {
    defaultSetup({ entitlementStatus: "expired", accessMode: "expired_no_purchase" });
    render(<SettingsScreen />);
    const upgradeRow = screen.getByText("Upgrade for $1.99");
    expect(upgradeRow).toBeTruthy();
    fireEvent.press(upgradeRow);
    expect(mockShowCapBlock).toHaveBeenCalledWith("settings_upgrade");
  });

  it("shows Paid ✓ and hides the Upgrade row when paid", () => {
    defaultSetup({ entitlementStatus: "paid", accessMode: "full" });
    render(<SettingsScreen />);
    expect(screen.getByText("Paid ✓")).toBeTruthy();
    expect(screen.queryByText("Upgrade for $1.99")).toBeNull();
  });

  it("Restore Purchase row calls restorePurchases", async () => {
    defaultSetup({ entitlementStatus: "expired", accessMode: "expired_no_purchase" });
    render(<SettingsScreen />);
    await act(async () => {
      fireEvent.press(screen.getByText("Restore Purchase"));
    });
    expect(mockRestore).toHaveBeenCalled();
  });
});
