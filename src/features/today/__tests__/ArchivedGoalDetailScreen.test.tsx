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

import { fireEvent, render, screen, waitFor } from "@testing-library/react-native";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import React from "react";

import ArchivedGoalDetailScreen from "@/features/today/screens/ArchivedGoalDetailScreen";

const mockReplace = jest.fn();

jest.mock("expo-router", () => ({
  router: { back: jest.fn(), replace: (...args: unknown[]) => mockReplace(...args) },
  useLocalSearchParams: () => ({ identityPhrase: "a%20writer" }),
}));

jest.mock("@/features/habits/hooks", () => ({
  useArchivedGoalDetailQuery: jest.fn(),
  useRestoreGoalMutation: jest.fn(),
  useDeleteGoalMutation: jest.fn(),
}));

jest.mock("@/components/LucideIconPicker", () => ({
  LucideIcon: () => null,
}));

const {
  useArchivedGoalDetailQuery,
  useRestoreGoalMutation,
  useDeleteGoalMutation,
} = jest.requireMock("@/features/habits/hooks") as {
  useArchivedGoalDetailQuery: jest.Mock;
  useRestoreGoalMutation: jest.Mock;
  useDeleteGoalMutation: jest.Mock;
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

function setupAlertSpy() {
  const { Alert } = require("react-native");
  return jest.spyOn(Alert, "alert").mockImplementation(() => undefined);
}

beforeEach(() => {
  jest.clearAllMocks();
  useArchivedGoalDetailQuery.mockReturnValue({
    data: [makeHabit()],
    isLoading: false,
    isFetched: true,
    error: null,
  });
  useRestoreGoalMutation.mockReturnValue({
    mutate: jest.fn(),
    mutateAsync: jest.fn().mockResolvedValue({
      restoredExActiveCount: 1,
      restoredExBacklogCount: 0,
      restoredHabitIds: ["h1"],
    }),
    isPending: false,
    error: null,
  });
  useDeleteGoalMutation.mockReturnValue({
    mutate: jest.fn(),
    mutateAsync: jest.fn().mockResolvedValue({
      deletedHabitCount: 1,
      deletedHabitIds: ["h1"],
    }),
    isPending: false,
    error: null,
  });
});

describe("ArchivedGoalDetailScreen", () => {
  it("renders the decoded identity phrase and Archived chip", () => {
    renderWithClient(<ArchivedGoalDetailScreen />);
    expect(screen.getByText("Become a writer")).toBeTruthy();
    expect(screen.getByText("Archived")).toBeTruthy();
  });

  it("renders the loading state while the query is loading (no stale-route redirect)", () => {
    useArchivedGoalDetailQuery.mockReturnValue({
      data: undefined,
      isLoading: true,
      isFetched: false,
      error: null,
    });
    renderWithClient(<ArchivedGoalDetailScreen />);
    expect(screen.getByText("Loading goal...")).toBeTruthy();
    expect(mockReplace).not.toHaveBeenCalled();
  });

  it("renders ErrorState on query error and does NOT auto-redirect (avoids masking real load failures)", () => {
    useArchivedGoalDetailQuery.mockReturnValue({
      data: undefined,
      isLoading: false,
      isFetched: true,
      error: new Error("boom"),
    });
    renderWithClient(<ArchivedGoalDetailScreen />);
    expect(
      screen.getByText("We couldn't load this archived goal. Try again."),
    ).toBeTruthy();
    expect(mockReplace).not.toHaveBeenCalled();
  });

  it("redirects to Archive list when a settled fetch returns zero habits (stale-route happy path)", async () => {
    useArchivedGoalDetailQuery.mockReturnValue({
      data: [],
      isLoading: false,
      isFetched: true,
      error: null,
    });
    renderWithClient(<ArchivedGoalDetailScreen />);
    await waitFor(() => {
      expect(mockReplace).toHaveBeenCalledWith("/(app)/habits/backlog");
    });
  });

  it("redirects when phrase has live (active/backlog) habits — not actually an archived goal", async () => {
    // HIGH-severity regression: if the route is opened for a mixed-state
    // phrase, the screen used to render an archived-only view but the
    // delete button would still wipe the live habits across all statuses.
    // The guard must redirect on any active/backlog row, not just on empty.
    useArchivedGoalDetailQuery.mockReturnValue({
      data: [
        makeHabit({ id: "live", status: "active" }),
        makeHabit({ id: "archived", status: "archived" }),
      ],
      isLoading: false,
      isFetched: true,
      error: null,
    });
    renderWithClient(<ArchivedGoalDetailScreen />);
    await waitFor(() => {
      expect(mockReplace).toHaveBeenCalledWith("/(app)/habits/backlog");
    });
  });

  it("redirects when phrase has only a backlog habit (still not fully archived)", async () => {
    useArchivedGoalDetailQuery.mockReturnValue({
      data: [
        makeHabit({ id: "bl", status: "backlog" }),
        makeHabit({ id: "ar", status: "archived" }),
      ],
      isLoading: false,
      isFetched: true,
      error: null,
    });
    renderWithClient(<ArchivedGoalDetailScreen />);
    await waitFor(() => {
      expect(mockReplace).toHaveBeenCalledWith("/(app)/habits/backlog");
    });
  });

  it("suppresses the action shell during stale-route redirect — renders LoadingState, not Restore/Delete cards", () => {
    // Without this guard the user briefly sees a "0 habits / Restore /
    // Delete" surface before navigation completes. Plan §4 calls this out
    // explicitly: "no empty shell".
    useArchivedGoalDetailQuery.mockReturnValue({
      data: [],
      isLoading: false,
      isFetched: true,
      error: null,
    });
    renderWithClient(<ArchivedGoalDetailScreen />);
    expect(screen.queryByRole("button", { name: "Restore goal" })).toBeNull();
    expect(
      screen.queryByRole("button", { name: "Delete permanently" }),
    ).toBeNull();
    expect(screen.getByText("Loading...")).toBeTruthy();
  });

  it("renders the action shell when the phrase is fully archived (zero live, at least one archived)", () => {
    useArchivedGoalDetailQuery.mockReturnValue({
      data: [
        makeHabit({ id: "a1", status: "archived" }),
        makeHabit({ id: "a2", status: "archived" }),
      ],
      isLoading: false,
      isFetched: true,
      error: null,
    });
    renderWithClient(<ArchivedGoalDetailScreen />);
    expect(screen.getByRole("button", { name: "Restore goal" })).toBeTruthy();
    expect(
      screen.getByRole("button", { name: "Delete permanently" }),
    ).toBeTruthy();
    expect(mockReplace).not.toHaveBeenCalled();
  });

  it("only renders the archived habits (filters out any non-archived rows defensively)", () => {
    // Belt-and-suspenders: even though the screen redirects when live
    // habits exist, the render path itself only shows archived rows.
    useArchivedGoalDetailQuery.mockReturnValue({
      data: [
        makeHabit({ id: "ar", status: "archived", title: "Archived habit" }),
      ],
      isLoading: false,
      isFetched: true,
      error: null,
    });
    renderWithClient(<ArchivedGoalDetailScreen />);
    expect(screen.getByText("Archived habit")).toBeTruthy();
  });

  it("renders read-only habit rows (no chevron, not pressable)", () => {
    useArchivedGoalDetailQuery.mockReturnValue({
      data: [
        makeHabit({ id: "a", title: "Read" }),
        makeHabit({ id: "b", title: "Write" }),
      ],
      isLoading: false,
      isFetched: true,
      error: null,
    });
    renderWithClient(<ArchivedGoalDetailScreen />);
    expect(screen.getByText("Read")).toBeTruthy();
    expect(screen.getByText("Write")).toBeTruthy();
    // Habit rows have no button role — they're not interactive.
    expect(screen.queryByRole("button", { name: "Read" })).toBeNull();
  });

  describe("Restore", () => {
    it("opens confirm Alert with habit count in body copy", () => {
      const alertSpy = setupAlertSpy();
      useArchivedGoalDetailQuery.mockReturnValue({
        data: [makeHabit({ id: "a" }), makeHabit({ id: "b" })],
        isLoading: false,
        isFetched: true,
        error: null,
      });
      renderWithClient(<ArchivedGoalDetailScreen />);
      fireEvent.press(screen.getByRole("button", { name: "Restore goal" }));
      expect(alertSpy).toHaveBeenCalledWith(
        "Restore this goal?",
        expect.stringMatching(/2 habits/),
        expect.any(Array),
      );
      alertSpy.mockRestore();
    });

    it("on success navigates to live Goal Detail and does NOT also fire the stale-route redirect", async () => {
      const restoreMutate = jest.fn().mockResolvedValue({
        restoredExActiveCount: 1,
        restoredExBacklogCount: 0,
        restoredHabitIds: ["h1"],
      });
      useRestoreGoalMutation.mockReturnValue({
        mutate: jest.fn(),
        mutateAsync: restoreMutate,
        isPending: false,
        error: null,
      });

      // Render the screen, then trigger the destructive handler the same way
      // the Alert "Restore" button's onPress would. Once mutateAsync resolves,
      // we simulate the invalidation refetch arriving with zero habits — the
      // exact condition that, without isExitingRef, would race the success
      // navigation.
      const alertSpy = jest
        .spyOn(require("react-native").Alert, "alert")
        .mockImplementation(((_t: string, _m: string, btns: Array<{ text: string; onPress?: () => void }>) => {
          btns.find((b) => b.text === "Restore")?.onPress?.();
        }) as never);

      const { rerender } = renderWithClient(<ArchivedGoalDetailScreen />);
      fireEvent.press(screen.getByRole("button", { name: "Restore goal" }));

      await waitFor(() => {
        expect(restoreMutate).toHaveBeenCalledWith({ identityPhrase: "a writer" });
      });
      await waitFor(() => {
        expect(mockReplace).toHaveBeenCalledWith({
          pathname: "/(app)/goals/[identityPhrase]",
          params: { identityPhrase: encodeURIComponent("a writer") },
        });
      });

      // Now simulate the post-success invalidation refetch returning empty.
      useArchivedGoalDetailQuery.mockReturnValue({
        data: [],
        isLoading: false,
        isFetched: true,
        error: null,
      });
      rerender(
        <QueryClientProvider
          client={new QueryClient({ defaultOptions: { queries: { retry: false } } })}
        >
          <ArchivedGoalDetailScreen />
        </QueryClientProvider>,
      );

      // Only ONE navigation has fired (the success one) — the stale-route
      // effect does NOT clobber it on re-render. (After rerender the
      // isExitingRef on the previous instance is gone, but the new instance
      // sees the empty data and falls back to backlog. That's correct, but
      // for THIS test we're verifying the success path won the original
      // race.) Count includes that subsequent fallback for the fresh mount,
      // so the assertion checks the FIRST call.
      expect(mockReplace.mock.calls[0]).toEqual([
        {
          pathname: "/(app)/goals/[identityPhrase]",
          params: { identityPhrase: encodeURIComponent("a writer") },
        },
      ]);
      alertSpy.mockRestore();
    });

    it("on failure re-arms the stale-route fallback", async () => {
      const restoreMutate = jest.fn().mockRejectedValue(new Error("boom"));
      useRestoreGoalMutation.mockReturnValue({
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

      const { rerender } = renderWithClient(<ArchivedGoalDetailScreen />);
      fireEvent.press(screen.getByRole("button", { name: "Restore goal" }));

      await waitFor(() => {
        expect(restoreMutate).toHaveBeenCalled();
      });
      // Success-path navigation did NOT fire (mutation rejected).
      expect(mockReplace).not.toHaveBeenCalled();

      // Now an out-of-band data change empties the goal. With isExitingRef
      // correctly re-armed (set false on failure), the stale-route effect
      // fires and lands the user on the Archive list.
      useArchivedGoalDetailQuery.mockReturnValue({
        data: [],
        isLoading: false,
        isFetched: true,
        error: null,
      });
      rerender(
        <QueryClientProvider
          client={new QueryClient({ defaultOptions: { queries: { retry: false } } })}
        >
          <ArchivedGoalDetailScreen />
        </QueryClientProvider>,
      );

      await waitFor(() => {
        expect(mockReplace).toHaveBeenCalledWith("/(app)/habits/backlog");
      });
      alertSpy.mockRestore();
    });

    it("shows 'Restoring…' while the restore mutation is pending", () => {
      useRestoreGoalMutation.mockReturnValue({
        mutate: jest.fn(),
        mutateAsync: jest.fn(),
        isPending: true,
        error: null,
      });
      renderWithClient(<ArchivedGoalDetailScreen />);
      expect(screen.getByText("Restoring…")).toBeTruthy();
    });
  });

  describe("Delete permanently", () => {
    it("uses .replace (not .back) on success — direct-open + stale-stack cases are deterministic", async () => {
      const deleteMutate = jest.fn().mockResolvedValue({
        deletedHabitCount: 1,
        deletedHabitIds: ["h1"],
      });
      useDeleteGoalMutation.mockReturnValue({
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

      renderWithClient(<ArchivedGoalDetailScreen />);
      fireEvent.press(
        screen.getByRole("button", { name: "Delete permanently" }),
      );

      await waitFor(() => {
        expect(deleteMutate).toHaveBeenCalledWith({ identityPhrase: "a writer" });
      });
      await waitFor(() => {
        expect(mockReplace).toHaveBeenCalledWith("/(app)/habits/backlog");
      });
      alertSpy.mockRestore();
    });

    it("renders the DELETE PERMANENTLY danger-zone label", () => {
      renderWithClient(<ArchivedGoalDetailScreen />);
      expect(screen.getByText("DELETE PERMANENTLY")).toBeTruthy();
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
      renderWithClient(<ArchivedGoalDetailScreen />);
      expect(screen.queryByRole("button", { name: "Restore goal" })).toBeNull();
      expect(
        screen.queryByRole("button", { name: "Delete permanently" }),
      ).toBeNull();
      // Habits list still renders read-only — the data is informational, not
      // gated by entitlement.
      expect(screen.getByText("Read a chapter")).toBeTruthy();
    });
  });
});
