import { shouldShowEndingBanner, endingBannerKey } from "@/features/paywall/useTrialEndingBanner";

const NOW = new Date("2026-06-14T12:00:00.000Z");

it("shows when within 48h of trial end, status trial, not dismissed", () => {
  const endsAt = new Date("2026-06-15T18:00:00.000Z").toISOString(); // ~30h
  expect(shouldShowEndingBanner({ status: "trial", trialEndsAt: endsAt, now: NOW, dismissedKey: null })).toBe(true);
});

it("hides when more than 48h remain", () => {
  const endsAt = new Date("2026-06-17T12:00:00.000Z").toISOString(); // 72h
  expect(shouldShowEndingBanner({ status: "trial", trialEndsAt: endsAt, now: NOW, dismissedKey: null })).toBe(false);
});

it("hides after the trial ends", () => {
  const endsAt = new Date("2026-06-14T06:00:00.000Z").toISOString();
  expect(shouldShowEndingBanner({ status: "trial", trialEndsAt: endsAt, now: NOW, dismissedKey: null })).toBe(false);
});

it("hides when the dismissed key matches this trial window", () => {
  const endsAt = new Date("2026-06-15T18:00:00.000Z").toISOString();
  expect(shouldShowEndingBanner({ status: "trial", trialEndsAt: endsAt, now: NOW, dismissedKey: endingBannerKey(endsAt) })).toBe(false);
});

it("re-shows when the dismissed key is from a different (older) trial window", () => {
  const endsAt = new Date("2026-06-15T18:00:00.000Z").toISOString();
  expect(shouldShowEndingBanner({ status: "trial", trialEndsAt: endsAt, now: NOW, dismissedKey: endingBannerKey("2026-01-01T00:00:00.000Z") })).toBe(true);
});

it("hides for non-trial statuses", () => {
  const endsAt = new Date("2026-06-15T18:00:00.000Z").toISOString();
  expect(shouldShowEndingBanner({ status: "paid", trialEndsAt: endsAt, now: NOW, dismissedKey: null })).toBe(false);
});
