import { computeTrialBadge } from "@/features/paywall/useTrialBadge";

const NOW = new Date("2026-06-14T12:00:00.000Z");

it("shows the badge with N days left when within the last 7 days of trial", () => {
  const endsAt = new Date("2026-06-17T12:00:00.000Z").toISOString();
  expect(computeTrialBadge("trial", endsAt, NOW)).toEqual({ visible: true, daysLeft: 3 });
});

it("hides the badge before day 7 (more than 7 days left)", () => {
  const endsAt = new Date("2026-06-24T12:00:00.000Z").toISOString(); // 10 days
  expect(computeTrialBadge("trial", endsAt, NOW)).toEqual({ visible: false, daysLeft: 10 });
});

it("hides the badge for non-trial statuses", () => {
  const endsAt = new Date("2026-06-17T12:00:00.000Z").toISOString();
  expect(computeTrialBadge("paid", endsAt, NOW).visible).toBe(false);
  expect(computeTrialBadge("expired", endsAt, NOW).visible).toBe(false);
});

it("hides the badge once the trial has ended (0 or negative days)", () => {
  const endsAt = new Date("2026-06-14T06:00:00.000Z").toISOString();
  expect(computeTrialBadge("trial", endsAt, NOW).visible).toBe(false);
});

it("clamps daysLeft up with ceiling (partial day counts as a day)", () => {
  const endsAt = new Date("2026-06-15T18:00:00.000Z").toISOString(); // ~1.25 days
  expect(computeTrialBadge("trial", endsAt, NOW)).toEqual({ visible: true, daysLeft: 2 });
});
