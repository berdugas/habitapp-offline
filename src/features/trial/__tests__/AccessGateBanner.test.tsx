import { render, screen } from "@/tests/setup/render";
import { AccessGateBanner } from "@/features/trial/AccessGateBanner";

describe("AccessGateBanner", () => {
  const noop = () => {};

  it("renders null when accessMode is 'full'", () => {
    const { toJSON } = render(
      <AccessGateBanner accessMode="full" isReconnecting={false} onReconnect={noop} />,
    );
    expect(toJSON()).toBeNull();
  });

  it("renders ReadOnlyBanner with Reconnect button when accessMode is 'read_only'", () => {
    render(
      <AccessGateBanner
        accessMode="read_only"
        isReconnecting={false}
        onReconnect={noop}
      />,
    );
    expect(screen.getByText("Reconnect to keep logging.")).toBeTruthy();
    expect(screen.getByText("Reconnect")).toBeTruthy();
  });

  it("renders the same ReadOnlyBanner (with Reconnect) for 'expired_no_purchase' — sub-plan 1 contract", () => {
    render(
      <AccessGateBanner
        accessMode="expired_no_purchase"
        isReconnecting={false}
        onReconnect={noop}
      />,
    );
    // The new expired_no_purchase state intentionally surfaces the same UI
    // as read_only for now; sub-plan 4 (paywall) replaces this branch.
    expect(screen.getByText("Reconnect to keep logging.")).toBeTruthy();
    expect(screen.getByText("Reconnect")).toBeTruthy();
  });
});
