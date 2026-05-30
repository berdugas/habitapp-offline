jest.mock("@/features/trial/hooks", () => ({
  useTrialValidation: jest.fn(() => ({
    accessMode: "full",
    entitlementStatus: "trial",
    isBootstrapping: false,
    isValidating: false,
    lastValidatedAt: null,
    refresh: jest.fn().mockResolvedValue(undefined),
    trialEndsAt: null,
    trialStartedAt: null,
  })),
}));

import { fireEvent, render, screen, waitFor } from "@/tests/setup/render";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import React from "react";

import ArchivedHabitDetailScreen from "@/features/habits/screens/ArchivedHabitDetailScreen";

const mockReplace = jest.fn();
const mockDismissAll = jest.fn();

jest.mock("expo-router", () => ({
  router: {
    back: jest.fn(),
    replace: (...args: unknown[]) => mockReplace(...args),
    dismissAll: () => mockDismissAll(),
  },
  useLocalSearchParams: () => ({ habitId: "h1" }),
}));

jest.mock("@/features/habits/hooks", () => ({
  useOwnedHabitQuery: jest.fn(),
  useRestoreHabitMutation: jest.fn(),
  useDeleteHabitMutation: jest.fn(),
}));

jest.mock("@/components/LucideIconPicker", () => ({
  LucideIcon: () => null,
}));

const {
  useOwnedHabitQuery,
  useRestoreHabitMutation,
  useDeleteHabitMutation,
} = jest.requireMock("@/features/habits/hooks") as {
  useOwnedHabitQuery: jest.Mock;
  useRestoreHabitMutation: jest.Mock;
  useDeleteHabitMutation: jest.Mock;
};

function renderWithClient(ui: React.ReactElement) {
  const client = new QueryClient({
    defaultOptions: { queries: { retry: false } },
  });
  return render(<QueryClientProvider client={client}>{ui}</QueryClientProvider>);
}

function makeHabit(overrides: Partial<Record<string, unknown>> = {}) {
  return {
    id: "h1",
    user_id: "user-1",
    title: "Read a chapter",
    identity_phrase: "a writer",
    cue: "after coffee",
    tiny_action: "read 1 page",
    minimum_viable_action: null,
    preferred_time_window: null,
    icon: null,
    habit_state: "active",
    status: "archived",
    active_days: "[1,2,3,4,5,6,7]",
    start_date: "2026-04-01",
    created_at: "2026-04-01T12:00:00.000Z",
    updated_at: "2026-05-01T12:00:00.000Z",
    archived_at: "2026-05-01T12:00:00.000Z",
    automated_at: null,
    backlog_at: null,
    ...overrides,
  };
}

beforeEach(() => {
  jest.clearAllMocks();
  useOwnedHabitQuery.mockReturnValue({
    data: makeHabit(),
    isLoading: false,
    isFetched: true,
    error: null,
  });
  useRestoreHabitMutation.mockReturnValue({
    mutate: jest.fn(),
    mutateAsync: jest.fn().mockResolvedValue({
      restored: true,
      wasExBacklog: false,
    }),
    isPending: false,
    error: null,
  });
  useDeleteHabitMutation.mockReturnValue({
    mutate: jest.fn(),
    mutateAsync: jest.fn().mockResolvedValue(undefined),
    isPending: false,
    error: null,
  });
});

