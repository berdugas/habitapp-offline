import { render, screen, fireEvent, waitFor, act } from "@/tests/setup/render";
import { Text, Pressable } from "react-native";

import {
  PaywallController,
  usePaywall,
  __resetStoreOpLockForTests,
} from "@/features/paywall/PaywallController";
import { paywallCopy } from "@/features/paywall/copy";

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

it("fires purchase_started then purchase_completed on a store-confirmed purchase", async () => {
  mockPurchase.mockResolvedValue({ cancelled: false });
  mockRefresh.mockResolvedValue({ entitlement_status: "paid" });
  renderWithController();
  fireEvent.press(screen.getByText("open"));
  await act(async () => {
    fireEvent.press(screen.getByText(paywallCopy.unlockCta));
  });
  await waitFor(() => expect(mockPurchase).toHaveBeenCalled());
  expect(mockTrackEvent).toHaveBeenCalledWith("paywall_purchase_started");
  expect(mockTrackEvent).toHaveBeenCalledWith("paywall_purchase_completed");
});

it("fires purchase_cancelled (not completed) when the user backs out", async () => {
  mockPurchase.mockResolvedValue({ cancelled: true });
  renderWithController();
  fireEvent.press(screen.getByText("open"));
  await act(async () => {
    fireEvent.press(screen.getByText(paywallCopy.unlockCta));
  });
  await waitFor(() => expect(mockPurchase).toHaveBeenCalled());
  expect(mockTrackEvent).toHaveBeenCalledWith("paywall_purchase_cancelled");
  expect(mockTrackEvent).not.toHaveBeenCalledWith("paywall_purchase_completed");
});

it("fires purchase_failed with error_kind from PurchaseError.reason", async () => {
  mockPurchase.mockRejectedValue({ reason: "identity_failed", name: "PurchaseError" });
  renderWithController();
  fireEvent.press(screen.getByText("open"));
  await act(async () => {
    fireEvent.press(screen.getByText(paywallCopy.unlockCta));
  });
  await waitFor(() => expect(mockPurchase).toHaveBeenCalled());
  expect(mockTrackEvent).toHaveBeenCalledWith("paywall_purchase_failed", {
    error_kind: "identity_failed",
  });
});

it("fires restore_purchase_attempted then succeeded when an entitlement is found", async () => {
  mockRestore.mockResolvedValue({ status: "ok", hasLifetimeEntitlement: true });
  mockRefresh.mockResolvedValue({ entitlement_status: "paid" });
  renderWithController();
  fireEvent.press(screen.getByText("open"));
  await act(async () => {
    fireEvent.press(screen.getByText(paywallCopy.restoreCta));
  });
  await waitFor(() => expect(mockRestore).toHaveBeenCalled());
  expect(mockTrackEvent).toHaveBeenCalledWith("restore_purchase_attempted");
  expect(mockTrackEvent).toHaveBeenCalledWith("restore_purchase_succeeded");
});

it("fires restore_purchase_no_entitlement when the account never purchased", async () => {
  mockRestore.mockResolvedValue({ status: "ok", hasLifetimeEntitlement: false });
  renderWithController();
  fireEvent.press(screen.getByText("open"));
  await act(async () => {
    fireEvent.press(screen.getByText(paywallCopy.restoreCta));
  });
  await waitFor(() => expect(mockRestore).toHaveBeenCalled());
  expect(mockTrackEvent).toHaveBeenCalledWith("restore_purchase_no_entitlement");
});

it("fires restore_purchase_failed with error_kind when the store restore fails", async () => {
  mockRestore.mockResolvedValue({ status: "failed" });
  renderWithController();
  fireEvent.press(screen.getByText("open"));
  await act(async () => {
    fireEvent.press(screen.getByText(paywallCopy.restoreCta));
  });
  await waitFor(() => expect(mockRestore).toHaveBeenCalled());
  expect(mockTrackEvent).toHaveBeenCalledWith("restore_purchase_failed", {
    error_kind: "store_failed",
  });
});
