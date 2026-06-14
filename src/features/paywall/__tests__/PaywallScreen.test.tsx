import { render, screen, fireEvent } from "@/tests/setup/render";

import { PaywallScreen } from "@/features/paywall/PaywallScreen";
import { paywallCopy } from "@/features/paywall/copy";

function baseProps() {
  return {
    variant: "expiry" as const,
    isPurchasing: false,
    isRestoring: false,
    onUnlock: jest.fn(),
    onRestore: jest.fn(),
    onContinueFree: jest.fn(),
    onDismiss: jest.fn(),
    showRefundedBanner: false,
  };
}

describe("PaywallScreen", () => {
  it("expiry variant shows Continue free and hides Maybe later", () => {
    render(<PaywallScreen {...baseProps()} variant="expiry" />);
    expect(screen.getByText(paywallCopy.expiryTitle)).toBeTruthy();
    expect(screen.getByText(paywallCopy.continueFreeCta)).toBeTruthy();
    expect(screen.queryByText(paywallCopy.maybeLaterCta)).toBeNull();
  });

  it("cap_block variant shows Maybe later and hides Continue free", () => {
    render(<PaywallScreen {...baseProps()} variant="cap_block" />);
    expect(screen.getByText(paywallCopy.capBlockTitle)).toBeTruthy();
    expect(screen.getByText(paywallCopy.maybeLaterCta)).toBeTruthy();
    expect(screen.queryByText(paywallCopy.continueFreeCta)).toBeNull();
  });

  it("calls onUnlock when the unlock CTA is pressed", () => {
    const props = baseProps();
    render(<PaywallScreen {...props} />);
    fireEvent.press(screen.getByText(paywallCopy.unlockCta));
    expect(props.onUnlock).toHaveBeenCalledTimes(1);
  });

  it("calls onContinueFree from the expiry variant", () => {
    const props = baseProps();
    render(<PaywallScreen {...props} variant="expiry" />);
    fireEvent.press(screen.getByText(paywallCopy.continueFreeCta));
    expect(props.onContinueFree).toHaveBeenCalledTimes(1);
  });

  it("calls onDismiss from the cap_block Maybe later CTA", () => {
    const props = baseProps();
    render(<PaywallScreen {...props} variant="cap_block" />);
    fireEvent.press(screen.getByText(paywallCopy.maybeLaterCta));
    expect(props.onDismiss).toHaveBeenCalledTimes(1);
  });

  it("swaps the label to 'Opening…' and blocks the unlock press while purchasing", () => {
    const props = baseProps();
    render(<PaywallScreen {...props} isPurchasing />);
    expect(screen.queryByText(paywallCopy.unlockCta)).toBeNull();
    fireEvent.press(screen.getByText("Opening…"));
    expect(props.onUnlock).not.toHaveBeenCalled();
  });

  it("renders the refunded banner when showRefundedBanner is true", () => {
    render(<PaywallScreen {...baseProps()} showRefundedBanner />);
    expect(screen.getByText(paywallCopy.refundedBanner)).toBeTruthy();
  });
});