describe("ArchivedHabitDetailScreen", () => {
  it("renders the habit title and Archived chip", () => {
    renderWithClient(<ArchivedHabitDetailScreen />);
    expect(screen.getByText("Read a chapter")).toBeTruthy();
    expect(screen.getByText("Archived")).toBeTruthy();
  });

  it("renders the identity phrase line when present", () => {
    renderWithClient(<ArchivedHabitDetailScreen />);
    expect(screen.getByText("Become a writer")).toBeTruthy();
  });

  it("renders the habit's tiny_action and cue in the meta card", () => {
    renderWithClient(<ArchivedHabitDetailScreen />);
    expect(screen.getByText("read 1 page")).toBeTruthy();
    expect(screen.getByText("Cue: after coffee")).toBeTruthy();
  });

  it("renders LoadingState while the query is loading (no stale-route redirect)", () => {
    useOwnedHabitQuery.mockReturnValue({
      data: undefined,
      isLoading: true,
      isFetched: false,
      error: null,
    });
    renderWithClient(<ArchivedHabitDetailScreen />);
    expect(screen.getByText("Loading habit...")).toBeTruthy();
    expect(mockReplace).not.toHaveBeenCalled();
  });

  it("renders ErrorState on query error and does NOT auto-redirect", () => {
    useOwnedHabitQuery.mockReturnValue({
      data: undefined,
      isLoading: false,
      isFetched: true,
      error: new Error("boom"),
    });
    renderWithClient(<ArchivedHabitDetailScreen />);
    expect(
      screen.getByText("We couldn't load this archived habit. Try again."),
    ).toBeTruthy();
    expect(mockReplace).not.toHaveBeenCalled();
  });

  it("redirects to live habit detail when status is not archived (deep-link / stale-route)", async () => {
    useOwnedHabitQuery.mockReturnValue({
      data: makeHabit({ status: "active" }),
      isLoading: false,
      isFetched: true,
      error: null,
    });
    renderWithClient(<ArchivedHabitDetailScreen />);
    await waitFor(() => {
      expect(mockReplace).toHaveBeenCalledWith({
        pathname: "/(app)/habits/[habitId]",
        params: { habitId: "h1" },
      });
    });
  });

  it("redirects to Archive list when the habit doesn't exist post-fetch (deleted out-of-band)", async () => {
    useOwnedHabitQuery.mockReturnValue({
      data: undefined,
      isLoading: false,
      isFetched: true,
      error: null,
    });
    renderWithClient(<ArchivedHabitDetailScreen />);
    await waitFor(() => {
      expect(mockReplace).toHaveBeenCalledWith("/(app)/habits/backlog");
    });
  });

  it("suppresses the action shell during stale-route redirect — renders LoadingState, not Restore/Delete cards", () => {
    useOwnedHabitQuery.mockReturnValue({
      data: makeHabit({ status: "active" }),
      isLoading: false,
      isFetched: true,
      error: null,
    });
    renderWithClient(<ArchivedHabitDetailScreen />);
    expect(screen.queryByRole("button", { name: "Restore habit" })).toBeNull();
    expect(
      screen.queryByRole("button", { name: "Delete permanently" }),
    ).toBeNull();
    expect(screen.getByText("Loading...")).toBeTruthy();
  });

  it("renders the action shell when the habit is archived", () => {
    renderWithClient(<ArchivedHabitDetailScreen />);
    expect(screen.getByRole("button", { name: "Restore habit" })).toBeTruthy();
    expect(
      screen.getByRole("button", { name: "Delete permanently" }),
    ).toBeTruthy();
    expect(mockReplace).not.toHaveBeenCalled();
  });

  describe("Restore", () => {
    it("opens confirm Alert with the restore copy", () => {
      const alertSpy = jest
        .spyOn(require("react-native").Alert, "alert")
        .mockImplementation(() => undefined);
      renderWithClient(<ArchivedHabitDetailScreen />);
      fireEvent.press(screen.getByRole("button", { name: "Restore habit" }));
      expect(alertSpy).toHaveBeenCalledWith(
        "Restore this habit?",
        "It will move back to your active list.",
        expect.any(Array),
      );
      alertSpy.mockRestore();
    });

    it("on success pops the archive-side stack AND anchors on Today — not on whichever tab the user was on before Archive", async () => {
      // Regression A: a plain router.replace to live habit detail leaves
      //   Archive in the back-stack — chevron-back rewinds to a now-empty
      //   Archive view of the section the habit just left.
      // Regression B: router.dismissAll alone pops the non-tab stack but
      //   leaves the *active tab* unchanged. If the user reached Archive
      //   from the Settings tab, dismissAll would land them on Settings —
      //   not Today. The explicit Today replace fixes that. Both calls are
      //   required.
      const restoreMutate = jest
        .fn()
        .mockResolvedValue({ restored: true, wasExBacklog: false });
      useRestoreHabitMutation.mockReturnValue({
        mutate: jest.fn(),
        mutateAsync: restoreMutate,
        isPending: false,
        error: null,
      });
      const alertSpy = jest
        .spyOn(require("react-native").Alert, "alert")
        .mockImplementation(((_t: string, _m: string, btns: Array<{ text: string; onPress?: () => void }>) => {
          btns.find((b) => b.text === "Restore")?.onPress?.();
        }) as never);

      renderWithClient(<ArchivedHabitDetailScreen />);
      fireEvent.press(screen.getByRole("button", { name: "Restore habit" }));

      await waitFor(() => {
        expect(restoreMutate).toHaveBeenCalledWith({ habitId: "h1" });
      });
      // Both calls must fire — and dismissAll must come first so the
      // Today replace lands on a freshly-cleared stack.
      await waitFor(() => {
        expect(mockDismissAll).toHaveBeenCalled();
        expect(mockReplace).toHaveBeenCalledWith("/(app)/(tabs)/today");
      });
      expect(
        mockDismissAll.mock.invocationCallOrder[0]!,
      ).toBeLessThan(mockReplace.mock.invocationCallOrder[0]!);
      alertSpy.mockRestore();
    });

    it("on failure re-arms the stale-route fallback so retries work", async () => {
      const restoreMutate = jest.fn().mockRejectedValue(new Error("boom"));
      useRestoreHabitMutation.mockReturnValue({
        mutate: jest.fn(),
        mutateAsync: restoreMutate,
        isPending: false,
        error: null,
      });
      const alertSpy = jest
        .spyOn(require("react-native").Alert, "alert")
        .mockImplementation(((_t: string, _m: string, btns: Array<{ text: string; onPress?: () => void }>) => {
          btns.find((b) => b.text === "Restore")?.onPress?.();
        }) as never);

      const { rerender } = renderWithClient(<ArchivedHabitDetailScreen />);
      fireEvent.press(screen.getByRole("button", { name: "Restore habit" }));

      await waitFor(() => {
        expect(restoreMutate).toHaveBeenCalled();
      });
      // Mutation rejected — neither navigation path fires.
      expect(mockDismissAll).not.toHaveBeenCalled();
      expect(mockReplace).not.toHaveBeenCalledWith("/(app)/(tabs)/today");

      // Out-of-band: the habit is now active (e.g., another tab restored it).
      // With isExitingRef correctly reset on failure, the stale-route effect
      // fires and lands the user on live detail.
      useOwnedHabitQuery.mockReturnValue({
        data: makeHabit({ status: "active" }),
        isLoading: false,
        isFetched: true,
        error: null,
      });
      rerender(
        <QueryClientProvider
          client={new QueryClient({ defaultOptions: { queries: { retry: false } } })}
        >
          <ArchivedHabitDetailScreen />
        </QueryClientProvider>,
      );

      await waitFor(() => {
        expect(mockReplace).toHaveBeenCalledWith({
          pathname: "/(app)/habits/[habitId]",
          params: { habitId: "h1" },
        });
      });
      alertSpy.mockRestore();
    });

    it("shows 'Restoring…' while the restore mutation is pending", () => {
      useRestoreHabitMutation.mockReturnValue({
        mutate: jest.fn(),
        mutateAsync: jest.fn(),
        isPending: true,
        error: null,
      });
      renderWithClient(<ArchivedHabitDetailScreen />);
      expect(screen.getByText("Restoring…")).toBeTruthy();
    });

    it("surfaces the restore-error message when the mutation errored", () => {
      useRestoreHabitMutation.mockReturnValue({
        mutate: jest.fn(),
        mutateAsync: jest.fn(),
        isPending: false,
        error: new Error("boom"),
      });
      renderWithClient(<ArchivedHabitDetailScreen />);
      expect(
        screen.getByText("We couldn't restore this habit right now. Try again."),
      ).toBeTruthy();
    });
  });

  describe("Delete permanently", () => {
    it("uses .replace to /habits/backlog on success — direct-open + stale-stack cases are deterministic", async () => {
      const deleteMutate = jest.fn().mockResolvedValue(undefined);
      useDeleteHabitMutation.mockReturnValue({
        mutate: jest.fn(),
        mutateAsync: deleteMutate,
        isPending: false,
        error: null,
      });
      const alertSpy = jest
        .spyOn(require("react-native").Alert, "alert")
        .mockImplementation(((_t: string, _m: string, btns: Array<{ text: string; onPress?: () => void }>) => {
          btns.find((b) => b.text === "Delete")?.onPress?.();
        }) as never);

      renderWithClient(<ArchivedHabitDetailScreen />);
      fireEvent.press(
        screen.getByRole("button", { name: "Delete permanently" }),
      );

      await waitFor(() => {
        expect(deleteMutate).toHaveBeenCalledWith({ habitId: "h1" });
      });
      await waitFor(() => {
        expect(mockReplace).toHaveBeenCalledWith("/(app)/habits/backlog");
      });
      alertSpy.mockRestore();
    });

    it("renders the DELETE PERMANENTLY danger-zone label", () => {
      renderWithClient(<ArchivedHabitDetailScreen />);
      expect(screen.getByText("DELETE PERMANENTLY")).toBeTruthy();
    });

    it("renders 'Deleting…' on the danger-zone button while pending", () => {
      useDeleteHabitMutation.mockReturnValue({
        mutate: jest.fn(),
        mutateAsync: jest.fn(),
        isPending: true,
        error: null,
      });
      renderWithClient(<ArchivedHabitDetailScreen />);
      expect(screen.getByText("Deleting…")).toBeTruthy();
    });

    it("surfaces the delete-error message when the mutation errored", () => {
      useDeleteHabitMutation.mockReturnValue({
        mutate: jest.fn(),
        mutateAsync: jest.fn(),
        isPending: false,
        error: new Error("boom"),
      });
      renderWithClient(<ArchivedHabitDetailScreen />);
      expect(
        screen.getByText("We couldn't delete this habit right now. Try again."),
      ).toBeTruthy();
    });
  });

  describe("Read-only mode", () => {
    it("hides both Restore and Delete cards", () => {
      const { useTrialValidation } = jest.requireMock(
        "@/features/trial/hooks",
      ) as { useTrialValidation: jest.Mock };
      useTrialValidation.mockReturnValueOnce({
        accessMode: "read_only",
        isValidating: false,
        refresh: jest.fn(),
      });
      renderWithClient(<ArchivedHabitDetailScreen />);
      expect(screen.queryByRole("button", { name: "Restore habit" })).toBeNull();
      expect(
        screen.queryByRole("button", { name: "Delete permanently" }),
      ).toBeNull();
      // Read-only mode still shows the metadata — informational, not gated.
      expect(screen.getByText("Read a chapter")).toBeTruthy();
    });
  });
});
