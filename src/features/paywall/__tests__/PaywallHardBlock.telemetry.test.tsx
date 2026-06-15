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
  useAuthSession: () => ({ user: { id: "user-1" } }),
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
});

it("fires paywall_shown with trigger 'expiry' when the hard-block mounts", () => {
  renderHardBlock();
  expect(mockTrackEvent).toHaveBeenCalledWith("paywall_shown", { trigger: "expiry" });
});
