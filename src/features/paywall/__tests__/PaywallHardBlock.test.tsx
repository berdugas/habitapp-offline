import { QueryClient, QueryClientProvider } from "@tanstack/react-query";

import { render, screen, waitFor, act, fireEvent } from "@/tests/setup/render";

import { PaywallHardBlock } from "@/features/paywall/PaywallHardBlock";
import { paywallCopy } from "@/features/paywall/copy";

const mockGate = jest.fn();
const mockArchiveKeepOne = jest.fn().mockResolvedValue({ archivedCount: 0 });
const mockRestoreKept = jest.fn().mockResolvedValue({ restoredCount: 0 });
const mockRefresh = jest.fn().mockResolvedValue(undefined);
const mockListHabits = jest.fn().mockResolvedValue([]);
let mockUserId: string | null = "user-1";
let mockEntitlementStatus: string = "expired";

jest.mock("@/features/paywall/usePaywallGate", () => ({
  usePaywallGate: () => mockGate(),
}));
jest.mock("@/features/trial/hooks", () => ({
  useTrialValidation: () => ({ entitlementStatus: mockEntitlementStatus, refresh: mockRefresh }),
}));
jest.mock("@/features/auth/hooks", () => ({
  useAuthSession: () => ({ user: mockUserId ? { id: mockUserId } : null }),
}));
jest.mock("@/services/revenuecat", () => ({
  purchaseLifetimeUnlock: jest.fn(),
  restorePurchases: jest.fn(),
}));
jest.mock("@/features/habits/api", () => ({
  archiveHabitsForPaywallKeepOne: (...a: unknown[]) => mockArchiveKeepOne(...a),
  restorePaywallKeptHabits: (...a: unknown[]) => mockRestoreKept(...a),
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
  mockArchiveKeepOne.mockResolvedValue({ archivedCount: 0 });
  mockRestoreKept.mockClear();
  mockRestoreKept.mockResolvedValue({ restoredCount: 0 });
  mockUserId = "user-1";
  mockEntitlementStatus = "expired";
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

function tree(qc: QueryClient) {
  return (
    <QueryClientProvider client={qc}>
      <PaywallHardBlock />
    </QueryClientProvider>
  );
}

it("runs the auto-cleanup AGAIN in a later episode (latch resets when leaving the cleanup state)", async () => {
  // Episode 1: free_tier needs cleanup → archives once.
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  mockGate.mockReturnValue({ status: "free_tier", needsCleanup: true, soleActiveHabitId: "h1" });
  const { rerender } = render(tree(qc));
  await waitFor(() => expect(mockArchiveKeepOne).toHaveBeenCalledTimes(1));

  // Leave the cleanup state (e.g. upgrade restored backlog, then refund →
  // hard_block) — the latch must reset.
  mockGate.mockReturnValue({ status: "hard_block", needsCleanup: false, soleActiveHabitId: null });
  rerender(tree(qc));

  // Episode 2: free_tier needs cleanup again → must archive a SECOND time.
  mockGate.mockReturnValue({ status: "free_tier", needsCleanup: true, soleActiveHabitId: "h1" });
  rerender(tree(qc));
  await waitFor(() => expect(mockArchiveKeepOne).toHaveBeenCalledTimes(2));
});

it("resets picker state when leaving hard_block so a later episode can't reopen a stale picker", async () => {
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  mockGate.mockReturnValue({ status: "hard_block", needsCleanup: false, soleActiveHabitId: null });
  mockListHabits
    .mockResolvedValueOnce([
      { id: "old", title: "Old Habit", habit_state: "active", status: "active", identity_phrase: null },
    ])
    .mockResolvedValueOnce([]);

  const { rerender } = render(tree(qc));
  await act(async () => {
    fireEvent.press(screen.getByText(paywallCopy.continueFreeCta));
  });
  await waitFor(() => expect(screen.getByText("Old Habit")).toBeTruthy());

  // Gate clears (upgrade), then a later refund re-opens the hard-block.
  mockGate.mockReturnValue({ status: "free_tier", needsCleanup: false, soleActiveHabitId: "x" });
  rerender(tree(qc));
  mockGate.mockReturnValue({ status: "hard_block", needsCleanup: false, soleActiveHabitId: null });
  rerender(tree(qc));

  // The stale picker must NOT reappear — the expiry paywall shows instead.
  expect(screen.queryByText("Old Habit")).toBeNull();
  expect(screen.getByText(paywallCopy.expiryTitle)).toBeTruthy();
});

it("shows a retryable error and keeps the picker open when the keep-one archive fails", async () => {
  mockGate.mockReturnValue({ status: "hard_block", needsCleanup: false, soleActiveHabitId: null });
  mockListHabits
    .mockResolvedValueOnce([
      { id: "h1", title: "Read", habit_state: "active", status: "active", identity_phrase: null },
    ])
    .mockResolvedValueOnce([]);
  mockArchiveKeepOne.mockRejectedValueOnce(new Error("db fail"));

  renderHardBlock();
  await act(async () => {
    fireEvent.press(screen.getByText(paywallCopy.continueFreeCta));
  });
  await waitFor(() => expect(screen.getByText("Read")).toBeTruthy());

  fireEvent.press(screen.getByText("Read"));
  fireEvent.press(screen.getByText("Continue"));
  await act(async () => {
    fireEvent.press(screen.getByText(paywallCopy.pickerConfirmYes));
  });

  // Error surfaced, picker still open (confirm step), nothing silently swallowed.
  await waitFor(() => expect(screen.getByText(paywallCopy.keepOneError)).toBeTruthy());
  expect(screen.getByText(paywallCopy.pickerConfirmYes)).toBeTruthy();
});

it("opens the picker in a load-error state (Retry/Back, no Keep none) when the list fails to load", async () => {
  mockGate.mockReturnValue({ status: "hard_block", needsCleanup: false, soleActiveHabitId: null });
  mockListHabits.mockRejectedValue(new Error("load fail"));

  renderHardBlock();
  await act(async () => {
    fireEvent.press(screen.getByText(paywallCopy.continueFreeCta));
  });

  await waitFor(() => expect(screen.getByText(paywallCopy.keepOneError)).toBeTruthy());
  expect(screen.getByText("Retry")).toBeTruthy();
  // No destructive "Keep none" when the choices never loaded.
  expect(screen.queryByText(paywallCopy.pickerKeepNone)).toBeNull();
});

it("discards a late picker load that resolves after the gate left hard_block", async () => {
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  mockGate.mockReturnValue({ status: "hard_block", needsCleanup: false, soleActiveHabitId: null });

  // Defer the actives load so it's still in flight when the gate changes.
  let resolveActives!: (v: unknown) => void;
  mockListHabits
    .mockImplementationOnce(() => new Promise((r) => (resolveActives = r)))
    .mockImplementationOnce(() => Promise.resolve([]));

  const { rerender } = render(tree(qc));
  act(() => {
    fireEvent.press(screen.getByText(paywallCopy.continueFreeCta));
  });

  // Gate leaves hard_block (upgrade) → reset runs, episode bumps.
  mockGate.mockReturnValue({ status: "free_tier", needsCleanup: false, soleActiveHabitId: "x" });
  rerender(tree(qc));

  // The in-flight load finally resolves — but for the OLD episode, so discarded.
  await act(async () => {
    resolveActives([
      { id: "stale", title: "Stale Habit", habit_state: "active", status: "active", identity_phrase: null },
    ]);
    await Promise.resolve();
  });

  // A later hard-block must NOT show the stale picker.
  mockGate.mockReturnValue({ status: "hard_block", needsCleanup: false, soleActiveHabitId: null });
  rerender(tree(qc));
  expect(screen.queryByText("Stale Habit")).toBeNull();
  expect(screen.getByText(paywallCopy.expiryTitle)).toBeTruthy();
});

it("an older picker load that fails later does NOT overwrite a newer successful one", async () => {
  mockGate.mockReturnValue({ status: "hard_block", needsCleanup: false, soleActiveHabitId: null });
  // req1 actives → deferred reject; req1 backlog → []; req2 actives → deferred
  // resolve; req2 backlog → [].
  let rejectOlder!: (e: Error) => void;
  let resolveNewer!: (v: unknown) => void;
  mockListHabits
    .mockImplementationOnce(() => new Promise((_res, rej) => (rejectOlder = rej)))
    .mockImplementationOnce(() => Promise.resolve([]))
    .mockImplementationOnce(() => new Promise((res) => (resolveNewer = res)))
    .mockImplementationOnce(() => Promise.resolve([]));

  renderHardBlock();
  // Two loads in the same episode (e.g. an initial open + a Retry).
  act(() => {
    fireEvent.press(screen.getByText(paywallCopy.continueFreeCta));
  });
  act(() => {
    fireEvent.press(screen.getByText(paywallCopy.continueFreeCta));
  });

  // Newer load (req2) succeeds.
  await act(async () => {
    resolveNewer([
      { id: "n1", title: "New Habit", habit_state: "active", status: "active", identity_phrase: null },
    ]);
    await Promise.resolve();
  });
  expect(screen.getByText("New Habit")).toBeTruthy();

  // Older load (req1) fails afterward — must be discarded, not overwrite.
  await act(async () => {
    rejectOlder(new Error("late fail"));
    await Promise.resolve();
  });
  expect(screen.getByText("New Habit")).toBeTruthy();
  expect(screen.queryByText(paywallCopy.keepOneError)).toBeNull();
});

it("resets the picker on a direct account switch that stays hard_block", async () => {
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  mockGate.mockReturnValue({ status: "hard_block", needsCleanup: false, soleActiveHabitId: null });
  mockListHabits
    .mockResolvedValueOnce([
      { id: "a1", title: "User-1 Habit", habit_state: "active", status: "active", identity_phrase: null },
    ])
    .mockResolvedValueOnce([]);

  const { rerender } = render(tree(qc));
  await act(async () => {
    fireEvent.press(screen.getByText(paywallCopy.continueFreeCta));
  });
  await waitFor(() => expect(screen.getByText("User-1 Habit")).toBeTruthy());

  // Account switches while the gate stays hard_block — user-1's picker must
  // NOT carry over (confirming its stale ids would archive user-2's habits).
  mockUserId = "user-2";
  rerender(tree(qc));

  expect(screen.queryByText("User-1 Habit")).toBeNull();
  expect(screen.getByText(paywallCopy.expiryTitle)).toBeTruthy();
});

it("reconciles paywall-kept habits if paid races a manual keep-one archive", async () => {
  // Race: a purchase on another device lands WHILE the user is confirming a
  // keep-one. The session-latched reconcile hook may have already run its
  // one-shot scan BEFORE these rows were tagged paywall_keep_one — and won't
  // re-run while status stays paid. confirmKeepOne must itself re-run the
  // idempotent restore once the archive completes under paid status, so the
  // kept-one's just-archived siblings aren't stranded.
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  mockGate.mockReturnValue({ status: "hard_block", needsCleanup: false, soleActiveHabitId: null });
  mockListHabits
    .mockResolvedValueOnce([
      { id: "keep", title: "Read", habit_state: "active", status: "active", identity_phrase: null },
    ])
    .mockResolvedValueOnce([]);

  // Defer the archive so paid can land while it's still in flight.
  let resolveArchive!: (v: unknown) => void;
  mockArchiveKeepOne.mockImplementationOnce(
    () => new Promise((r) => (resolveArchive = r)),
  );

  const { rerender } = render(tree(qc));
  await act(async () => {
    fireEvent.press(screen.getByText(paywallCopy.continueFreeCta));
  });
  await waitFor(() => expect(screen.getByText("Read")).toBeTruthy());

  fireEvent.press(screen.getByText("Read"));
  fireEvent.press(screen.getByText("Continue"));
  act(() => {
    fireEvent.press(screen.getByText(paywallCopy.pickerConfirmYes));
  });

  // Archive is in flight — a purchase on another device makes us paid. The ref
  // must pick this up so the post-archive reconcile sees it.
  mockEntitlementStatus = "paid";
  rerender(tree(qc));

  // Archive completes AFTER paid was observed.
  await act(async () => {
    resolveArchive({ archivedCount: 1 });
    await Promise.resolve();
    await Promise.resolve();
  });

  // The idempotent restore must run so the rows we just tagged aren't stranded
  // behind the already-latched session reconcile.
  expect(mockRestoreKept).toHaveBeenCalledWith("user-1");
});

it("does NOT reconcile after a keep-one archive while still unpaid (no redundant restore)", async () => {
  // The normal hard-block keep-one flow is unpaid — restore must NOT run here.
  // (If the user later upgrades, the session reconcile hook handles it.) This
  // guards the isPaidStatus check from being dropped.
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  mockGate.mockReturnValue({ status: "hard_block", needsCleanup: false, soleActiveHabitId: null });
  mockListHabits
    .mockResolvedValueOnce([
      { id: "keep", title: "Read", habit_state: "active", status: "active", identity_phrase: null },
    ])
    .mockResolvedValueOnce([]);

  render(tree(qc)); // entitlementStatus stays "expired"
  await act(async () => {
    fireEvent.press(screen.getByText(paywallCopy.continueFreeCta));
  });
  await waitFor(() => expect(screen.getByText("Read")).toBeTruthy());

  fireEvent.press(screen.getByText("Read"));
  fireEvent.press(screen.getByText("Continue"));
  await act(async () => {
    fireEvent.press(screen.getByText(paywallCopy.pickerConfirmYes));
  });

  expect(mockArchiveKeepOne).toHaveBeenCalledWith("user-1", "keep");
  expect(mockRestoreKept).not.toHaveBeenCalled();
});
