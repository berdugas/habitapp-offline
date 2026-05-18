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

import { fireEvent, render, screen } from "@testing-library/react-native";

import SettingsScreen from "@/features/settings/screens/SettingsScreen";

const mockPush = jest.fn();
const mockReplace = jest.fn();
const mockSignOut = jest.fn();
const mockUseAuthSession = jest.fn();

jest.mock("expo-router", () => ({
  router: {
    push: (...args: unknown[]) => mockPush(...args),
    replace: (...args: unknown[]) => mockReplace(...args),
  },
}));

jest.mock("@/features/auth/hooks", () => ({
  useAuthSession: () => mockUseAuthSession(),
}));

jest.mock("@/features/auth/api", () => ({
  signOut: () => mockSignOut(),
}));

describe("SettingsScreen", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockSignOut.mockResolvedValue(undefined);
    mockUseAuthSession.mockReturnValue({
      user: { email: "user@example.com" },
    });
  });

  it("does not render legacy archived habits surface", () => {
    render(<SettingsScreen />);

    expect(screen.queryByText("YOUR ARCHIVED HABITS")).toBeNull();
    expect(screen.queryByText("No archived habits")).toBeNull();
    expect(screen.queryByText("Loading archived habits...")).toBeNull();
  });

  it("renders Archive row and navigates to backlog on press", () => {
    render(<SettingsScreen />);

    const row = screen.getByText("Archive");
    expect(row).toBeTruthy();
    fireEvent.press(row);

    expect(mockPush).toHaveBeenCalledWith("/(app)/habits/backlog");
  });

  it("renders Export your data row and navigates to the export screen on press", () => {
    render(<SettingsScreen />);

    const row = screen.getByText("Export your data");
    expect(row).toBeTruthy();
    fireEvent.press(row);

    expect(mockPush).toHaveBeenCalledWith("/(app)/settings/export");
  });
});
