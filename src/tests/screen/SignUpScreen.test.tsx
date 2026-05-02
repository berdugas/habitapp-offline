import { fireEvent, render, screen, waitFor } from "@testing-library/react-native";

import SignUpScreen from "@/features/auth/screens/SignUpScreen";

const mockPush = jest.fn();
const mockReplace = jest.fn();
const mockBack = jest.fn();
const mockSignUpWithPassword = jest.fn();

jest.mock("expo-router", () => ({
  router: {
    push: (...args: unknown[]) => mockPush(...args),
    replace: (...args: unknown[]) => mockReplace(...args),
  },
  useRouter: jest.fn(() => ({ back: mockBack })),
}));

jest.mock("@/features/auth/api", () => ({
  signUpWithPassword: (...args: unknown[]) => mockSignUpWithPassword(...args),
}));

describe("SignUpScreen", () => {
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

  it("submits credentials and routes to root when sign-up returns a session", async () => {
    mockSignUpWithPassword.mockResolvedValue({
      data: {
        session: {
          user: {
            id: "user-1",
          },
        },
      },
      error: null,
    });

    render(<SignUpScreen />);

    fireEvent.changeText(
      screen.getByPlaceholderText("you@example.com"),
      "user@example.com",
    );
    fireEvent.changeText(
      screen.getByPlaceholderText("Choose a password"),
      "password-123",
    );
    fireEvent.press(screen.getByText("Sign up"));

    await waitFor(() => {
      expect(mockSignUpWithPassword).toHaveBeenCalledWith(
        "user@example.com",
        "password-123",
      );
    });

    await waitFor(() => {
      expect(mockReplace).toHaveBeenCalledWith("/");
    });
  });

  it("shows an explicit configuration error when sign-up returns no session", async () => {
    mockSignUpWithPassword.mockResolvedValue({
      data: {
        session: null,
      },
      error: null,
    });

    render(<SignUpScreen />);

    fireEvent.changeText(
      screen.getByPlaceholderText("you@example.com"),
      "user@example.com",
    );
    fireEvent.changeText(
      screen.getByPlaceholderText("Choose a password"),
      "password-123",
    );
    fireEvent.press(screen.getByText("Sign up"));

    await waitFor(() => {
      expect(screen.getByText(/email confirmation must be off/i)).toBeTruthy();
      expect(screen.getByText(/verify the hosted supabase auth setting/i)).toBeTruthy();
    });

    expect(mockReplace).not.toHaveBeenCalled();
  });

  it("shows the API error when sign-up fails", async () => {
    mockSignUpWithPassword.mockResolvedValue({
      data: {
        session: null,
      },
      error: {
        message: "Email is invalid",
      },
    });

    render(<SignUpScreen />);

    fireEvent.changeText(
      screen.getByPlaceholderText("you@example.com"),
      "user@example.com",
    );
    fireEvent.changeText(
      screen.getByPlaceholderText("Choose a password"),
      "password-123",
    );
    fireEvent.press(screen.getByText("Sign up"));

    await waitFor(() => {
      expect(
        screen.getByText("Enter a valid email address and try again."),
      ).toBeTruthy();
    });

    expect(consoleErrorSpy).not.toHaveBeenCalled();
    expect(consoleWarnSpy).toHaveBeenCalled();
  });

  it("blocks blank input before calling Supabase", () => {
    render(<SignUpScreen />);

    fireEvent.press(screen.getByText("Sign up"));

    expect(screen.getByText("Email is required.")).toBeTruthy();
    expect(mockSignUpWithPassword).not.toHaveBeenCalled();
  });
});
