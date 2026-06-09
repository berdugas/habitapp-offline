import { render, screen } from "@/tests/setup/render";

import { AccessGateBanner } from "@/features/trial/AccessGateBanner";

describe("AccessGateBanner", () => {
  const noop = () => {};

  it("renders null when accessMode is 'full'", () => {
    const { toJSON } = render(
      <AccessGateBanner
        accessMode="full"
        isReconnecting={false}
        onReconnect={noop}
      />,
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

  it("renders TrialEndedBanner with NO Reconnect button when accessMode is 'expired_no_purchase'", () => {
    render(
      <AccessGateBanner
        accessMode="expired_no_purchase"
        isReconnecting={false}
        onReconnect={noop}
      />,
    );
    expect(screen.getByText("Your trial has ended.")).toBeTruthy();
    expect(screen.queryByText("Reconnect")).toBeNull();
    expect(screen.queryByText("Reconnecting…")).toBeNull();
  });

  it("does not invoke onReconnect for the expired path", () => {
    // Sanity: there's no button to press in the expired banner, so
    // onReconnect should never be invoked from the AccessGateBanner for
    // expired users.
    const reconnect = jest.fn();
    render(
      <AccessGateBanner
        accessMode="expired_no_purchase"
        isReconnecting={false}
        onReconnect={reconnect}
      />,
    );
    expect(reconnect).not.toHaveBeenCalled();
  });
});
