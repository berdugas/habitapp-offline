import { computeNotificationFireDate } from "@/features/paywall/useTrialEndingNotification";

const NOW = new Date("2026-06-14T12:00:00.000Z");

it("fires 48h before trial end", () => {
  const endsAt = new Date("2026-06-18T12:00:00.000Z").toISOString();
  const fire = computeNotificationFireDate(endsAt, NOW);
  expect(fire?.toISOString()).toBe("2026-06-16T12:00:00.000Z");
});

it("returns null when the fire time is already in the past", () => {
  const endsAt = new Date("2026-06-15T06:00:00.000Z").toISOString(); // 48h before is in the past
  expect(computeNotificationFireDate(endsAt, NOW)).toBeNull();
});

it("returns null for a malformed date", () => {
  expect(computeNotificationFireDate("not-a-date", NOW)).toBeNull();
});
