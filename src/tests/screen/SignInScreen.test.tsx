import { fireEvent, render, screen, waitFor } from "@testing-library/react-native";

import SignInScreen from "@/features/auth/screens/SignInScreen";

const mockPush = jest.fn();
const mockReplace = jest.fn();
const mockSignInWithPassword = jest.fn();

jest.mock("expo-router", () => ({
  router: {
    push: (...args: unknown[]) => mockPush(...args),
    replace: (...args: unknown[]) => mockReplace(...args),
  },
}));

jest.mock("@/features/auth/api", () => ({
  signInWithPassword: (...args: unknown[]) => mockSignInWithPassword(...args),
}));

describe("SignInScreen", () => {
  let consoleErrorSpy: jest.SpyInstance;
  let consoleWarnSpy: jest.SpyInstance;

  beforeEach(() => {
    jest.clearAllMocks();
    consoleErrorSpy = jest.spyOn(console, "error").mockImplementation(() => undefined);
    consoleWarnSpy = jest.spyOn(console, "warn").mockImplementation(() => undefined);
  });

  afterEach(() => {
    consoleErrorSpy.mockRestore();
    consoleWarnSpy.mockRestore();
  });

  it("submits credentials and routes to root on success", async () => {
    mockSignInWithPassword.mockResolvedValue({
      error: null,
    });

    render(<SignInScreen />);

    fireEvent.changeText(screen.getByPlaceholderText("you@example.com"), "user@example.com");
    fireEvent.changeText(screen.getByPlaceholderText("Your password"), "password-123");
    fireEvent.press(screen.getByText("Sign in"));

    await waitFor(() => {
      expect(mockSignInWithPassword).toHaveBeenCalledWith(
        "user@example.com",
        "password-123",
      );
    });

    await waitFor(() => {
      expect(mockReplace).toHaveBeenCalledWith("/");
    });
  });

  it("blocks blank input before calling Supabase", () => {
    render(<SignInScreen />);

    fireEvent.press(screen.getByText("Sign in"));

    expect(screen.getByText("Email is required.")).toBeTruthy();
    expect(mockSignInWithPassword).not.toHaveBeenCalled();
  });

  it("shows a friendly auth error instead of the raw backend message", async () => {
    mockSignInWithPassword.mockResolvedValue({
      error: {
        message: "Invalid login credentials",
      },
    });

    render(<SignInScreen />);

    fireEvent.changeText(screen.getByPlaceholderText("you@example.com"), "user@example.com");
    fireEvent.changeText(screen.getByPlaceholderText("Your password"), "password-123");
    fireEvent.press(screen.getByText("Sign in"));

    await waitFor(() => {
      expect(
        screen.getByText(
          "We couldn't sign you in. Check your email and password and try again.",
        ),
      ).toBeTruthy();
    });

    expect(consoleErrorSpy).not.toHaveBeenCalled();
    expect(consoleWarnSpy).toHaveBeenCalled();
  });
});
