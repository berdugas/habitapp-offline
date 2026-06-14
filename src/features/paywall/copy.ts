// All paywall-facing copy in one place. Price is hard-coded to match the
// Play managed product + RevenueCat product ($1.99 lifetime, sub-plan 3).
export const PAYWALL_PRICE = "$1.99";

export const paywallCopy = {
  expiryTitle: "Your free trial just ended",
  expiryBody: `${PAYWALL_PRICE} once. Unlimited goals, habits, everything. No subscription.`,
  capBlockTitle: "Unlock unlimited habits",
  capBlockBody: `Free includes 1 habit. Unlock everything for ${PAYWALL_PRICE} once — no subscription.`,
  unlockCta: `Unlock for ${PAYWALL_PRICE}`,
  continueFreeCta: "Continue free with 1 habit",
  maybeLaterCta: "Maybe later",
  restoreCta: "Restore Purchase",
  purchaseFailed: "That didn't go through. Please try again.",
  restoreNoneFound: "No previous purchase found on this account.",
  restoreFailed: "Couldn't restore right now. Please try again.",
  // Shown when the purchase/restore succeeded on the store but the server
  // hasn't confirmed it yet (RevenueCat webhook still propagating).
  processing: "Payment processing — this can take a moment.",
  checkAgainCta: "Check again",
  pickerTitle: "Pick 1 habit to keep",
  pickerKeepNone: "Keep none",
  pickerConfirmTitle: "Archive the rest?",
  pickerConfirmBody:
    "Your other habits — active and any in your backlog — will be archived. The habit you keep becomes your free plan. You can restore everything anytime by unlocking.",
  pickerConfirmYes: "Yes, continue free",
  pickerConfirmBack: "Back",
  refundedBanner:
    "Your purchase was refunded. Pick up where you left off, or unlock again.",
  unlockToEdit: "Unlock to edit",
  unlockToArchive: "Unlock to archive",
  unlockToRestore: `Unlock ${PAYWALL_PRICE} to restore`,
  trialBadge: (days: number) => `Trial: ${days} ${days === 1 ? "day" : "days"} left`,
  trialEndingTitle: "Your trial ends soon",
  trialEndingBody: (days: number) =>
    `Your free trial ends in ${days} ${days === 1 ? "day" : "days"}. Unlock anytime for ${PAYWALL_PRICE}.`,
  settingsUpgrade: `Upgrade for ${PAYWALL_PRICE}`,
  settingsPaid: "Paid ✓",
} as const;
