import { renderHook, act, waitFor } from "@testing-library/react-native";

import { useTrialEndingBanner } from "@/features/paywall/useTrialEndingBanner";

const mockGetStored = jest.fn();
const mockSetStored = jest.fn();
const mockNow = jest.fn();
let mockTrial: { entitlementStatus: string | null; trialEndsAt: string | null };

jest.mock("@/lib/storage", () => ({
  getStoredItem: (...a: unknown[]) => mockGetStored(...a),
  setStoredItem: (...a: unknown[]) => mockSetStored(...a),
}));
jest.mock("@/features/trial/hooks", () => ({
  useTrialValidation: () => mockTrial,
}));
jest.mock("@/utils/clock", () => ({ now: () => mockNow() }));

const NOW = new Date("2026-06-14T12:00:00.000Z");
const ENDS_AT = new Date("2026-06-15T18:00:00.000Z").toISOString(); // ~30h → within the 48h window

beforeEach(() => {
  jest.clearAllMocks();
  mockNow.mockReturnValue(NOW);
  mockGetStored.mockResolvedValue(null);
  mockSetStored.mockResolvedValue(undefined);
  mockTrial = { entitlementStatus: "trial", trialEndsAt: ENDS_AT };
});

it("still loads (banner can show) when the dismissal read fails — no permanent unload", async () => {
  // Without a catch, a rejected read leaves `loaded` false forever, so `visible`
  // can never become true and the banner is permanently unloaded.
  mockGetStored.mockRejectedValue(new Error("storage down"));

  const { result } = renderHook(() => useTrialEndingBanner());

  await waitFor(() => expect(result.current.visible).toBe(true));
});

it("dismiss does not reject when the storage write fails (no unhandled rejection)", async () => {
  mockSetStored.mockRejectedValue(new Error("storage down"));

  const { result } = renderHook(() => useTrialEndingBanner());
  await waitFor(() => expect(result.current.visible).toBe(true));

  await act(async () => {
    await expect(result.current.dismiss()).resolves.toBeUndefined();
  });

  // The in-memory latch still hides it for this session despite the failed write.
  expect(result.current.visible).toBe(false);
});
