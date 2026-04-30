import { render, screen } from "@testing-library/react-native";

import { IdentityStreakDisplay } from "@/components/IdentityStreakDisplay";

describe("IdentityStreakDisplay", () => {
  it('renders "Day one. Start showing up." when streak is 0', () => {
    render(<IdentityStreakDisplay streak={0} identityNoun="runner" />);
    expect(screen.getByText("Day one. Start showing up.")).toBeTruthy();
  });

  it("renders identity-flavored copy with singular day for streak === 1", () => {
    render(<IdentityStreakDisplay streak={1} identityNoun="runner" />);
    expect(screen.getByText("You've been a runner for 1 day.")).toBeTruthy();
  });

  it("renders identity-flavored copy with plural days for streak >= 2", () => {
    render(<IdentityStreakDisplay streak={12} identityNoun="reader" />);
    expect(screen.getByText("You've been a reader for 12 days.")).toBeTruthy();
  });

  it("falls back to generic copy when identityNoun is null (singular)", () => {
    render(<IdentityStreakDisplay streak={1} identityNoun={null} />);
    expect(screen.getByText("You've shown up 1 day for this habit.")).toBeTruthy();
  });

  it("falls back to generic copy when identityNoun is null (plural)", () => {
    render(<IdentityStreakDisplay streak={12} identityNoun={null} />);
    expect(screen.getByText("You've shown up 12 days for this habit.")).toBeTruthy();
  });
});
