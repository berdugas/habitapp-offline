const mockShowCapBlock = jest.fn();
const mockOnRestore = jest.fn();
const mockOnRecheck = jest.fn();
const mockActions = {
  isPurchasing: false,
  isRestoring: false,
  isVerifying: false,
  isBusy: false,
  status: { kind: "idle" } as
    | { kind: "idle" }
    | { kind: "processing" }
    | { kind: "error"; message: string },
  onUnlock: jest.fn(),
  onRestore: mockOnRestore,
  onRecheck: mockOnRecheck,
  clearStatus: jest.fn(),
};

jest.mock("@/features/paywall/PaywallController", () => ({
  usePaywall: () => ({ showCapBlockPaywall: mockShowCapBlock }),
  usePaywallActions: () => mockActions,
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
    mockActions.status = { kind: "idle" };
    mockActions.isBusy = false;
    mockActions.isRestoring = false;
    mockActions.isVerifying = false;
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

  it("Restore Purchase row triggers the (verify-before-resolve) restore action", async () => {
    defaultSetup({ entitlementStatus: "expired", accessMode: "expired_no_purchase" });
    render(<SettingsScreen />);
    await act(async () => {
      fireEvent.press(screen.getByText("Restore Purchase"));
    });
    expect(mockOnRestore).toHaveBeenCalled();
  });

  it("processing exposes only Check again — hides Upgrade + Restore (no competing op)", () => {
    mockActions.status = { kind: "processing" };
    defaultSetup({ entitlementStatus: "expired", accessMode: "expired_no_purchase" });
    render(<SettingsScreen />);
    expect(screen.getByText("Payment processing — this can take a moment.")).toBeTruthy();
    // A store-confirmed restore awaiting Supabase must not allow another op.
    expect(screen.queryByText("Upgrade for $1.99")).toBeNull();
    expect(screen.queryByText("Restore Purchase")).toBeNull();
    fireEvent.press(screen.getByText("Check again"));
    expect(mockOnRecheck).toHaveBeenCalled();
  });

  it("disables the Upgrade row while a restore is in flight (shared lock)", () => {
    mockActions.isBusy = true; // a restore holds the shared store-op lock
    defaultSetup({ entitlementStatus: "expired", accessMode: "expired_no_purchase" });
    render(<SettingsScreen />);
    fireEvent.press(screen.getByText("Upgrade for $1.99"));
    expect(mockShowCapBlock).not.toHaveBeenCalled();
  });

  it("surfaces an inline error message (e.g. no previous purchase found)", () => {
    mockActions.status = {
      kind: "error",
      message: "No previous purchase found on this account.",
    };
    defaultSetup({ entitlementStatus: "expired", accessMode: "expired_no_purchase" });
    render(<SettingsScreen />);
    expect(
      screen.getByText("No previous purchase found on this account."),
    ).toBeTruthy();
  });
});
