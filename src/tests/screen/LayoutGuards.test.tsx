import type * as React from "react";
import { render, screen } from "@testing-library/react-native";

import AuthLayout from "../../../app/(auth)/_layout";
import ProtectedLayout from "../../../app/(app)/_layout";

jest.mock("expo-router", () => ({
  Redirect: ({ href }: { href: string }) => {
    const { Text } = require("react-native");
    return <Text>{`redirect:${href}`}</Text>;
  },
  Stack: Object.assign(
    ({ children }: { children?: React.ReactNode }) => {
      const { Text } = require("react-native");
      return (
        <>
          <Text>stack</Text>
          {children}
        </>
      );
    },
    {
      Screen: () => null,
    },
  ),
  Slot: () => {
    const { Text } = require("react-native");
    return <Text>stack</Text>;
  },
}));

jest.mock("@/features/auth/hooks", () => ({
  useAuthSession: jest.fn(),
}));

const { useAuthSession } = jest.requireMock("@/features/auth/hooks") as {
  useAuthSession: jest.Mock;
};

describe("route guard layouts", () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it("redirects authenticated users away from auth routes", () => {
    useAuthSession.mockReturnValue({
      isBootstrapping: false,
      session: { user: { id: "user-1" } },
    });

    render(<AuthLayout />);

    expect(screen.getByText("redirect:/")).toBeTruthy();
  });

  it("renders the auth stack when signed out", () => {
    useAuthSession.mockReturnValue({
      isBootstrapping: false,
      session: null,
    });

    render(<AuthLayout />);

    expect(screen.getByText("stack")).toBeTruthy();
  });

  it("redirects signed-out users away from protected routes", () => {
    useAuthSession.mockReturnValue({
      isBootstrapping: false,
      session: null,
    });

    render(<ProtectedLayout />);

    expect(screen.getByText("redirect:/(auth)/sign-in")).toBeTruthy();
  });

  it("renders the protected stack when signed in", () => {
    useAuthSession.mockReturnValue({
      isBootstrapping: false,
      session: { user: { id: "user-1" } },
    });

    render(<ProtectedLayout />);

    expect(screen.getByText("stack")).toBeTruthy();
  });
});
