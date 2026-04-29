import { Text } from "react-native";
import { render, screen, waitFor } from "@testing-library/react-native";

import { useAuthSession } from "@/features/auth/hooks";
import { AuthBootstrap } from "@/providers/AuthBootstrap";

jest.mock("@/features/auth/api", () => ({
  getSession: jest.fn(),
}));

jest.mock("@/lib/supabase/auth", () => ({
  onSupabaseAuthStateChange: jest.fn(),
}));

const { getSession } = jest.requireMock(
  "@/features/auth/api",
) as {
  getSession: jest.Mock;
};

const { onSupabaseAuthStateChange } = jest.requireMock(
  "@/lib/supabase/auth",
) as {
  onSupabaseAuthStateChange: jest.Mock;
};

function Probe() {
  const authSession = useAuthSession();
  return (
    <Text>{authSession.isBootstrapping ? "booting" : authSession.user?.id ?? "guest"}</Text>
  );
}

describe("AuthBootstrap", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    onSupabaseAuthStateChange.mockReturnValue({
      data: {
        subscription: {
          unsubscribe: jest.fn(),
        },
      },
    });
  });

  it("hydrates the session and surfaces the user id to children", async () => {
    getSession.mockResolvedValue({
      data: {
        session: {
          user: {
            id: "user-1",
          },
        },
      },
      error: null,
    });

    render(
      <AuthBootstrap>
        <Probe />
      </AuthBootstrap>,
    );

    await waitFor(() => {
      expect(screen.getByText("user-1")).toBeTruthy();
    });
  });
});
