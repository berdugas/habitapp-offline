import React from "react";
import { render, screen, fireEvent, waitFor, act } from "@/tests/setup/render";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";

import { PaywallHardBlock } from "@/features/paywall/PaywallHardBlock";

const mockTrackEvent = jest.fn();
const mockArchiveKeepOne = jest.fn().mockResolvedValue(undefined);
const mockRestoreKept = jest.fn().mockResolvedValue({ restoredCount: 0 });
const mockListActive = jest.fn();
const mockListBacklog = jest.fn();
let mockGate = { status: "hard_block", needsCleanup: false, soleActiveHabitId: null as string | null };
let mockUserId: string | null = "user-1";

jest.mock("@/services/analytics", () => ({
  trackEvent: (...a: unknown[]) => mockTrackEvent(...a),
}));
jest.mock("@/features/paywall/usePaywallGate", () => ({
  usePaywallGate: () => mockGate,
}));
jest.mock("@/features/paywall/PaywallController", () => ({
  usePaywallActions: () => ({
    isPurchasing: false,
    isRestoring: false,
    isVerifying: false,
    isBusy: false,
    status: { kind: "idle" },
    onUnlock: jest.fn(),
    onRestore: jest.fn(),
    onRecheck: jest.fn(),
  }),
}));
jest.mock("@/features/trial/hooks", () => ({
  useTrialValidation: () => ({ entitlementStatus: "expired" }),
}));
jest.mock("@/features/auth/hooks", () => ({
  useAuthSession: () => ({ user: mockUserId ? { id: mockUserId } : null }),
}));
jest.mock("@/features/habits/api", () => ({
  archiveHabitsForPaywallKeepOne: (...a: unknown[]) => mockArchiveKeepOne(...a),
  restorePaywallKeptHabits: (...a: unknown[]) => mockRestoreKept(...a),
  listActiveHabits: (...a: unknown[]) => mockListActive(...a),
  listBacklogHabits: (...a: unknown[]) => mockListBacklog(...a),
}));
// Stub the presentational pieces so we drive handlers directly.
jest.mock("@/features/paywall/PaywallScreen", () => ({
  PaywallScreen: ({ onContinueFree }: { onContinueFree: () => void }) => {
    const { Pressable, Text } = require("react-native");
    return (
      <Pressable onPress={onContinueFree}>
        <Text>continue-free</Text>
      </Pressable>
    );
  },
}));
jest.mock("@/features/paywall/KeepOnePicker", () => ({
  KeepOnePicker: ({ onConfirm }: { onConfirm: (id: string | null) => void }) => {
    const { Pressable, Text } = require("react-native");
    return (
      <>
        <Pressable onPress={() => onConfirm("habit-1")}>
          <Text>confirm-one</Text>
        </Pressable>
        <Pressable onPress={() => onConfirm(null)}>
          <Text>confirm-none</Text>
        </Pressable>
      </>
    );
  },
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
  mockTrackEvent.mockReset();
  mockArchiveKeepOne.mockReset().mockResolvedValue(undefined);
  mockListActive.mockReset().mockResolvedValue([
    { id: "habit-1", title: "Read", identity_phrase: null, status: "active", habit_state: "active" },
  ]);
  mockListBacklog.mockReset().mockResolvedValue([]);
  mockGate = { status: "hard_block", needsCleanup: false, soleActiveHabitId: null };
  mockUserId = "user-1";
});

it("fires paywall_shown with trigger 'expiry' when the hard-block mounts", () => {
  renderHardBlock();
  expect(mockTrackEvent).toHaveBeenCalledWith("paywall_shown", { trigger: "expiry" });
});

it("re-fires paywall_shown for a second account on a direct switch that stays hard_block", () => {
  // Same QueryClient + component instance across rerender so the latch ref
  // persists — a fresh remount would reset it and hide the bug.
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  const ui = (
    <QueryClientProvider client={qc}>
      <PaywallHardBlock />
    </QueryClientProvider>
  );
  const view = render(ui);
  expect(mockTrackEvent).toHaveBeenCalledWith("paywall_shown", { trigger: "expiry" });

  mockTrackEvent.mockClear();
  mockUserId = "user-2"; // sign out user-1, sign in user-2 — gate stays hard_block
  view.rerender(
    <QueryClientProvider client={qc}>
      <PaywallHardBlock />
    </QueryClientProvider>,
  );
  expect(mockTrackEvent).toHaveBeenCalledWith("paywall_shown", { trigger: "expiry" });
});

it("fires paywall_continue_free when Continue free is tapped", async () => {
  renderHardBlock();
  // continue_free fires synchronously on press; wrap in async act so the
  // openPicker() it kicks off settles inside act (no unresolved-act warning).
  await act(async () => {
    fireEvent.press(screen.getByText("continue-free"));
  });
  expect(mockTrackEvent).toHaveBeenCalledWith("paywall_continue_free");
});

it("fires paywall_keep_one_picked with the habit id after a successful archive", async () => {
  renderHardBlock();
  fireEvent.press(screen.getByText("continue-free"));
  // openPicker loads the (mocked) habits, then the stub KeepOnePicker renders.
  await waitFor(() => expect(screen.getByText("confirm-one")).toBeTruthy());
  await act(async () => {
    fireEvent.press(screen.getByText("confirm-one"));
  });
  await waitFor(() =>
    expect(mockTrackEvent).toHaveBeenCalledWith("paywall_keep_one_picked", {
      habit_id: "habit-1",
    }),
  );
});

it("fires paywall_keep_none_picked when 'keep none' is confirmed", async () => {
  renderHardBlock();
  fireEvent.press(screen.getByText("continue-free"));
  await waitFor(() => expect(screen.getByText("confirm-none")).toBeTruthy());
  await act(async () => {
    fireEvent.press(screen.getByText("confirm-none"));
  });
  await waitFor(() =>
    expect(mockTrackEvent).toHaveBeenCalledWith("paywall_keep_none_picked"),
  );
});
