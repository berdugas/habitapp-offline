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

  it("renders null for 'expired_no_purchase' — the paywall owns that state now", () => {
    // expired_no_purchase is handled by the paywall (hard-block for over-cap
    // users, per-action "Unlock to…" affordances for resolved free-tier
    // users) — it must NOT show the offline "Reconnect" banner.
    const { toJSON } = render(
      <AccessGateBanner
        accessMode="expired_no_purchase"
        isReconnecting={false}
        onReconnect={noop}
      />,
    );
    expect(toJSON()).toBeNull();
    expect(screen.queryByText("Reconnect to keep logging.")).toBeNull();
  });
});
