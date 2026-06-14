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

it("retries the auto-cleanup via a bounded timer on a STABLE gate after a transient failure", async () => {
  // Regression: a transient archive failure must retry WITHOUT relying on an
  // unrelated dep change. Clearing the latch alone wouldn't re-run the effect
  // on a stable gate — the fix schedules a real timer retry.
  jest.useFakeTimers();
  mockArchiveKeepOne
    .mockRejectedValueOnce(new Error("transient db error"))
    .mockResolvedValueOnce({ archivedCount: 1 });
  mockGate.mockReturnValue({ status: "free_tier", needsCleanup: true, soleActiveHabitId: "h1" });

  renderHardBlock();

  // First attempt fails — flush its microtasks so the catch schedules a timer.
  await act(async () => {
    await Promise.resolve();
    await Promise.resolve();
  });
  expect(mockArchiveKeepOne).toHaveBeenCalledTimes(1);

  // Advancing the timer retries with the gate completely unchanged.
  await act(async () => {
    await jest.advanceTimersByTimeAsync(3000);
  });
  expect(mockArchiveKeepOne).toHaveBeenCalledTimes(2);

  jest.useRealTimers();
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
