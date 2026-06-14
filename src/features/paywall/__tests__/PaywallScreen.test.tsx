import { render, screen, fireEvent } from "@/tests/setup/render";

import { PaywallScreen } from "@/features/paywall/PaywallScreen";
import { paywallCopy } from "@/features/paywall/copy";

function baseProps() {
  return {
    variant: "expiry" as const,
    isPurchasing: false,
    isRestoring: false,
    isVerifying: false,
    status: { kind: "idle" } as const,
    onUnlock: jest.fn(),
    onRestore: jest.fn(),
    onRecheck: jest.fn(),
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

  it("processing status shows the processing message + a 'Check again' CTA instead of Unlock", () => {
    render(<PaywallScreen {...baseProps()} status={{ kind: "processing" }} />);
    expect(screen.getByText(paywallCopy.processing)).toBeTruthy();
    expect(screen.getByText(paywallCopy.checkAgainCta)).toBeTruthy();
    // Unlock CTA is replaced by Check again while processing.
    expect(screen.queryByText(paywallCopy.unlockCta)).toBeNull();
  });

  it("Check again calls onRecheck", () => {
    const props = baseProps();
    render(<PaywallScreen {...props} status={{ kind: "processing" }} />);
    fireEvent.press(screen.getByText(paywallCopy.checkAgainCta));
    expect(props.onRecheck).toHaveBeenCalledTimes(1);
  });

  it("error status surfaces the message (e.g. no previous purchase)", () => {
    render(
      <PaywallScreen
        {...baseProps()}
        status={{ kind: "error", message: paywallCopy.restoreNoneFound }}
      />,
    );
    expect(screen.getByText(paywallCopy.restoreNoneFound)).toBeTruthy();
  });

  it("verifying disables the actions and labels the primary 'Verifying…'", () => {
    const props = baseProps();
    render(<PaywallScreen {...props} isVerifying />);
    expect(screen.queryByText(paywallCopy.unlockCta)).toBeNull();
    fireEvent.press(screen.getByText("Verifying…"));
    expect(props.onUnlock).not.toHaveBeenCalled();
  });

  it("calls onRestore when the restore CTA is pressed", () => {
    const props = baseProps();
    render(<PaywallScreen {...props} />);
    fireEvent.press(screen.getByText(paywallCopy.restoreCta));
    expect(props.onRestore).toHaveBeenCalledTimes(1);
  });

  it("swaps the restore label to 'Restoring…' and blocks the press while restoring", () => {
    // TertiaryButton has no `disabled` prop, so the busy press-block lives in
    // PaywallScreen's own onPress guard — pin it so it can't regress silently.
    const props = baseProps();
    render(<PaywallScreen {...props} isRestoring />);
    expect(screen.queryByText(paywallCopy.restoreCta)).toBeNull();
    fireEvent.press(screen.getByText("Restoring…"));
    expect(props.onRestore).not.toHaveBeenCalled();
  });
});
