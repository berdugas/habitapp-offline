import { QueryClient, QueryClientProvider } from "@tanstack/react-query";

import { render, screen, waitFor, act, fireEvent } from "@/tests/setup/render";

import { PaywallHardBlock } from "@/features/paywall/PaywallHardBlock";
import { paywallCopy } from "@/features/paywall/copy";

const mockGate = jest.fn();
const mockArchiveKeepOne = jest.fn().mockResolvedValue({ archivedCount: 0 });
const mockRefresh = jest.fn().mockResolvedValue(undefined);
const mockListHabits = jest.fn().mockResolvedValue([]);

jest.mock("@/features/paywall/usePaywallGate", () => ({
  usePaywallGate: () => mockGate(),
}));
jest.mock("@/features/trial/hooks", () => ({
  useTrialValidation: () => ({ entitlementStatus: "expired", refresh: mockRefresh }),
}));
jest.mock("@/features/auth/hooks", () => ({
  useAuthSession: () => ({ user: { id: "user-1" } }),
}));
jest.mock("@/services/revenuecat", () => ({
  purchaseLifetimeUnlock: jest.fn(),
  restorePurchases: jest.fn(),
}));
jest.mock("@/features/habits/api", () => ({
  archiveHabitsForPaywallKeepOne: (...a: unknown[]) => mockArchiveKeepOne(...a),
  listActiveHabits: () => mockListHabits(),
  listBacklogHabits: () => mockListHabits(),
}));
jest.mock("@/services/logger", () => ({
  logger: { warn: jest.fn(), error: jest.fn(), info: jest.fn() },
}));

function renderHardBlock() {
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return render(
    <QueryClientProvider client={qc}>
      <PaywallHardBlock />
    </QueryClientProvider>,
  );
}

beforeEach(() => {
  mockGate.mockReset();
  mockArchiveKeepOne.mockClear();
});

it("renders nothing when status is inactive", () => {
  mockGate.mockReturnValue({ status: "inactive", needsCleanup: false, soleActiveHabitId: null });
  const { toJSON } = renderHardBlock();
  expect(toJSON()).toBeNull();
});

it("renders the expiry paywall when status is hard_block", () => {
  mockGate.mockReturnValue({ status: "hard_block", needsCleanup: false, soleActiveHabitId: null });
  renderHardBlock();
  expect(screen.getByText(paywallCopy.expiryTitle)).toBeTruthy();
  expect(screen.getByText(paywallCopy.continueFreeCta)).toBeTruthy();
});

it("runs the auto-resolve archive when free_tier needsCleanup", async () => {
  mockGate.mockReturnValue({ status: "free_tier", needsCleanup: true, soleActiveHabitId: "h1" });
  renderHardBlock();
  await waitFor(() => expect(mockArchiveKeepOne).toHaveBeenCalledWith("user-1", "h1"));
});

it("does NOT run auto-resolve when free_tier without cleanup", async () => {
  mockGate.mockReturnValue({ status: "free_tier", needsCleanup: false, soleActiveHabitId: "h1" });
  renderHardBlock();
  await act(async () => {});
  expect(mockArchiveKeepOne).not.toHaveBeenCalled();
});

it("retries the auto-cleanup on a later render after a transient failure (latch not stuck)", async () => {
  // Regression: the latch was set BEFORE the archive, and the archive had no
  // rejection handler. A transient failure became an unhandled rejection AND
  // permanently disabled retries. The fix latches only on success + catches.
  mockArchiveKeepOne
    .mockRejectedValueOnce(new Error("transient db error"))
    .mockResolvedValueOnce({ archivedCount: 1 });
  mockGate.mockReturnValue({ status: "free_tier", needsCleanup: true, soleActiveHabitId: "h1" });

  // Stable QueryClient across rerenders so the effect's queryClient dep doesn't
  // change — the retry must come from the latch being clear, not a dep change.
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  const { rerender } = render(
    <QueryClientProvider client={qc}>
      <PaywallHardBlock />
    </QueryClientProvider>,
  );
  await waitFor(() => expect(mockArchiveKeepOne).toHaveBeenCalledTimes(1));

  // Gate recomputes with a different sole-active id (e.g. count refetched).
  // With the old immediate latch this would early-return; now it retries.
  mockGate.mockReturnValue({ status: "free_tier", needsCleanup: true, soleActiveHabitId: "h2" });
  rerender(
    <QueryClientProvider client={qc}>
      <PaywallHardBlock />
    </QueryClientProvider>,
  );
  await waitFor(() => expect(mockArchiveKeepOne).toHaveBeenCalledTimes(2));
});

it("the keep-one picker excludes graduated (automatic) habits", async () => {
  // listActiveHabits returns status='active' rows, which includes graduated
  // (habit_state='automatic') habits. The picker must filter those out — they
  // consume no free-tier slot and are never archived.
  mockGate.mockReturnValue({ status: "hard_block", needsCleanup: false, soleActiveHabitId: null });
  mockListHabits
    .mockResolvedValueOnce([
      { id: "m1", title: "Manageable", habit_state: "active", status: "active", identity_phrase: null },
      { id: "g1", title: "Graduated", habit_state: "automatic", status: "active", identity_phrase: null },
    ])
    .mockResolvedValueOnce([]);

  renderHardBlock();
  await act(async () => {
    fireEvent.press(screen.getByText(paywallCopy.continueFreeCta));
  });

  await waitFor(() => expect(screen.getByText("Manageable")).toBeTruthy());
  expect(screen.queryByText("Graduated")).toBeNull();
});
