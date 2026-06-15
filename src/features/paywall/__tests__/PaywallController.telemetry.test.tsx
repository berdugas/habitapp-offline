import { render, screen, fireEvent } from "@/tests/setup/render";
import { Text, Pressable } from "react-native";

import {
  PaywallController,
  usePaywall,
  __resetStoreOpLockForTests,
} from "@/features/paywall/PaywallController";

const mockTrackEvent = jest.fn();
const mockPurchase = jest.fn();
const mockRestore = jest.fn();
const mockRefresh = jest.fn().mockResolvedValue(undefined);
let mockEntitlementStatus = "expired";
let mockUserId: string | null = "user-1";

jest.mock("@/services/analytics", () => ({
  trackEvent: (...a: unknown[]) => mockTrackEvent(...a),
}));
jest.mock("@/services/revenuecat", () => ({
  purchaseLifetimeUnlock: (...a: unknown[]) => mockPurchase(...a),
  restorePurchases: (...a: unknown[]) => mockRestore(...a),
}));
jest.mock("@/features/trial/hooks", () => ({
  useTrialValidation: () => ({
    accessMode: "expired_no_purchase",
    entitlementStatus: mockEntitlementStatus,
    refresh: mockRefresh,
  }),
}));
jest.mock("@/features/auth/hooks", () => ({
  useAuthSession: () => ({ user: mockUserId ? { id: mockUserId } : null }),
}));

function Trigger() {
  const { showCapBlockPaywall } = usePaywall();
  return (
    <Pressable onPress={() => showCapBlockPaywall("cap_edit")}>
      <Text>open</Text>
    </Pressable>
  );
}
function renderWithController() {
  return render(
    <PaywallController>
      <Trigger />
    </PaywallController>,
  );
}

beforeEach(() => {
  mockTrackEvent.mockReset();
  mockPurchase.mockReset();
  mockRestore.mockReset();
  mockRefresh.mockClear().mockResolvedValue(undefined);
  mockEntitlementStatus = "expired";
  mockUserId = "user-1";
  __resetStoreOpLockForTests();
});

it("fires paywall_shown with the trigger when the cap-block modal opens", () => {
  renderWithController();
  fireEvent.press(screen.getByText("open"));
  expect(mockTrackEvent).toHaveBeenCalledWith("paywall_shown", { trigger: "cap_edit" });
});
