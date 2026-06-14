import { renderHook } from "@testing-library/react-native";

import { usePaywallGate } from "@/features/paywall/usePaywallGate";

const mockUseTrial = jest.fn();
const mockUseCount = jest.fn();

jest.mock("@/features/trial/hooks", () => ({
  useTrialValidation: () => mockUseTrial(),
}));
jest.mock("@/features/habits/hooks", () => ({
  useActiveHabitCountQuery: () => mockUseCount(),
}));

function setup(accessMode: string, count: { activeCount: number; manageable: number; soleActiveHabitId: string | null } | undefined) {
  mockUseTrial.mockReturnValue({ accessMode });
  mockUseCount.mockReturnValue({ data: count });
}

it("returns inactive for full access", () => {
  setup("full", { activeCount: 5, manageable: 5, soleActiveHabitId: null });
  const { result } = renderHook(() => usePaywallGate());
  expect(result.current.status).toBe("inactive");
});

it("returns inactive for read_only (handled by the banner, not the paywall)", () => {
  setup("read_only", { activeCount: 3, manageable: 3, soleActiveHabitId: null });
  expect(renderHook(() => usePaywallGate()).result.current.status).toBe("inactive");
});

it("hard-blocks expired_no_purchase with 2+ active habits", () => {
  setup("expired_no_purchase", { activeCount: 2, manageable: 2, soleActiveHabitId: null });
  expect(renderHook(() => usePaywallGate()).result.current.status).toBe("hard_block");
});

it("is free_tier for expired_no_purchase with 1 active habit", () => {
  setup("expired_no_purchase", { activeCount: 1, manageable: 1, soleActiveHabitId: "h1" });
  expect(renderHook(() => usePaywallGate()).result.current.status).toBe("free_tier");
});

it("free_tier flags needsCleanup when backlog remains (manageable > 1, active <= 1)", () => {
  setup("expired_no_purchase", { activeCount: 1, manageable: 3, soleActiveHabitId: "h1" });
  const { result } = renderHook(() => usePaywallGate());
  expect(result.current.status).toBe("free_tier");
  expect(result.current.needsCleanup).toBe(true);
  expect(result.current.soleActiveHabitId).toBe("h1");
});

it("stays inactive while the count query is still loading", () => {
  setup("expired_no_purchase", undefined);
  expect(renderHook(() => usePaywallGate()).result.current.status).toBe("inactive");
});
