import { render, screen, fireEvent, waitFor, act } from "@/tests/setup/render";
import { Text, Pressable, Modal } from "react-native";

import {
  PaywallController,
  usePaywall,
  __resetStoreOpLockForTests,
} from "@/features/paywall/PaywallController";
import { paywallCopy } from "@/features/paywall/copy";

const mockPurchase = jest.fn();
const mockRestore = jest.fn();
const mockRefresh = jest.fn().mockResolvedValue(undefined);
let mockEntitlementStatus = "expired";
let mockUserId: string | null = "user-1";

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
    <Pressable onPress={() => showCapBlockPaywall("cap_create")}>
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
  mockPurchase.mockReset();
  mockRestore.mockReset();
  mockRefresh.mockClear();
  mockEntitlementStatus = "expired";
  mockUserId = "user-1";
  __resetStoreOpLockForTests(); // module-level lock — reset between tests
});

it("is hidden until showCapBlockPaywall is called", () => {
  renderWithController();
  expect(screen.queryByText(paywallCopy.capBlockTitle)).toBeNull();
  fireEvent.press(screen.getByText("open"));
  expect(screen.getByText(paywallCopy.capBlockTitle)).toBeTruthy();
});

it("closes the cap-block modal when the authenticated user changes (sign-out / switch)", () => {
  const { rerender } = renderWithController();
  fireEvent.press(screen.getByText("open"));
  expect(screen.getByText(paywallCopy.capBlockTitle)).toBeTruthy();

  // Auth changes (sign-out / account switch) — a modal opened for the previous
  // user must not linger (and possibly trap) over the new UI.
  mockUserId = "user-2";
  rerender(
    <PaywallController>
      <Trigger />
    </PaywallController>,
  );

  expect(screen.queryByText(paywallCopy.capBlockTitle)).toBeNull();
});

it("dismisses a visible (idle) cap modal once paid is observed via another path", () => {
  const { rerender } = renderWithController();
  fireEvent.press(screen.getByText("open"));
  expect(screen.getByText(paywallCopy.capBlockTitle)).toBeTruthy();

  // Paid observed elsewhere (another device / a Settings restore) while the
  // modal is open and idle — it must not stay over a fully-unlocked app.
  mockEntitlementStatus = "paid";
  rerender(
    <PaywallController>
      <Trigger />
    </PaywallController>,
  );
  expect(screen.queryByText(paywallCopy.capBlockTitle)).toBeNull();
});

it("Maybe later dismisses the cap-block modal", () => {
  renderWithController();
  fireEvent.press(screen.getByText("open"));
  fireEvent.press(screen.getByText(paywallCopy.maybeLaterCta));
  expect(screen.queryByText(paywallCopy.capBlockTitle)).toBeNull();
});

it("Unlock purchases, polls the server, and dismisses once paid is observed", async () => {
  mockPurchase.mockResolvedValue({ cancelled: false });
  // Server confirms paid on the first poll → no sleeps, fast path.
  mockRefresh.mockResolvedValue({ entitlement_status: "paid" });
  renderWithController();
  fireEvent.press(screen.getByText("open"));
  await act(async () => {
    fireEvent.press(screen.getByText(paywallCopy.unlockCta));
  });
  await waitFor(() => expect(mockPurchase).toHaveBeenCalledTimes(1));
  expect(mockRefresh).toHaveBeenCalled();
  // paid observed → onResolved (dismiss) → modal closes.
  await waitFor(() =>
    expect(screen.queryByText(paywallCopy.capBlockTitle)).toBeNull(),
  );
});

it("Android Back (onRequestClose) does NOT dismiss while a store op is in flight", async () => {
  // Never-resolving purchase holds isPurchasing=true (busy). Hardware Back must
  // be inert, mirroring the hidden visible exit controls.
  mockPurchase.mockReturnValue(new Promise(() => {}));
  renderWithController();
  fireEvent.press(screen.getByText("open"));
  await act(async () => {
    fireEvent.press(screen.getByText(paywallCopy.unlockCta));
  });

  fireEvent(screen.UNSAFE_getByType(Modal), "requestClose");
  expect(screen.getByText(paywallCopy.capBlockTitle)).toBeTruthy(); // still open
});

it("a cancelled purchase keeps the modal open and does not refresh", async () => {
  mockPurchase.mockResolvedValue({ cancelled: true });
  renderWithController();
  fireEvent.press(screen.getByText("open"));
  await act(async () => {
    fireEvent.press(screen.getByText(paywallCopy.unlockCta));
  });
  await waitFor(() => expect(mockPurchase).toHaveBeenCalled());
  expect(mockRefresh).not.toHaveBeenCalled();
  expect(screen.getByText(paywallCopy.capBlockTitle)).toBeTruthy();
});
